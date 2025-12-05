-- Migration: Setup cron job for simulating price updates
-- This runs periodically to simulate price changes without needing BrightData API

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to invoke the simulate-price-updates edge function
CREATE OR REPLACE FUNCTION invoke_simulate_price_updates()
RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  supabase_key TEXT;
  response_status INT;
BEGIN
  -- Get Supabase configuration
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url', true);
    supabase_key := current_setting('app.settings.supabase_anon_key', true);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback for local development
    supabase_url := 'http://host.docker.internal:54321';
    supabase_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  END;

  -- Skip if configuration is not set
  IF supabase_url IS NULL OR supabase_key IS NULL THEN
    RAISE NOTICE 'Supabase configuration not set. Skipping price simulation.';
    RETURN;
  END IF;

  -- Call the edge function via pg_net
  SELECT status INTO response_status
  FROM net.http_post(
    url := supabase_url || '/functions/v1/simulate-price-updates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_key
    ),
    body := '{}'::jsonb
  );

  RAISE NOTICE 'Price simulation triggered. Response status: %', response_status;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error invoking simulate-price-updates: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the cron job to run every 6 hours (simulate price updates)
-- Adjust the schedule as needed: '0 */6 * * *' = every 6 hours
SELECT cron.schedule(
  'simulate-price-updates',
  '0 */6 * * *', -- Every 6 hours
  $$SELECT invoke_simulate_price_updates();$$
);

-- Comment explaining the cron job
COMMENT ON FUNCTION invoke_simulate_price_updates() IS 'Invokes the simulate-price-updates edge function to create price snapshots for existing products';

-- For testing: You can manually trigger it with:
-- SELECT invoke_simulate_price_updates();

-- To unschedule: SELECT cron.unschedule('simulate-price-updates');

