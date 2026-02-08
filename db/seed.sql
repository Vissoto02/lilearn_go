-- LiLearn Seed Data for Development
-- Run this after schema.sql and rls.sql

-- Note: To use this seed data, you need to:
-- 1. Create a test user via Supabase Auth
-- 2. Replace the UUID below with your test user's ID
-- 3. Run this SQL

-- Example user ID (replace with actual user ID from auth.users)
-- You can get this by signing up in the app and checking Supabase Auth dashboard

DO $$
DECLARE
  test_user_id UUID;
  test_quiz_id UUID;
  test_plan_id UUID;
BEGIN
  -- Get the first user from auth.users (for development)
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'No users found. Create a user first via the app signup.';
    RETURN;
  END IF;

  -- Seed topics
  INSERT INTO topics (user_id, subject, topic, difficulty_pref) VALUES
    (test_user_id, 'Mathematics', 'Algebra', 'medium'),
    (test_user_id, 'Mathematics', 'Calculus', 'hard'),
    (test_user_id, 'Mathematics', 'Statistics', 'easy'),
    (test_user_id, 'Physics', 'Mechanics', 'medium'),
    (test_user_id, 'Physics', 'Thermodynamics', 'hard'),
    (test_user_id, 'Computer Science', 'Data Structures', 'medium'),
    (test_user_id, 'Computer Science', 'Algorithms', 'hard')
  ON CONFLICT DO NOTHING;

  -- Seed availability (Mon-Fri, 6pm-9pm)
  INSERT INTO availability (user_id, day_of_week, start_time, end_time) VALUES
    (test_user_id, 1, '18:00', '21:00'),  -- Monday
    (test_user_id, 2, '18:00', '21:00'),  -- Tuesday
    (test_user_id, 3, '18:00', '21:00'),  -- Wednesday
    (test_user_id, 4, '18:00', '21:00'),  -- Thursday
    (test_user_id, 5, '18:00', '21:00'),  -- Friday
    (test_user_id, 6, '10:00', '16:00'),  -- Saturday
    (test_user_id, 0, '10:00', '16:00')   -- Sunday
  ON CONFLICT DO NOTHING;

  -- Seed a quiz
  INSERT INTO quizzes (id, user_id, subject, topic, difficulty)
  VALUES (gen_random_uuid(), test_user_id, 'Mathematics', 'Algebra', 'medium')
  RETURNING id INTO test_quiz_id;

  -- Seed quiz questions (using new simplified format)
  INSERT INTO quiz_questions (quiz_id, type, prompt, choices, answer_hash, correct_label, hint) VALUES
    (test_quiz_id, 'mcq', 'What is the value of x in: 2x + 5 = 15?', 
     '["3", "5", "7", "10"]',
     'b', 'B', 'Subtract 5 from both sides first'),
    (test_quiz_id, 'mcq', 'Simplify: 3(x + 2) - x', 
     '["2x + 6", "4x + 6", "2x + 2", "4x + 2"]',
     'a', 'A', 'Distribute first, then combine like terms'),
    (test_quiz_id, 'short_answer', 'If y = 2x - 3, what is y when x = 4?', 
     NULL, '5', NULL, 'Substitute x = 4 into the equation');

  -- Seed some quiz attempts with varying success
  INSERT INTO quiz_attempts (user_id, quiz_id, question_id, is_correct, attempts_count, time_spent_sec)
  SELECT 
    test_user_id, 
    test_quiz_id, 
    qq.id,
    (random() > 0.3), -- 70% chance of correct
    CASE WHEN random() > 0.5 THEN 1 ELSE 2 END,
    floor(random() * 60 + 30)::int
  FROM quiz_questions qq WHERE qq.quiz_id = test_quiz_id;

  -- Seed a study plan for current week
  INSERT INTO plans (id, user_id, week_start_date)
  VALUES (gen_random_uuid(), test_user_id, date_trunc('week', CURRENT_DATE)::date)
  RETURNING id INTO test_plan_id;

  -- Seed plan tasks
  INSERT INTO plan_tasks (plan_id, title, subject, topic, start_datetime, duration_min, status) VALUES
    (test_plan_id, 'Review Algebra basics', 'Mathematics', 'Algebra', 
     date_trunc('week', CURRENT_DATE) + INTERVAL '1 day' + INTERVAL '18 hours', 45, 'done'),
    (test_plan_id, 'Practice Calculus problems', 'Mathematics', 'Calculus', 
     date_trunc('week', CURRENT_DATE) + INTERVAL '2 days' + INTERVAL '18 hours', 60, 'done'),
    (test_plan_id, 'Study Data Structures', 'Computer Science', 'Data Structures', 
     date_trunc('week', CURRENT_DATE) + INTERVAL '3 days' + INTERVAL '18 hours', 45, 'todo'),
    (test_plan_id, 'Mechanics review', 'Physics', 'Mechanics', 
     date_trunc('week', CURRENT_DATE) + INTERVAL '4 days' + INTERVAL '18 hours', 45, 'todo'),
    (test_plan_id, 'Algorithm practice', 'Computer Science', 'Algorithms', 
     date_trunc('week', CURRENT_DATE) + INTERVAL '5 days' + INTERVAL '10 hours', 90, 'todo');

  -- Seed habits for last 7 days
  INSERT INTO habits (user_id, date, studied_minutes, checkin) VALUES
    (test_user_id, CURRENT_DATE - INTERVAL '6 days', 45, true),
    (test_user_id, CURRENT_DATE - INTERVAL '5 days', 60, true),
    (test_user_id, CURRENT_DATE - INTERVAL '4 days', 30, true),
    (test_user_id, CURRENT_DATE - INTERVAL '3 days', 0, false),
    (test_user_id, CURRENT_DATE - INTERVAL '2 days', 90, true),
    (test_user_id, CURRENT_DATE - INTERVAL '1 day', 45, true),
    (test_user_id, CURRENT_DATE, 0, false)
  ON CONFLICT (user_id, date) DO NOTHING;

  RAISE NOTICE 'Seed data created successfully for user: %', test_user_id;
END $$;
