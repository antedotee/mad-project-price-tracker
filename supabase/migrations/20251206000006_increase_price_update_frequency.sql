-- Migration: Increase price update frequency for real-time feel
-- Updates cron job to run every 1-2 minutes instead of every 5 minutes

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule the existing job
SELECT cron.unschedule('simulate-price-updates') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'simulate-price-updates'
);

-- Schedule the cron job to run every 2 minutes for more frequent updates
-- Using '*/2 * * * *' = every 2 minutes
-- For even more frequent updates, use '*/1 * * * *' = every 1 minute
SELECT cron.schedule(
  'simulate-price-updates',
  '*/2 * * * *', -- Every 2 minutes (change to '*/1 * * * *' for every 1 minute)
  $$SELECT invoke_simulate_price_updates();$$
);

-- Comment explaining the cron job
COMMENT ON FUNCTION invoke_simulate_price_updates() IS 'Invokes the simulate-price-updates edge function to create price snapshots. Runs every 2 minutes for real-time price tracking.';

-- Note: For testing, you can manually trigger it with:
-- SELECT invoke_simulate_price_updates();
--
-- To check if the cron job is running:
-- SELECT * FROM cron.job WHERE jobname = 'simulate-price-updates';
--
-- To see recent cron job runs:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'simulate-price-updates') ORDER BY start_time DESC LIMIT 10;

