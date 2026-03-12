-- ============================================================================
-- GAMIFICATION SCHEMA
-- Run this in Supabase SQL Editor AFTER schema.sql and calendar_schema.sql
-- ============================================================================

-- ============================================================================
-- 1. USER STATS TABLE
-- Stores cumulative gamification data per user
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT 'Amateur' CHECK (title IN ('Amateur', 'Scholar', 'Study Master')),
  best_improvement_pct NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. REVISION SESSIONS TABLE
-- Tracks each revision session tied to a study_block calendar event
-- ============================================================================
CREATE TABLE IF NOT EXISTS revision_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,

  -- What is being studied
  subject TEXT NOT NULL,
  topic TEXT,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,

  -- Weak subject flagging
  is_weak_subject BOOLEAN NOT NULL DEFAULT FALSE,

  -- Session lifecycle
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,

  -- Validation outcome
  validation_type TEXT CHECK (validation_type IN ('quiz', 'file_upload')),
  validation_quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  validation_score NUMERIC,
  points_earned INTEGER NOT NULL DEFAULT 0,
  is_personal_best BOOLEAN NOT NULL DEFAULT FALSE,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'validating', 'completed', 'expired', 'skipped')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. FILE VALIDATIONS TABLE
-- For Path B: file upload proof when no quiz exists for the topic
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES revision_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- File info (stored in existing 'uploads' bucket)
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),

  -- Study note (minimum 50 characters enforced in app)
  note TEXT NOT NULL,

  -- Points
  points_earned INTEGER NOT NULL DEFAULT 30,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_stats_points ON user_stats(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_user_id ON revision_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_status ON revision_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_calendar ON revision_sessions(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_file_validations_session ON file_validations(session_id);
CREATE INDEX IF NOT EXISTS idx_file_validations_user ON file_validations(user_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

-- user_stats: all authenticated users can read (for leaderboard), only own user can write
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user stats" ON user_stats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own stats" ON user_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats" ON user_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- revision_sessions: standard user-scoped
ALTER TABLE revision_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON revision_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON revision_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON revision_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON revision_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- file_validations: standard user-scoped
ALTER TABLE file_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own file validations" ON file_validations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own file validations" ON file_validations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own file validations" ON file_validations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own file validations" ON file_validations
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 6. LEADERBOARD VIEW
-- Provides ranked user stats for daily/weekly/all-time boards
-- ============================================================================

-- All-time leaderboard (simple view on user_stats)
CREATE OR REPLACE VIEW leaderboard_all_time AS
SELECT
  us.user_id,
  COALESCE(p.name, 'Anonymous') AS display_name,
  us.total_points,
  us.title,
  RANK() OVER (ORDER BY us.total_points DESC) AS rank
FROM user_stats us
LEFT JOIN profiles p ON p.id = us.user_id
WHERE us.total_points > 0;

-- Daily leaderboard: points earned today
CREATE OR REPLACE VIEW leaderboard_daily AS
SELECT
  rs.user_id,
  COALESCE(p.name, 'Anonymous') AS display_name,
  SUM(rs.points_earned) AS total_points,
  us.title,
  RANK() OVER (ORDER BY SUM(rs.points_earned) DESC) AS rank
FROM revision_sessions rs
LEFT JOIN profiles p ON p.id = rs.user_id
LEFT JOIN user_stats us ON us.user_id = rs.user_id
WHERE rs.status = 'completed'
  AND rs.ended_at >= CURRENT_DATE
  AND rs.ended_at < CURRENT_DATE + INTERVAL '1 day'
GROUP BY rs.user_id, p.name, us.title
HAVING SUM(rs.points_earned) > 0;

-- Weekly leaderboard: points earned this week (Monday start)
CREATE OR REPLACE VIEW leaderboard_weekly AS
SELECT
  rs.user_id,
  COALESCE(p.name, 'Anonymous') AS display_name,
  SUM(rs.points_earned) AS total_points,
  us.title,
  RANK() OVER (ORDER BY SUM(rs.points_earned) DESC) AS rank
FROM revision_sessions rs
LEFT JOIN profiles p ON p.id = rs.user_id
LEFT JOIN user_stats us ON us.user_id = rs.user_id
WHERE rs.status = 'completed'
  AND rs.ended_at >= date_trunc('week', CURRENT_DATE)
  AND rs.ended_at < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
GROUP BY rs.user_id, p.name, us.title
HAVING SUM(rs.points_earned) > 0;

-- ============================================================================
-- 7. UPDATED_AT TRIGGER FOR user_stats
-- ============================================================================
CREATE OR REPLACE FUNCTION update_user_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_stats_updated_at ON user_stats;
CREATE TRIGGER user_stats_updated_at
  BEFORE UPDATE ON user_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_updated_at();

-- ============================================================================
-- 8. HELPER: Auto-initialize user_stats on first login
-- Extends the existing handle_new_user trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));

  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger already exists on auth.users, so updating the function is enough.
-- No need to re-create the trigger.
