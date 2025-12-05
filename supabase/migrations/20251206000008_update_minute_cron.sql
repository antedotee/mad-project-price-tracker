-- Update the minute cron job to use the fixed function
SELECT cron.schedule(
  'simulate-price-updates-cron',
  '* * * * *',
  $$SELECT invoke_simulate_price_updates();$$
);
