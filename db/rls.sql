-- LiLearn Row Level Security Policies
-- Run this in Supabase SQL Editor AFTER schema.sql

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE USING (auth.uid() = id);

-- Topics policies
CREATE POLICY "Users can view own topics" ON topics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own topics" ON topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own topics" ON topics
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own topics" ON topics
  FOR DELETE USING (auth.uid() = user_id);

-- Availability policies
CREATE POLICY "Users can view own availability" ON availability
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own availability" ON availability
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own availability" ON availability
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own availability" ON availability
  FOR DELETE USING (auth.uid() = user_id);

-- Quizzes policies
CREATE POLICY "Users can view own quizzes" ON quizzes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quizzes" ON quizzes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quizzes" ON quizzes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own quizzes" ON quizzes
  FOR DELETE USING (auth.uid() = user_id);

-- Quiz questions policies (access via quiz ownership)
CREATE POLICY "Users can view questions of own quizzes" ON quiz_questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.user_id = auth.uid())
  );
CREATE POLICY "Users can insert questions to own quizzes" ON quiz_questions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.user_id = auth.uid())
  );
CREATE POLICY "Users can update questions of own quizzes" ON quiz_questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.user_id = auth.uid())
  );
CREATE POLICY "Users can delete questions of own quizzes" ON quiz_questions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.user_id = auth.uid())
  );

-- Quiz attempts policies
CREATE POLICY "Users can view own attempts" ON quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attempts" ON quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attempts" ON quiz_attempts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own attempts" ON quiz_attempts
  FOR DELETE USING (auth.uid() = user_id);

-- Plans policies
CREATE POLICY "Users can view own plans" ON plans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plans" ON plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON plans
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plans" ON plans
  FOR DELETE USING (auth.uid() = user_id);

-- Plan tasks policies (access via plan ownership)
CREATE POLICY "Users can view tasks of own plans" ON plan_tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_tasks.plan_id AND plans.user_id = auth.uid())
  );
CREATE POLICY "Users can insert tasks to own plans" ON plan_tasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_tasks.plan_id AND plans.user_id = auth.uid())
  );
CREATE POLICY "Users can update tasks of own plans" ON plan_tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_tasks.plan_id AND plans.user_id = auth.uid())
  );
CREATE POLICY "Users can delete tasks of own plans" ON plan_tasks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_tasks.plan_id AND plans.user_id = auth.uid())
  );

-- Habits policies
CREATE POLICY "Users can view own habits" ON habits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own habits" ON habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own habits" ON habits
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own habits" ON habits
  FOR DELETE USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
