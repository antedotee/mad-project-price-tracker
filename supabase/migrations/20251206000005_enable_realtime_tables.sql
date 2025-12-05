-- Migration: Enable real-time for tables that need live updates
-- This ensures that price snapshots and alerts appear in real-time in the UI

-- Enable real-time for product_snapshot table (for price history)
ALTER PUBLICATION supabase_realtime ADD TABLE product_snapshot;

-- Enable real-time for products table (for price updates)
ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- Enable real-time for price_drop_alerts table (for price drop notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE price_drop_alerts;

-- Note: If tables are already in the publication, this will not cause an error
-- Supabase handles this gracefully

