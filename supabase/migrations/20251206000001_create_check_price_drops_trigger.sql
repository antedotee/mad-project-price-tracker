-- Migration: Create trigger to check price drops when search status changes to Done
-- This trigger invokes the check-search-price-drops edge function when a search is updated

-- Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create or replace function to invoke the check-search-price-drops edge function
CREATE OR REPLACE FUNCTION invoke_check_search_price_drops()
RETURNS TRIGGER AS $$
BEGIN
  -- Only invoke if status changed to "Done"
  IF NEW.status = 'Done' AND (OLD.status IS NULL OR OLD.status != 'Done') THEN
    -- Call the edge function asynchronously via pg_net extension
    PERFORM net.http_post(
      url := 'https://ttxvnyflpzstmpdrbtnz.supabase.co/functions/v1/check-search-price-drops',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0eHZueWZscHpzdG1wZHJidG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzQ1OTE0MCwiZXhwIjoyMDQzMDM1MTQwfQ.O108uUKwL6SoRawpDtdfPcli9yn84XAKgWjsQaucTro'
      ),
      body := jsonb_build_object('record', row_to_json(NEW)),
      timeout_milliseconds := 1000
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the update
  RAISE NOTICE 'Error invoking check-search-price-drops: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after a search is updated
DROP TRIGGER IF EXISTS "InvokeCheckSearchPriceDropsOnUpdatedSearch" ON public.searches;
CREATE TRIGGER "InvokeCheckSearchPriceDropsOnUpdatedSearch"
  AFTER UPDATE ON public.searches
  FOR EACH ROW
  EXECUTE FUNCTION invoke_check_search_price_drops();

-- Comment explaining the trigger
COMMENT ON FUNCTION invoke_check_search_price_drops() IS 'Invokes the check-search-price-drops edge function when a search status changes to Done';

