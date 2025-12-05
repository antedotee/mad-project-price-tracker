-- Migration: Enable real-time price tracking
-- Updates cron job to run every 5 minutes and creates trigger for immediate price checks when tracking is enabled

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Update the cron schedule to run every 5 minutes for real-time feel
-- First, unschedule the old job if it exists
SELECT cron.unschedule('simulate-price-updates') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'simulate-price-updates'
);

-- Schedule the cron job to run every 5 minutes
SELECT cron.schedule(
  'simulate-price-updates',
  '*/5 * * * *', -- Every 5 minutes
  $$SELECT invoke_simulate_price_updates();$$
);

-- Create function to invoke check-search-price-drops for a specific search
-- Uses the same pattern as invoke_check_search_price_drops() for consistency
CREATE OR REPLACE FUNCTION invoke_check_price_drops_for_search(search_id_param UUID)
RETURNS void AS $$
DECLARE
  search_record RECORD;
BEGIN
  -- Get the search record to pass to the function
  SELECT * INTO search_record FROM searches WHERE id = search_id_param;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Search % not found', search_id_param;
    RETURN;
  END IF;

  -- Call the edge function asynchronously via pg_net extension
  -- Using service role key like the existing trigger
  PERFORM net.http_post(
    url := 'https://ttxvnyflpzstmpdrbtnz.supabase.co/functions/v1/check-search-price-drops',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0eHZueWZscHpzdG1wZHJidG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzQ1OTE0MCwiZXhwIjoyMDQzMDM1MTQwfQ.O108uUKwL6SoRawpDtdfPcli9yn84XAKgWjsQaucTro'
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

-- Create trigger function to check price drops when tracking is enabled
CREATE OR REPLACE FUNCTION check_price_drops_on_track_enable()
RETURNS TRIGGER AS $$
BEGIN
  -- Only invoke if is_tracked changed from false to true
  IF NEW.is_tracked = true AND (OLD.is_tracked IS NULL OR OLD.is_tracked = false) THEN
    -- Only check if search status is Done (has products)
    IF NEW.status = 'Done' THEN
      -- Call the function asynchronously
      PERFORM invoke_check_price_drops_for_search(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the update
  RAISE NOTICE 'Error checking price drops on track enable: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires when a search is updated and tracking is enabled
DROP TRIGGER IF EXISTS "CheckPriceDropsOnTrackEnable" ON public.searches;
CREATE TRIGGER "CheckPriceDropsOnTrackEnable"
  AFTER UPDATE ON public.searches
  FOR EACH ROW
  WHEN (NEW.is_tracked = true AND (OLD.is_tracked IS NULL OR OLD.is_tracked = false))
  EXECUTE FUNCTION check_price_drops_on_track_enable();

-- Comment explaining the trigger
COMMENT ON FUNCTION check_price_drops_on_track_enable() IS 'Checks for price drops immediately when a search is tracked (bell icon tapped)';

