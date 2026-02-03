// LiLearn Calendar Types

export type CalendarEventType = 'study_block' | 'deadline';

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

export type CalendarFilter = 'all' | 'study_block' | 'deadline' | 'habit';

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
} as const;
