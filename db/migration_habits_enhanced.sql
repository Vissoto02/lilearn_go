-- ============================================================================
-- ENHANCED HABITS TABLE MIGRATION
-- Adds study_type and notes fields to support Quick Study Log
-- Run this in Supabase SQL Editor AFTER schema.sql
-- ============================================================================

-- Add study_type column (revision, practice_quiz, notes_review, assignment)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS study_type TEXT 
  CHECK (study_type IN ('revision', 'practice_quiz', 'notes_review', 'assignment'));

-- Add subject reference (optional)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add topic reference (optional)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS topic TEXT;

-- Add reflection note (optional)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS note TEXT;
