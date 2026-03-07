-- Migration: Support True/False and Fill-in-the-Blank question types
-- Run this in Supabase SQL Editor
-- Date: 2026-03-04

-- ============================================================================
-- 1. Update quiz_questions.type CHECK constraint
--    Old: only 'mcq', 'short_answer'
--    New: adds 'tf' (True/False) and 'fill' (Fill-in-the-Blank)
-- ============================================================================

-- Drop the old constraint
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_type_check;

-- Add the new constraint with all question types
ALTER TABLE quiz_questions
ADD CONSTRAINT quiz_questions_type_check
CHECK (type IN ('mcq', 'short_answer', 'tf', 'fill'));

-- ============================================================================
-- 2. Update correct_label CHECK constraint
--    Old: only 'A','B','C','D' (MCQ only)
--    New: allow any text value (True/False uses 'True'/'False',
--         Fill-in-Blank uses the answer word/phrase)
-- ============================================================================

-- Drop the old constraint
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_correct_label_chk;

-- No new constraint needed — correct_label can be any text or null
-- MCQ: 'A', 'B', 'C', 'D'
-- True/False: 'True', 'False'
-- Fill-in-Blank: the primary correct answer (e.g., 'authentication')

-- ============================================================================
-- 3. Add comment for answer_hash field documentation
--    answer_hash stores different data per type:
--    - MCQ: lowercase letter 'a','b','c','d'
--    - True/False: 'true' or 'false'
--    - Fill-in-Blank: JSON string {"correct_answers": [...], "required_keywords": [...]}
-- ============================================================================

COMMENT ON COLUMN quiz_questions.answer_hash IS
'Stores answer verification data. Format varies by type:
  MCQ: lowercase letter (a/b/c/d)
  True/False: "true" or "false"
  Fill-in-Blank: JSON {"correct_answers": [...], "required_keywords": [...]}';

COMMENT ON COLUMN quiz_questions.correct_label IS
'Human-readable correct answer label. Format varies by type:
  MCQ: uppercase letter (A/B/C/D)
  True/False: "True" or "False"
  Fill-in-Blank: the primary correct answer text';

COMMENT ON COLUMN quiz_questions.choices IS
'Answer choices stored as JSONB. Format varies by type:
  MCQ: ["choice A", "choice B", "choice C", "choice D"]
  True/False: ["True", "False"]
  Fill-in-Blank: null (no choices, user types answer)';

-- ============================================================================
-- 4. Add question_type column to quizzes table
--    So the quiz card can show what type of quiz it is
-- ============================================================================

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'mcq'
CHECK (question_type IN ('mcq', 'tf', 'fill'));
