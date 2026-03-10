-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_daily_insight_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors on reapplying
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;

CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create ai_daily_insight table
CREATE TABLE IF NOT EXISTS ai_daily_insight (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weak_subject TEXT,
  weak_topic TEXT,
  accuracy NUMERIC,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for ai_daily_insight
ALTER TABLE ai_daily_insight ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own insights" ON ai_daily_insight;
DROP POLICY IF EXISTS "Users can insert their own insights" ON ai_daily_insight;

CREATE POLICY "Users can view their own insights"
  ON ai_daily_insight FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own insights"
  ON ai_daily_insight FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for daily check
CREATE INDEX IF NOT EXISTS idx_ai_daily_insight_user_date ON ai_daily_insight(user_id, created_at);
