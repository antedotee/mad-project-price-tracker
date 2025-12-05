-- Script to set the service role key in the config table
-- Run this in Supabase Dashboard SQL Editor after migrations are applied
-- Replace 'YOUR_SERVICE_ROLE_KEY' with your actual service role key

-- Set the service role key
SELECT set_app_config('service_role_key', 'YOUR_SERVICE_ROLE_KEY');

-- Set the Supabase URL (optional, functions have hardcoded fallback)
SELECT set_app_config('supabase_url', 'https://xcfezkqbsnzowaqagzwp.supabase.co');

-- Verify the config was set (this will show NULL if not set, or the key if set)
SELECT key, 
       CASE 
         WHEN key = 'service_role_key' THEN '***HIDDEN***'
         ELSE value
       END as value,
       updated_at
FROM app_config;

