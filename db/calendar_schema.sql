-- LiLearn Calendar Events Schema
-- Run this in Supabase SQL Editor AFTER schema.sql

-- Calendar Events Table
-- Stores study blocks and deadlines
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('study_block', 'deadline')),
  
  -- For study_block: start/end datetime
  -- For deadline: start_time IS NULL, end_time stores due datetime
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  
  -- Optional associations
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  
  -- Styling
  color TEXT DEFAULT '#6366f1',
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_time_range CHECK (
    (event_type = 'deadline') OR 
    (event_type = 'study_block' AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(user_id, event_type);

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own calendar events" ON calendar_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calendar events" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calendar events" ON calendar_events
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own calendar events" ON calendar_events
  FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for n8n webhook access
-- The service role key automatically bypasses RLS, so n8n can use it to manipulate data
-- Make sure to use SUPABASE_SERVICE_ROLE_KEY in your n8n HTTP node
