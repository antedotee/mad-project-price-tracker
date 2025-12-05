-- Set your service role key
-- Run this in Supabase Dashboard → SQL Editor

SELECT set_app_config('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZmV6a3Fic256b3dhcWFnendwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjE4MTAxMywiZXhwIjoyMDc3NzU3MDEzfQ.xER7SZcgJ-HMFiAWB91mcwuLukzL0hl11TdM-imRH-Q');

-- Verify it was set
SELECT key, updated_at FROM app_config WHERE key = 'service_role_key';

-- Check cron job status
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'simulate-price-updates';

