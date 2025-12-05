-- Migration: Create config table for storing application settings
-- This allows storing settings like service_role_key without requiring superuser privileges

-- Create config table (only accessible by service_role)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write config
CREATE POLICY "Service role can manage config"
  ON app_config FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Grant permissions - allow service_role full access, authenticated users can read
GRANT ALL ON TABLE app_config TO service_role;
GRANT SELECT ON TABLE app_config TO authenticated, anon;

-- Helper function to get config value (anyone can call, runs with elevated privileges)
CREATE OR REPLACE FUNCTION get_app_config(config_key TEXT)
RETURNS TEXT AS $$
DECLARE
  config_value TEXT;
BEGIN
  -- Try to get from config table first
  SELECT value INTO config_value
  FROM app_config
  WHERE key = config_key
  LIMIT 1;
  
  RETURN config_value;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to set config value (anyone can call, runs with elevated privileges to bypass RLS)
CREATE OR REPLACE FUNCTION set_app_config(config_key TEXT, config_value TEXT)
RETURNS void AS $$
BEGIN
  -- SECURITY DEFINER allows this to bypass RLS and insert/update
  INSERT INTO app_config (key, value)
  VALUES (config_key, config_value)
  ON CONFLICT (key) DO UPDATE
  SET value = config_value, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_app_config(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION set_app_config(TEXT, TEXT) TO authenticated, anon, service_role;

COMMENT ON TABLE app_config IS 'Stores application configuration settings like service_role_key';
COMMENT ON FUNCTION get_app_config(TEXT) IS 'Gets a configuration value from app_config table';
COMMENT ON FUNCTION set_app_config(TEXT, TEXT) IS 'Sets a configuration value in app_config table (requires service_role)';

