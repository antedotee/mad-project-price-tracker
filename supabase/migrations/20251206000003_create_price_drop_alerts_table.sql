-- Migration: Create price_drop_alerts table for storing price drop notifications
-- This table stores price drop alerts for tracked searches

-- Create price_drop_alerts table
CREATE TABLE IF NOT EXISTS "public"."price_drop_alerts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "search_id" UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  "asin" TEXT NOT NULL REFERENCES products(asin) ON DELETE CASCADE,
  "product_name" TEXT NOT NULL,
  "product_url" TEXT,
  "old_price" NUMERIC NOT NULL,
  "new_price" NUMERIC NOT NULL,
  "price_drop_amount" NUMERIC NOT NULL,
  "price_drop_percent" NUMERIC NOT NULL,
  "is_read" BOOLEAN DEFAULT false,
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_price_drop_alerts_search_id ON price_drop_alerts(search_id);
CREATE INDEX IF NOT EXISTS idx_price_drop_alerts_user_id ON price_drop_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_drop_alerts_created_at ON price_drop_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_drop_alerts_is_read ON price_drop_alerts(is_read) WHERE is_read = false;

-- Enable Row Level Security
ALTER TABLE "public"."price_drop_alerts" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for price_drop_alerts table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own price drop alerts" ON price_drop_alerts;
DROP POLICY IF EXISTS "Users can update their own price drop alerts" ON price_drop_alerts;
DROP POLICY IF EXISTS "Service role can insert price drop alerts" ON price_drop_alerts;

-- Users can only see their own alerts
CREATE POLICY "Users can view their own price drop alerts"
  ON price_drop_alerts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own alerts (mark as read)
CREATE POLICY "Users can update their own price drop alerts"
  ON price_drop_alerts FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can insert alerts (for edge functions)
CREATE POLICY "Service role can insert price drop alerts"
  ON price_drop_alerts FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Grant permissions
GRANT SELECT, UPDATE ON TABLE "public"."price_drop_alerts" TO "anon", "authenticated";
GRANT INSERT ON TABLE "public"."price_drop_alerts" TO "service_role";

-- Comment explaining the schema
COMMENT ON TABLE price_drop_alerts IS 'Stores price drop notifications for tracked searches';

