-- Migration: Enable real-time for tables that need live updates
-- This ensures that price snapshots and alerts appear in real-time in the UI

-- Enable real-time for product_snapshot table (for price history)
-- Only add if not already in publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'product_snapshot'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE product_snapshot;
  END IF;
END $$;

-- Enable real-time for products table (for price updates)
-- Only add if not already in publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  END IF;
END $$;

-- Enable real-time for price_drop_alerts table (for price drop notifications)
-- Only add if not already in publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'price_drop_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE price_drop_alerts;
  END IF;
END $$;

