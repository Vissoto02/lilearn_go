-- ============================================================================
-- STORAGE BUCKET SETUP FOR UPLOADS
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Create the uploads storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  false,  -- Private bucket
  10485760,  -- 10MB limit
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS Policies
-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Service role can access all files (for n8n)
CREATE POLICY "Service role can manage all files"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'uploads')
WITH CHECK (bucket_id = 'uploads');
