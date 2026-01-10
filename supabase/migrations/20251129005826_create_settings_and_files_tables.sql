/*
  # Create Settings and Character Files Tables

  1. New Tables
    - `app_settings`
      - `id` (uuid, primary key)
      - `setting_key` (text, unique) - setting name (e.g., 'simliFaceId', 'avatarDelay')
      - `setting_value` (jsonb) - setting value
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `character_files`
      - `id` (uuid, primary key)
      - `filename` (text) - original filename
      - `storage_path` (text) - path in Supabase Storage
      - `file_size` (integer) - size in bytes
      - `is_active` (boolean) - whether this is the currently active file
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Disable RLS on all tables (single-user application)
  
  3. Indexes
    - Add indexes for performance on frequently queried columns
*/

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create character_files table
CREATE TABLE IF NOT EXISTS character_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_size integer NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_character_files_active ON character_files(is_active) WHERE is_active = true;

-- Disable RLS on all tables (single-user app)
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE character_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys DISABLE ROW LEVEL SECURITY;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_character_files_updated_at ON character_files;
CREATE TRIGGER update_character_files_updated_at
  BEFORE UPDATE ON character_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
