-- Migration: Add manual scheduling support to calendar_events
-- Run this in Supabase SQL Editor
-- Date: 2026-03-08

-- ============================================================================
-- 1. Add new columns for manual scheduling
-- ============================================================================

-- is_locked: prevents AI planner from modifying/moving the event
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'is_locked'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- subject: the subject name for the event (e.g. "Mathematics", "Physics")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'subject'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN subject TEXT;
  END IF;
END $$;

-- recurrence_group: UUID grouping all recurring instances of the same event
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'recurrence_group'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN recurrence_group UUID;
  END IF;
END $$;

-- ============================================================================
-- 2. Extend event_type CHECK constraint to include manual_study and routine
-- ============================================================================

ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_event_type_check
  CHECK (event_type IN ('study_block', 'deadline', 'timetable_class', 'assignment', 'manual_study', 'routine'));

-- ============================================================================
-- 3. Update valid_time_range to allow new event types
-- ============================================================================

ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS valid_time_range;
ALTER TABLE calendar_events ADD CONSTRAINT valid_time_range CHECK (
  (event_type = 'deadline') OR
  (event_type = 'assignment' AND end_time IS NOT NULL) OR
  (event_type IN ('study_block', 'timetable_class', 'manual_study', 'routine') AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
);

-- ============================================================================
-- 4. Index for recurrence_group lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence_group ON calendar_events(recurrence_group)
  WHERE recurrence_group IS NOT NULL;
