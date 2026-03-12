-- Backfill user_stats for existing users who registered BEFORE the gamification schema
-- Run this ONCE in Supabase SQL Editor after gamification_schema.sql

INSERT INTO user_stats (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_stats)
ON CONFLICT (user_id) DO NOTHING;
