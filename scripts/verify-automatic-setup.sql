-- Quick verification script to check if automatic price drop detection is ready
-- Run this in Supabase Dashboard SQL Editor

-- 1. Check if service role key is configured
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM app_config WHERE key = 'service_role_key') 
    THEN '✅ Service role key is SET'
    ELSE '❌ Service role key is NOT SET - Run: SELECT set_app_config(''service_role_key'', ''your-key'');'
  END as service_key_status;

-- 2. Check if cron job is scheduled and active
SELECT 
  jobname,
  schedule,
  active,
  CASE 
    WHEN active = true THEN '✅ Cron job is ACTIVE'
    ELSE '❌ Cron job is INACTIVE'
  END as cron_status
FROM cron.job 
WHERE jobname = 'simulate-price-updates';

-- 3. Check if triggers exist
SELECT 
  trigger_name,
  event_manipulation,
  CASE 
    WHEN trigger_name IS NOT NULL THEN '✅ Trigger exists'
    ELSE '❌ Trigger missing'
  END as trigger_status
FROM information_schema.triggers 
WHERE event_object_table = 'searches' 
  AND trigger_name IN ('CheckPriceDropsOnTrackEnable', 'InvokeCheckSearchPriceDropsOnUpdatedSearch')
LIMIT 2;

-- 4. Check if edge functions are deployed (this requires checking Supabase Dashboard)
SELECT '⚠️  Check Supabase Dashboard → Edge Functions to verify functions are deployed' as edge_functions_check;

-- 5. Summary
SELECT 
  '📊 Setup Summary' as summary,
  CASE 
    WHEN EXISTS (SELECT 1 FROM app_config WHERE key = 'service_role_key') 
      AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'simulate-price-updates' AND active = true)
      AND EXISTS (SELECT 1 FROM information_schema.triggers WHERE event_object_table = 'searches' AND trigger_name = 'CheckPriceDropsOnTrackEnable')
    THEN '✅ Ready for automatic operation!'
    ELSE '⚠️  Some setup steps are missing - check above'
  END as status;

