-- Daily cron job to scrape tracked searches
-- Runs at midnight UTC (0 0 * * *)
SELECT cron.schedule(
  'invoke-scraper-cron',
  '0 0 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ttxvnyflpzstmpdrbtnz.supabase.co/functions/v1/scrape-tracked-searches',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0eHZueWZscHpzdG1wZHJidG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzQ1OTE0MCwiZXhwIjoyMDQzMDM1MTQwfQ.O108uUKwL6SoRawpDtdfPcli9yn84XAKgWjsQaucTro'
      ),
      timeout_milliseconds := 5000
    ) as request_id;
  $$
);



