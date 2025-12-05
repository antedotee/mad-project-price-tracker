-- Setup script for remote price drop detection
-- Run this on your remote Supabase database via SQL Editor or psql

-- Step 1: Set the remote Supabase URL (replace with your actual URL if different)
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://xcfezkqbsnzowaqagzwp.supabase.co';

-- Step 2: Set the service role key
-- IMPORTANT: Replace 'YOUR_SERVICE_ROLE_KEY' with your actual service role key
-- You can find it in: Supabase Dashboard -> Project Settings -> API -> service_role key
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';

-- Step 3: Verify settings
SELECT name, setting 
FROM pg_settings 
WHERE name LIKE 'app.settings%';

-- Step 4: Check if cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 5: Ensure the cron job is scheduled (runs every 2 minutes)
SELECT cron.unschedule('simulate-price-updates') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'simulate-price-updates'
);

SELECT cron.schedule(
  'simulate-price-updates',
  '*/2 * * * *', -- Every 2 minutes
  $$SELECT invoke_simulate_price_updates();$$
);

-- Step 6: Verify cron job is scheduled
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'simulate-price-updates';

-- Step 7: Test by manually triggering price simulation
-- SELECT invoke_simulate_price_updates();

-- Step 8: Check if there are tracked searches with products
SELECT 
  s.id as search_id,
  s.query,
  s.is_tracked,
  COUNT(ps.asin) as product_count
FROM searches s
LEFT JOIN product_search ps ON s.id = ps.search_id
WHERE s.is_tracked = true
GROUP BY s.id, s.query, s.is_tracked;

-- Step 9: Check price snapshots for tracked products
SELECT 
  ps.asin,
  p.name,
  COUNT(ps_snap.asin) as snapshot_count
FROM product_search ps
JOIN searches s ON ps.search_id = s.id
JOIN products p ON ps.asin = p.asin
LEFT JOIN product_snapshot ps_snap ON ps.asin = ps_snap.asin
WHERE s.is_tracked = true
GROUP BY ps.asin, p.name
HAVING COUNT(ps_snap.asin) < 2  -- Need at least 2 snapshots to detect drops
LIMIT 10;

