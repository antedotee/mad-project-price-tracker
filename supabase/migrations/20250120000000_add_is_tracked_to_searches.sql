-- Migration: Add is_tracked column to searches table
-- This column allows users to track/follow specific searches

-- Add is_tracked column to searches table
ALTER TABLE searches 
ADD COLUMN IF NOT EXISTS is_tracked BOOLEAN DEFAULT false;

-- Create index for better query performance when filtering tracked searches
CREATE INDEX IF NOT EXISTS idx_searches_is_tracked ON searches(is_tracked) WHERE is_tracked = true;

-- Update existing rows to have is_tracked = false (optional, but ensures consistency)
UPDATE searches SET is_tracked = false WHERE is_tracked IS NULL;

-- Add comment explaining the column
COMMENT ON COLUMN searches.is_tracked IS 'Indicates whether the user wants to track this search for price alerts';



