/*
  # Create Storage Bucket for Character Files

  1. Storage Setup
    - Create `character-files` bucket
    - Set to non-public (private)
    - Configure file size limit (100KB)
    - Allow only .txt files

  2. Security
    - Allow all operations for simplicity (single-user app)
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'character-files',
  'character-files',
  false,
  102400, -- 100KB in bytes
  ARRAY['text/plain']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policy if it exists and create new one
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow all operations on character-files" ON storage.objects;
  
  CREATE POLICY "Allow all operations on character-files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'character-files');
END $$;
