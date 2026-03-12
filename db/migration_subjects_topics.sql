-- 1. Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- 2. Add subject_id to topics
ALTER TABLE topics ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE;

-- 3. Migrate existing subjects from topics into the new subjects table
INSERT INTO subjects (user_id, name)
SELECT DISTINCT user_id, subject FROM topics WHERE subject IS NOT NULL AND subject != ''
ON CONFLICT (user_id, name) DO NOTHING;

-- 4. Map back the new subject_id into the topics table
UPDATE topics t
SET subject_id = s.id
FROM subjects s
WHERE t.user_id = s.user_id AND t.subject = s.name AND t.subject_id IS NULL;
