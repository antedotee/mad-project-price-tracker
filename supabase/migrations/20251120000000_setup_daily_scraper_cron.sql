-- Migration: Setup daily cron job to scrape tracked searches
-- This cron job runs daily at midnight to scrape all tracked searches

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing cron job if it exists (to avoid duplicates)
SELECT cron.unschedule('invoke-scraper-cron') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'invoke-scraper-cron'
);

-- Schedule daily cron job to run at midnight (00:00 UTC)
SELECT cron.schedule(
  'invoke-scraper-cron',
  '0 0 * * *', -- Run daily at midnight UTC
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

-- Comment explaining the cron job
COMMENT ON EXTENSION pg_cron IS 'Enables scheduled jobs to run automatically';

