-- Add topic tracking to uploads table
-- Run this in Supabase SQL Editor

-- Add topic_id column (optional - user can upload without specifying topic)
ALTER TABLE uploads 
ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;

-- Add subject column for quick reference (denormalized for convenience)
ALTER TABLE uploads 
ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add topic column for quick reference (denormalized for convenience)
ALTER TABLE uploads 
ADD COLUMN IF NOT EXISTS topic TEXT;

-- Add index for filtering uploads by topic
CREATE INDEX IF NOT EXISTS idx_uploads_topic_id ON uploads(topic_id);

-- Add index for filtering uploads by subject
CREATE INDEX IF NOT EXISTS idx_uploads_subject ON uploads(user_id, subject);

COMMENT ON COLUMN uploads.topic_id IS 'Reference to topics table - optional, user can specify which topic this file is for';
COMMENT ON COLUMN uploads.subject IS 'Denormalized subject name for quick access and n8n webhook payload';
COMMENT ON COLUMN uploads.topic IS 'Denormalized topic name for quick access and n8n webhook payload';
