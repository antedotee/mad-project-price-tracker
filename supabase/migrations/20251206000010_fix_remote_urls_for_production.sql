-- Migration: Fix functions to use remote Supabase URL for production
-- This ensures triggers and cron jobs work correctly with remote database

-- Note: Database settings should be set manually via Supabase Dashboard SQL Editor:
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://xcfezkqbsnzowaqagzwp.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
-- 
-- These require superuser privileges and cannot be set via migrations.
-- The functions below will use these settings if available, otherwise fall back to hardcoded remote URL.

-- Update invoke_check_price_drops_for_search to use remote URL
CREATE OR REPLACE FUNCTION invoke_check_price_drops_for_search(search_id_param UUID)
RETURNS void AS $$
DECLARE
  search_record RECORD;
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get the search record to pass to the function
  SELECT * INTO search_record FROM searches WHERE id = search_id_param;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Search % not found', search_id_param;
    RETURN;
  END IF;

  -- Get URL from database settings or use remote URL as default
  -- Try to get from settings first, fallback to hardcoded remote URL
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url', true);
  EXCEPTION WHEN OTHERS THEN
    supabase_url := 'https://xcfezkqbsnzowaqagzwp.supabase.co';
  END;
  
  IF supabase_url IS NULL THEN
    supabase_url := 'https://xcfezkqbsnzowaqagzwp.supabase.co';
  END IF;
  
  -- Get service role key from config table or database settings
  -- Try config table first, then database settings
  service_role_key := get_app_config('service_role_key');
  
  IF service_role_key IS NULL THEN
    BEGIN
      service_role_key := current_setting('app.settings.service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      service_role_key := NULL;
    END;
  END IF;
  
  -- If service role key is not set, we can't proceed
  IF service_role_key IS NULL THEN
    RAISE NOTICE 'Service role key not configured. Please set it using: SELECT set_app_config(''service_role_key'', ''your-key'');';
    RETURN;
  END IF;

  -- Call the edge function asynchronously via pg_net extension
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/check-search-price-drops',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object('record', row_to_json(search_record)),
    timeout_milliseconds := 10000
  );

  RAISE NOTICE 'Price drop check triggered for search %', search_id_param;
  
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail
  RAISE NOTICE 'Error invoking check-search-price-drops for search %: %', search_id_param, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update invoke_check_search_price_drops to use remote URL
CREATE OR REPLACE FUNCTION invoke_check_search_price_drops()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Only invoke if status changed to "Done"
  IF NEW.status = 'Done' AND (OLD.status IS NULL OR OLD.status != 'Done') THEN
    -- Get URL from database settings or use remote URL as default
    -- Try to get from settings first, fallback to hardcoded remote URL
    BEGIN
      supabase_url := current_setting('app.settings.supabase_url', true);
    EXCEPTION WHEN OTHERS THEN
      supabase_url := 'https://xcfezkqbsnzowaqagzwp.supabase.co';
    END;
    
    IF supabase_url IS NULL THEN
      supabase_url := 'https://xcfezkqbsnzowaqagzwp.supabase.co';
    END IF;
    
    -- Get service role key from config table or database settings
    service_role_key := get_app_config('service_role_key');
    
    IF service_role_key IS NULL THEN
      BEGIN
        service_role_key := current_setting('app.settings.service_role_key', true);
      EXCEPTION WHEN OTHERS THEN
        service_role_key := NULL;
      END;
    END IF;
    
    IF service_role_key IS NULL THEN
      RAISE NOTICE 'Service role key not configured. Please set it using: SELECT set_app_config(''service_role_key'', ''your-key'');';
      RETURN NEW;
    END IF;
    
    -- Call the edge function asynchronously via pg_net extension
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/check-search-price-drops',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object('record', row_to_json(NEW)),
      timeout_milliseconds := 10000
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the update
  RAISE NOTICE 'Error invoking check-search-price-drops: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update invoke_simulate_price_updates to use remote URL
CREATE OR REPLACE FUNCTION invoke_simulate_price_updates()
RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  supabase_key TEXT;
  request_id BIGINT;
BEGIN
  -- Get Supabase configuration from database settings
  -- Try to get from settings first, fallback to hardcoded remote URL
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url', true);
  EXCEPTION WHEN OTHERS THEN
    supabase_url := 'https://xcfezkqbsnzowaqagzwp.supabase.co';
  END;
  
  IF supabase_url IS NULL THEN
    supabase_url := 'https://xcfezkqbsnzowaqagzwp.supabase.co';
  END IF;
  
  -- Use service role key for invoking edge functions
  -- Try config table first, then database settings
  supabase_key := get_app_config('service_role_key');
  
  IF supabase_key IS NULL THEN
    BEGIN
      supabase_key := current_setting('app.settings.service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      supabase_key := NULL;
    END;
  END IF;
  
  -- If keys are not set, we can't proceed
  IF supabase_key IS NULL THEN
    RAISE NOTICE 'Service role key not configured. Please set it using: SELECT set_app_config(''service_role_key'', ''your-key'');';
    RETURN;
  END IF;

  -- Call the edge function via pg_net
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/simulate-price-updates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO request_id;

  RAISE NOTICE 'Price simulation triggered. Request ID: %', request_id;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error invoking simulate-price-updates: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure cron job is scheduled
SELECT cron.unschedule('simulate-price-updates') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'simulate-price-updates'
);

-- Schedule the cron job to run every 2 minutes for frequent price updates
SELECT cron.schedule(
  'simulate-price-updates',
  '*/2 * * * *', -- Every 2 minutes
  $$SELECT invoke_simulate_price_updates();$$
);

-- Comments
COMMENT ON FUNCTION invoke_check_price_drops_for_search(UUID) IS 'Invokes check-search-price-drops edge function for a specific search, using remote Supabase URL';
COMMENT ON FUNCTION invoke_check_search_price_drops() IS 'Invokes check-search-price-drops edge function when search status changes to Done, using remote Supabase URL';
COMMENT ON FUNCTION invoke_simulate_price_updates() IS 'Invokes simulate-price-updates edge function to create price snapshots, using remote Supabase URL';

