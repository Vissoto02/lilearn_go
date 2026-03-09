// LiLearn Calendar Types

export type CalendarEventType = 'study_block' | 'deadline' | 'timetable_class' | 'assignment' | 'manual_study' | 'routine' | 'generated_plan';

export interface CalendarEvent {
    id: string;
    user_id: string;
    title: string;
    event_type: CalendarEventType;
    start_time: string | null;  // ISO string, null for deadlines
    end_time: string | null;    // ISO string (due date for deadlines)
    topic_id: string | null;
    color: string;
    description: string | null;
    location: string | null;
    source: string | null;
    is_locked: boolean;
    subject: string | null;
    recurrence_group: string | null;
    created_at: string;
    updated_at: string;
}

// Form input types for creating events
export interface CreateStudyBlockInput {
    title: string;
    start_time: string;  // ISO string
    end_time: string;    // ISO string
    topic_id?: string;
    color?: string;
    description?: string;
}

export interface CreateDeadlineInput {
    title: string;
    due_date: string;  // YYYY-MM-DD format
    topic_id?: string;
    color?: string;
    description?: string;
}

export interface UpdateEventInput {
    id: string;
    title?: string;
    start_time?: string;
    end_time?: string;
    topic_id?: string;
    color?: string;
    description?: string;
    location?: string;
    is_locked?: boolean;
}

export interface CreateManualScheduleInput {
    title: string;
    day_of_week: number;        // 0=Sunday, 1=Monday ... 6=Saturday
    start_time: string;         // HH:MM
    end_time: string;           // HH:MM
    activity_type: 'manual_study' | 'routine';
    subject?: string;
    topic?: string;
    color?: string;
    description?: string;
    location?: string;
    repeat_weeks: number;       // how many weeks to repeat (1 = this week only)
    start_date: string;         // YYYY-MM-DD – the first date to place the event
}

// For UI rendering - aggregated events for a single day
export interface DayEvents {
    date: Date;
    dateKey: string; // YYYY-MM-DD
    studyBlocks: CalendarEvent[];
    deadlines: CalendarEvent[];
    habitCheckin: boolean;
    habitMinutes: number;
}

export type CalendarFilter = 'all' | 'study_block' | 'deadline' | 'timetable_class' | 'assignment' | 'manual_study' | 'routine' | 'habit';

// API response types
export interface CalendarActionResult<T = CalendarEvent> {
    data?: T;
    error?: string;
    conflictWith?: string;
}

export interface CalendarQueryResult {
    data: CalendarEvent[];
    error?: string;
}

// Color presets for events
export const EVENT_COLORS = {
    study_block: [
        { name: 'Indigo', value: '#6366f1' },
        { name: 'Blue', value: '#3b82f6' },
        { name: 'Emerald', value: '#10b981' },
        { name: 'Purple', value: '#8b5cf6' },
        { name: 'Amber', value: '#f59e0b' },
    ],
    deadline: [
        { name: 'Red', value: '#ef4444' },
        { name: 'Orange', value: '#f97316' },
        { name: 'Pink', value: '#ec4899' },
    ],
    timetable_class: [
        { name: 'Teal', value: '#14b8a6' },
        { name: 'Cyan', value: '#06b6d4' },
        { name: 'Violet', value: '#8b5cf6' },
        { name: 'Amber', value: '#f59e0b' },
        { name: 'Rose', value: '#ec4899' },
    ],
    manual_study: [
        { name: 'Sky', value: '#0ea5e9' },
        { name: 'Indigo', value: '#6366f1' },
        { name: 'Emerald', value: '#10b981' },
        { name: 'Purple', value: '#8b5cf6' },
        { name: 'Amber', value: '#f59e0b' },
    ],
    routine: [
        { name: 'Slate', value: '#64748b' },
        { name: 'Stone', value: '#78716c' },
        { name: 'Zinc', value: '#71717a' },
        { name: 'Orange', value: '#f97316' },
        { name: 'Lime', value: '#84cc16' },
    ],
} as const;
