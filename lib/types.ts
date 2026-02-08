// LiLearn TypeScript Types
// Mirrors the database schema for type-safe Supabase queries

export type Difficulty = 'easy' | 'medium' | 'hard';
export type TaskStatus = 'todo' | 'done' | 'skipped';
export type QuestionType = 'mcq' | 'short_answer';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface Profile {
    id: string;
    name: string | null;
    timezone: string;
    created_at: string;
}

export interface Topic {
    id: string;
    user_id: string;
    subject: string;
    topic: string;
    difficulty_pref: Difficulty;
    created_at: string;
}

export interface Availability {
    id: string;
    user_id: string;
    day_of_week: number; // 0-6, Sunday = 0
    start_time: string; // HH:MM format
    end_time: string;
    created_at: string;
}

export interface Quiz {
    id: string;
    user_id: string;
    subject: string;
    topic: string;
    difficulty: Difficulty;
    created_at: string;
}

export interface QuizChoice {
    label: string; // A, B, C, D
    text: string;
}

export interface QuizQuestion {
    id: string;
    quiz_id: string;
    type: QuestionType;
    prompt: string;
    // Support both formats:
    // - New: ["answer text A", "answer text B", "answer text C", "answer text D"]
    // - Legacy: [{label: "A", text: "..."}, {label: "B", text: "..."}, ...]
    choices: string[] | QuizChoice[] | null;
    answer_hash: string | null;
    hint: string | null;
    correct_label?: string | null; // 'A', 'B', 'C', or 'D' - added via uploads_schema.sql
    created_at: string;
}

export interface QuizAttempt {
    id: string;
    user_id: string;
    quiz_id: string;
    question_id: string;
    is_correct: boolean;
    attempts_count: number;
    time_spent_sec: number | null;
    created_at: string;
}

export interface Plan {
    id: string;
    user_id: string;
    week_start_date: string; // YYYY-MM-DD format
    created_at: string;
}

export interface PlanTask {
    id: string;
    plan_id: string;
    title: string;
    subject: string | null;
    topic: string | null;
    start_datetime: string;
    duration_min: number;
    status: TaskStatus;
    created_at: string;
}

export interface Habit {
    id: string;
    user_id: string;
    date: string; // YYYY-MM-DD format
    studied_minutes: number;
    checkin: boolean;
    created_at: string;
}

export interface Notification {
    id: string;
    user_id: string;
    type: string;
    scheduled_at: string;
    status: NotificationStatus;
    created_at: string;
}

// Computed/derived types for UI
export interface TopicWeakness {
    subject: string;
    topic: string;
    accuracy: number; // 0-100
    totalAttempts: number;
    correctAttempts: number;
}

export interface StreakData {
    currentStreak: number;
    longestStreak: number;
    totalDays: number;
    last7Days: DayStatus[];
}

export interface DayStatus {
    date: string;
    checkin: boolean;
    minutes: number;
}

// Form input types
export interface CreateTopicInput {
    subject: string;
    topic: string;
    difficulty_pref?: Difficulty;
}

export interface UpdateTopicInput {
    id: string;
    subject?: string;
    topic?: string;
    difficulty_pref?: Difficulty;
}

export interface CreateQuizInput {
    subject: string;
    topic: string;
    difficulty: Difficulty;
    questionCount?: number;
}

export interface RecordAttemptInput {
    quiz_id: string;
    question_id: string;
    is_correct: boolean;
    attempts_count: number;
    time_spent_sec?: number;
}

export interface SetAvailabilityInput {
    day_of_week: number;
    start_time: string;
    end_time: string;
}

export interface CheckInInput {
    date: string;
    studied_minutes: number;
}

export interface GeneratePlanInput {
    weekStartDate: string;
    targetHoursPerWeek: number;
}

// Database response types (for Supabase queries)
export type Tables = {
    profiles: Profile;
    topics: Topic;
    availability: Availability;
    quizzes: Quiz;
    quiz_questions: QuizQuestion;
    quiz_attempts: QuizAttempt;
    plans: Plan;
    plan_tasks: PlanTask;
    habits: Habit;
    notifications: Notification;
};
