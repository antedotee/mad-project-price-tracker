-- Schedule the price simulation to run every minute
-- This ensures we have frequent price updates for testing/demo purposes

-- Unschedule existing job if it exists
SELECT cron.unschedule('simulate-price-updates-cron') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'simulate-price-updates-cron'
);

SELECT cron.schedule(
  'simulate-price-updates-cron',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
      url := 'https://ttxvnyflpzstmpdrbtnz.supabase.co/functions/v1/simulate-price-updates',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      timeout_milliseconds := 5000
    ) as request_id;
  $$
);
