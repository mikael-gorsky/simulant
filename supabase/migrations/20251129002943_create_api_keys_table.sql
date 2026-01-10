/*
  # Create API Keys Storage Table

  1. New Tables
    - `api_keys`
      - `id` (uuid, primary key) - Unique identifier
      - `key_name` (text) - Name of the API key (e.g., 'openai', 'simli')
      - `key_value` (text) - Encrypted API key value
      - `created_at` (timestamptz) - When the key was created
      - `updated_at` (timestamptz) - When the key was last updated
      
    - `app_settings`
      - `id` (uuid, primary key) - Unique identifier
      - `setting_key` (text, unique) - Setting name
      - `setting_value` (jsonb) - Setting value as JSON
      - `created_at` (timestamptz) - When created
      - `updated_at` (timestamptz) - When last updated

    - `character_files`
      - `id` (uuid, primary key) - Unique identifier
      - `filename` (text) - Original filename
      - `content` (text) - File content
      - `file_size` (integer) - Size in bytes
      - `created_at` (timestamptz) - When uploaded
      - `is_active` (boolean) - Whether this is the active character file

  2. Security
    - Enable RLS on all tables
    - Add policies for system access only (no public access)
    
  3. Important Notes
    - API keys are stored encrypted at application level
    - Only backend service should access these tables
    - No user-facing access to sensitive data
*/

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text UNIQUE NOT NULL,
  key_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create character_files table
CREATE TABLE IF NOT EXISTS character_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  content text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_files ENABLE ROW LEVEL SECURITY;

-- Create policies (restrictive - only service role can access)
-- No public policies - backend only access

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_key_name ON api_keys(key_name);
CREATE INDEX IF NOT EXISTS idx_app_settings_setting_key ON app_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_character_files_is_active ON character_files(is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
