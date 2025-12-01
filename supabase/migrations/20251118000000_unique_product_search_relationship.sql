-- Migration: Unique product - search relationship items
-- This migration refactors product_search to use a composite primary key
-- instead of a separate id column, making the relationship more efficient

-- Drop the existing primary key constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'product_search_pkey' 
    AND table_name = 'product_search'
  ) THEN
    ALTER TABLE "public"."product_search" DROP CONSTRAINT "product_search_pkey";
  END IF;
END $$;

-- Drop the index if it exists
DROP INDEX IF EXISTS "public"."product_search_pkey";

-- Remove unnecessary columns if they exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_search' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE "public"."product_search" DROP COLUMN "created_at";
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_search' AND column_name = 'id'
  ) THEN
    ALTER TABLE "public"."product_search" DROP COLUMN "id";
  END IF;
END $$;

-- Ensure no NULL values exist before making columns NOT NULL
-- Delete any rows with NULL values (shouldn't exist, but safety check)
DELETE FROM "public"."product_search" WHERE "asin" IS NULL OR "search_id" IS NULL;

-- Make the relationship columns NOT NULL
ALTER TABLE "public"."product_search" ALTER COLUMN "asin" SET NOT NULL;
ALTER TABLE "public"."product_search" ALTER COLUMN "search_id" SET NOT NULL;

-- Create composite primary key index (drop if exists first)
DROP INDEX IF EXISTS product_search_pkey;
CREATE UNIQUE INDEX product_search_pkey ON public.product_search USING btree (asin, search_id);

-- Add the primary key constraint using the index
ALTER TABLE "public"."product_search" ADD CONSTRAINT "product_search_pkey" PRIMARY KEY USING INDEX "product_search_pkey";

-- Drop old trigger and function if they exist (from previous migration)
DROP TRIGGER IF EXISTS "trigger_scrape_start" ON public.searches;
DROP TRIGGER IF EXISTS "StartScrapingForNewSearches" ON public.searches;
DROP FUNCTION IF EXISTS invoke_scrape_start();

-- Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create or replace function to invoke the edge function using pg_net
CREATE OR REPLACE FUNCTION invoke_scrape_start()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the edge function asynchronously via pg_net extension
  -- Using hardcoded service role key for production
  PERFORM net.http_post(
    url := 'https://ttxvnyflpzstmpdrbtnz.supabase.co/functions/v1/scrape-start',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0eHZueWZscHpzdG1wZHJidG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzQ1OTE0MCwiZXhwIjoyMDQzMDM1MTQwfQ.O108uUKwL6SoRawpDtdfPcli9yn84XAKgWjsQaucTro'
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  RAISE NOTICE 'Error invoking scrape-start: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to start scraping for new searches
CREATE TRIGGER "StartScrapingForNewSearches" 
  AFTER INSERT ON public.searches 
  FOR EACH ROW 
  EXECUTE FUNCTION invoke_scrape_start();

