-- Fix the invoke_simulate_price_updates function to correctly handle missing settings and pg_net async nature
-- Updated with correct local Service Role JWT
CREATE OR REPLACE FUNCTION invoke_simulate_price_updates()
RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  supabase_key TEXT;
  request_id BIGINT;
BEGIN
  -- Get Supabase configuration
  supabase_url := current_setting('app.settings.supabase_url', true);
  supabase_key := current_setting('app.settings.supabase_anon_key', true);

  -- Fallback for local development if settings are missing
  IF supabase_url IS NULL OR supabase_key IS NULL THEN
    supabase_url := 'http://host.docker.internal:54321';
    -- Use the service_role key for local dev (from npx supabase status -o json)
    supabase_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
  END IF;

  -- Call the edge function via pg_net
  -- net.http_post returns the request_id, not the response status (it's async)
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/simulate-price-updates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_key
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RAISE NOTICE 'Price simulation triggered. Request ID: %', request_id;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error invoking simulate-price-updates: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
