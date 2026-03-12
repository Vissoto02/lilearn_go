-- Migration: Add 'generated_plan' event type to calendar_events
-- Run this in Supabase SQL Editor after the other calendar migrations.
-- Date: 2026-03-12

-- ============================================================================
-- 1. Extend event_type CHECK constraint to include generated_plan
-- ============================================================================

ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_event_type_check
  CHECK (
    event_type IN (
      'study_block',
      'deadline',
      'timetable_class',
      'assignment',
      'manual_study',
      'routine',
      'generated_plan'
    )
  );

-- ============================================================================
-- 2. Update valid_time_range to treat generated_plan like other study sessions
-- ============================================================================

ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS valid_time_range;

ALTER TABLE calendar_events
  ADD CONSTRAINT valid_time_range CHECK (
    (event_type = 'deadline') OR
    (event_type = 'assignment' AND end_time IS NOT NULL) OR
    (event_type IN ('study_block', 'timetable_class', 'manual_study', 'routine', 'generated_plan')
      AND start_time IS NOT NULL
      AND end_time IS NOT NULL
      AND start_time < end_time)
  );

