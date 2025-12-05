-- Quick status check - Run this to verify everything is working
-- Copy and run in Supabase Dashboard → SQL Editor

-- 1. Verify service key is set
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM app_config WHERE key = 'service_role_key') 
    THEN '✅ Service key is SET'
    ELSE '❌ Service key NOT set'
  END as service_key_status;

-- 2. Check cron job
SELECT 
  jobname,
  schedule,
  active,
  CASE 
    WHEN active = true THEN '✅ Cron is ACTIVE'
    ELSE '❌ Cron is INACTIVE'
  END as cron_status
FROM cron.job 
WHERE jobname = 'simulate-price-updates';

-- 3. Check triggers
SELECT 
  trigger_name,
  CASE 
    WHEN trigger_name IS NOT NULL THEN '✅ Trigger exists'
    ELSE '❌ Missing'
  END as trigger_status
FROM information_schema.triggers 
WHERE event_object_table = 'searches' 
  AND trigger_name IN ('CheckPriceDropsOnTrackEnable', 'InvokeCheckSearchPriceDropsOnUpdatedSearch');

-- 4. Check tracked searches
SELECT COUNT(*) as tracked_searches_count
FROM searches 
WHERE is_tracked = true;

-- 5. Check price snapshots (need at least 2 per product to detect drops)
SELECT 
  COUNT(DISTINCT asin) as products_with_snapshots,
  COUNT(*) as total_snapshots,
  CASE 
    WHEN COUNT(*) >= 2 THEN '✅ Ready for price drop detection'
    ELSE '⚠️ Need more snapshots (run SELECT invoke_simulate_price_updates(); a few times)'
  END as snapshot_status
FROM product_snapshot;

-- 6. Check existing alerts
SELECT COUNT(*) as total_alerts
FROM price_drop_alerts;

