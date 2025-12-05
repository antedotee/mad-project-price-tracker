-- Update the minute cron job to use the fixed function
-- Unschedule existing job if it exists
SELECT cron.unschedule('simulate-price-updates-cron') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'simulate-price-updates-cron'
);

SELECT cron.schedule(
  'simulate-price-updates-cron',
  '* * * * *',
  $$SELECT invoke_simulate_price_updates();$$
);
