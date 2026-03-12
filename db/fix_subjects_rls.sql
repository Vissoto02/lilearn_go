-- Fix: Add RLS policies for the "subjects" table.
-- The migration_subjects_topics.sql created the table but never added RLS policies,
-- so all user-level inserts/updates/deletes were being blocked.

-- 1. Enable RLS (safe to re-run; does nothing if already enabled)
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any (to make this script idempotent)
DROP POLICY IF EXISTS "Users can view own subjects" ON subjects;
DROP POLICY IF EXISTS "Users can insert own subjects" ON subjects;
DROP POLICY IF EXISTS "Users can update own subjects" ON subjects;
DROP POLICY IF EXISTS "Users can delete own subjects" ON subjects;

-- 3. Create standard user-scoped RLS policies
CREATE POLICY "Users can view own subjects" ON subjects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subjects" ON subjects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subjects" ON subjects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subjects" ON subjects
  FOR DELETE USING (auth.uid() = user_id);
