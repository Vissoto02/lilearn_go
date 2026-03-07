-- Upload & Generate Quiz Schema
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STORAGE BUCKET SETUP (run in Supabase Dashboard > Storage)
-- ============================================================================
-- 1. Create bucket named "uploads" with private access
-- 2. Set file size limit to 10MB
-- 3. Allow mime types: application/pdf, 
--    application/vnd.openxmlformats-officedocument.wordprocessingml.document,
--    application/vnd.openxmlformats-officedocument.presentationml.presentation

-- ============================================================================
-- UPLOADS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- File info
  file_path TEXT NOT NULL,           -- Storage path: {user_id}/{upload_id}/{filename}
  original_name TEXT NOT NULL,        -- Original filename for display
  mime_type TEXT NOT NULL CHECK (mime_type IN (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )),
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760), -- Max 10MB
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Record created, awaiting file upload
    'uploading',    -- File being uploaded to storage
    'processing',   -- n8n is processing the file
    'completed',    -- Quiz generated successfully
    'failed'        -- Processing failed
  )),
  error_message TEXT,                 -- Error details if failed
  
  -- Generated quiz reference
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  
  -- Quiz generation options
  options JSONB DEFAULT '{
    "difficulty": "medium",
    "question_count": 10,
    "question_types": ["mcq"]
  }'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


alter table quizzes add column upload_id uuid;

create unique index if not exists quizzes_upload_id_unique
on quizzes(upload_id)
where upload_id is not null;


alter table quiz_questions add column if not exists correct_label text;
-- Note: correct_label allows any text value:
--   MCQ: 'A', 'B', 'C', 'D'
--   True/False: 'True', 'False'
--   Fill-in-Blank: primary correct answer text
-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_user_status ON uploads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(user_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

-- Users can view their own uploads
CREATE POLICY "Users can view own uploads" ON uploads
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own uploads
CREATE POLICY "Users can insert own uploads" ON uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own uploads (for status during upload)
CREATE POLICY "Users can update own pending uploads" ON uploads
  FOR UPDATE USING (auth.uid() = user_id AND status IN ('pending', 'uploading'));

-- Users can delete their own uploads
CREATE POLICY "Users can delete own uploads" ON uploads
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- SERVICE ROLE ACCESS (for n8n webhook)
-- ============================================================================
-- Note: Service role bypasses RLS automatically
-- n8n should use SUPABASE_SERVICE_ROLE_KEY to:
--   1. Update upload status to 'completed' or 'failed'
--   2. Set quiz_id after creating quiz
--   3. Set error_message on failure

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER uploads_updated_at
  BEFORE UPDATE ON uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_uploads_updated_at();
