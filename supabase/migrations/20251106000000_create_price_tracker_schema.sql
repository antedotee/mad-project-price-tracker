-- Create searches table
CREATE TABLE IF NOT EXISTS searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_scraped_at TIMESTAMPTZ,
  query TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Scraping', 'Done', 'Failed')),
  snapshot_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  asin TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  image TEXT,
  url TEXT,
  final_price NUMERIC,
  currency TEXT DEFAULT 'USD'
);

-- Create product_search junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS product_search (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  asin TEXT REFERENCES products(asin) ON DELETE CASCADE,
  search_id UUID REFERENCES searches(id) ON DELETE CASCADE,
  UNIQUE(asin, search_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches(user_id);
CREATE INDEX IF NOT EXISTS idx_searches_created_at ON searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_search_search_id ON product_search(search_id);
CREATE INDEX IF NOT EXISTS idx_product_search_asin ON product_search(asin);

-- Enable Row Level Security (RLS)
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_search ENABLE ROW LEVEL SECURITY;

-- RLS Policies for searches table
-- Users can only see their own searches
CREATE POLICY "Users can view their own searches"
  ON searches FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own searches
CREATE POLICY "Users can insert their own searches"
  ON searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own searches
CREATE POLICY "Users can update their own searches"
  ON searches FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can update any search (for edge functions)
CREATE POLICY "Service role can update searches"
  ON searches FOR UPDATE
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for products table
-- Anyone authenticated can view products
CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Service role can insert/update products (for edge functions)
CREATE POLICY "Service role can manage products"
  ON products FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for product_search table
-- Users can view product_search entries for their searches
CREATE POLICY "Users can view product_search for their searches"
  ON product_search FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM searches
      WHERE searches.id = product_search.search_id
      AND searches.user_id = auth.uid()
    )
  );

-- Service role can manage product_search (for edge functions)
CREATE POLICY "Service role can manage product_search"
  ON product_search FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Enable pg_net extension for HTTP requests from triggers
-- This extension allows database triggers to make HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to invoke the edge function
CREATE OR REPLACE FUNCTION invoke_scrape_start()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  supabase_key TEXT;
BEGIN
  -- Try to get configuration from runtime settings
  -- These need to be set via: ALTER DATABASE postgres SET app.settings.supabase_url TO 'your-url';
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url', true);
    supabase_key := current_setting('app.settings.supabase_anon_key', true);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback for local development
    supabase_url := 'http://host.docker.internal:54321';
    supabase_key := current_setting('request.jwt.claims', true)::json->>'role';
  END;

  -- Skip if configuration is not set (prevents errors during migration)
  IF supabase_url IS NULL OR supabase_key IS NULL THEN
    RAISE NOTICE 'Supabase configuration not set. Skipping edge function invocation.';
    RETURN NEW;
  END IF;

  -- Call the edge function asynchronously via pg_net extension
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/scrape-start',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_key
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

-- Create trigger that fires after a new search is inserted
CREATE TRIGGER trigger_scrape_start
  AFTER INSERT ON searches
  FOR EACH ROW
  EXECUTE FUNCTION invoke_scrape_start();

-- Comment explaining the schema
COMMENT ON TABLE searches IS 'Stores user search queries and their scraping status';
COMMENT ON TABLE products IS 'Stores Amazon product information scraped from BrightData';
COMMENT ON TABLE product_search IS 'Junction table linking products to searches (many-to-many)';

