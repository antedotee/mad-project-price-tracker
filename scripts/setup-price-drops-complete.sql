-- Complete setup script for price drop detection
-- Run this in Supabase Dashboard SQL Editor

-- Step 1: Set the service role key
-- IMPORTANT: Replace 'YOUR_SERVICE_ROLE_KEY' with your actual service role key
-- Get it from: Supabase Dashboard -> Project Settings -> API -> service_role key
SELECT set_app_config('service_role_key', 'YOUR_SERVICE_ROLE_KEY');

-- Step 2: Set the Supabase URL (optional, functions have hardcoded fallback)
SELECT set_app_config('supabase_url', 'https://xcfezkqbsnzowaqagzwp.supabase.co');

-- Step 3: Verify config was set (will show NULL for service_role_key value for security)
SELECT key, 
       CASE 
         WHEN key = 'service_role_key' THEN '***SET***'
         ELSE value
       END as value_status,
       updated_at
FROM app_config;

-- Step 4: Check if cron job is scheduled
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'simulate-price-updates';

-- Step 5: Test the price simulation function (creates snapshots)
-- SELECT invoke_simulate_price_updates();

-- Step 6: Check tracked searches
SELECT id, query, is_tracked, status, created_at
FROM searches
WHERE is_tracked = true
ORDER BY created_at DESC
LIMIT 5;

-- Step 7: Check products in tracked searches
SELECT 
  s.id as search_id,
  s.query,
  COUNT(ps.asin) as product_count
FROM searches s
LEFT JOIN product_search ps ON s.id = ps.search_id
WHERE s.is_tracked = true
GROUP BY s.id, s.query;

-- Step 8: Check price snapshots (need at least 2 per product to detect drops)
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
ORDER BY snapshot_count ASC
LIMIT 10;

-- Step 9: Check existing price drop alerts
SELECT id, asin, product_name, old_price, new_price, price_drop_amount, created_at
FROM price_drop_alerts
ORDER BY created_at DESC
LIMIT 10;

