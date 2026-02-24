-- ============================================================================
-- TIMETABLE UPLOADS TABLE
-- Run this in Supabase SQL Editor AFTER schema.sql and calendar_schema.sql
-- ============================================================================

-- Timetable Uploads table (completely separate from quiz uploads)
CREATE TABLE IF NOT EXISTS timetable_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- File info
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),

  -- Processing status
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded',       -- File uploaded to storage, not yet sent to n8n
    'processing',     -- n8n is parsing the timetable
    'needs_review',   -- Parsed data ready for user review
    'confirmed',      -- User confirmed, events inserted into calendar
    'failed'          -- Processing failed
  )),

  -- Parsed timetable data from n8n (array of items)
  parsed_json JSONB,

  -- Semester configuration (set by user at confirm time)
  semester_start_date DATE,
  weeks INTEGER DEFAULT 14,

  -- Error details
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_timetable_uploads_user_id ON timetable_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_timetable_uploads_user_status ON timetable_uploads(user_id, status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE timetable_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own timetable uploads" ON timetable_uploads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own timetable uploads" ON timetable_uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own timetable uploads" ON timetable_uploads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own timetable uploads" ON timetable_uploads
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_timetable_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER timetable_uploads_updated_at
  BEFORE UPDATE ON timetable_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_timetable_uploads_updated_at();

-- ============================================================================
-- CALENDAR EVENTS: Relax event_type constraint to support timetable_class
-- ============================================================================
-- Drop the old constraint and add a new one that includes 'timetable_class'
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_event_type_check
  CHECK (event_type IN ('study_block', 'deadline', 'timetable_class'));

-- Update the valid_time_range constraint to also allow timetable_class
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS valid_time_range;
ALTER TABLE calendar_events ADD CONSTRAINT valid_time_range CHECK (
  (event_type = 'deadline') OR
  (event_type IN ('study_block', 'timetable_class') AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
);

-- Add source column to calendar_events for tracking where events came from
-- e.g. 'timetable:<timetable_upload_id>'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'source'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN source TEXT;
  END IF;
END $$;

-- Add location column to calendar_events for timetable class locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'location'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN location TEXT;
  END IF;
END $$;

-- ============================================================================
-- STORAGE: Update uploads bucket to support timetable file types
-- ============================================================================

-- Add image/png and image/jpeg to allowed MIME types
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg'
]
WHERE id = 'uploads';

-- ============================================================================
-- STORAGE RLS: Allow timetable uploads under timetables/{user_id}/...
-- The existing policies only check (foldername)[1] = user_id, which works for
-- quiz uploads like {user_id}/file.pdf but NOT for timetables/{user_id}/file.pdf.
-- We add new policies that also allow the timetables/ subfolder structure.
-- ============================================================================

-- Drop and recreate upload policy to handle both folder structures
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads' AND (
    -- Quiz uploads: {user_id}/...
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Timetable uploads: timetables/{user_id}/...
    ((storage.foldername(name))[1] = 'timetables' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
);

DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    ((storage.foldername(name))[1] = 'timetables' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
);

DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    ((storage.foldername(name))[1] = 'timetables' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
);

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    ((storage.foldername(name))[1] = 'timetables' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
);
