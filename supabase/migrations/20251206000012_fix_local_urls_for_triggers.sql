-- Migration: Fix hardcoded remote URLs to use local URL for local development
-- This ensures triggers work correctly when running locally

-- Fix invoke_check_price_drops_for_search function to use local URL
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

  -- Use local URL for local development, or detect from current_setting if available
  -- For local Supabase, use http://127.0.0.1:54321
  -- For production, this should be set via environment variable or config
  supabase_url := COALESCE(
    current_setting('app.supabase_url', true),
    'http://127.0.0.1:54321'
  );
  
  -- Get service role key from environment or use default local key
  service_role_key := COALESCE(
    current_setting('app.service_role_key', true),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  );

  -- Call the edge function asynchronously via pg_net extension
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/check-search-price-drops',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object('record', row_to_json(search_record)),
    timeout_milliseconds := 5000
  );

  RAISE NOTICE 'Price drop check triggered for search %', search_id_param;
  
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail
  RAISE NOTICE 'Error invoking check-search-price-drops for search %: %', search_id_param, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix invoke_check_search_price_drops function to use local URL
CREATE OR REPLACE FUNCTION invoke_check_search_price_drops()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Only invoke if status changed to "Done"
  IF NEW.status = 'Done' AND (OLD.status IS NULL OR OLD.status != 'Done') THEN
    -- Use local URL for local development
    supabase_url := COALESCE(
      current_setting('app.supabase_url', true),
      'http://127.0.0.1:54321'
    );
    
    service_role_key := COALESCE(
      current_setting('app.service_role_key', true),
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    );
    
    -- Call the edge function asynchronously via pg_net extension
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/check-search-price-drops',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object('record', row_to_json(NEW)),
      timeout_milliseconds := 5000
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the update
  RAISE NOTICE 'Error invoking check-search-price-drops: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment explaining the update
COMMENT ON FUNCTION invoke_check_price_drops_for_search(UUID) IS 'Invokes check-search-price-drops edge function for a specific search, using local URL for local development';
COMMENT ON FUNCTION invoke_check_search_price_drops() IS 'Invokes check-search-price-drops edge function when search status changes to Done, using local URL for local development';

