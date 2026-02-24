// Timetable upload types - completely isolated from quiz upload types

export type TimetableUploadStatus =
    | 'uploaded'
    | 'processing'
    | 'needs_review'
    | 'confirmed'
    | 'failed';

/** A single class session extracted from the timetable */
export interface TimetableItem {
    day: string;      // Mon, Tue, Wed, Thu, Fri, Sat, Sun
    start: string;    // HH:MM (24h)
    end: string;      // HH:MM (24h)
    title: string;    // Class/subject name
    location: string; // Room, lab, etc.
}

/** timetable_uploads table row */
export interface TimetableUpload {
    id: string;
    user_id: string;
    file_path: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    status: TimetableUploadStatus;
    parsed_json: TimetableItem[] | null;
    semester_start_date: string | null; // YYYY-MM-DD
    weeks: number | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}

/** Input for creating a timetable upload record */
export interface CreateTimetableUploadInput {
    original_name: string;
    mime_type: string;
    size_bytes: number;
}

/** Result from creating a timetable upload */
export interface CreateTimetableUploadResult {
    upload_id: string;
    signed_url: string;
    file_path: string;
    error?: string;
}

/** Result from getting timetable upload status */
export interface TimetableUploadResult {
    data?: TimetableUpload;
    error?: string;
}

/**
 * Payload sent to the n8n ingest webhook for timetable parsing.
 * Matches the body keys that the Workflow Configuration node reads:
 *   $json.body.upload_id, $json.body.user_id, etc.
 */
export interface TimetableWebhookPayload {
    upload_id: string;
    user_id: string;
    file_name: string;
    file_path: string;
    mime_type: string;
    signed_url: string;
    purpose: 'timetable';
    // Not needed for timetable, but send empty/defaults to avoid n8n errors
    options: Record<string, unknown>;
    topic_id: string;
    quiz_id: string;
    topic_name: string;
}

/** Confirm payload: validated items + semester config */
export interface ConfirmTimetableInput {
    upload_id: string;
    items: TimetableItem[];
    semester_start_date: string; // YYYY-MM-DD (required)
    weeks: number;               // default 14, editable
}

// Supported timetable file types
export const TIMETABLE_SUPPORTED_MIMES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
] as const;

export const TIMETABLE_ACCEPTED_EXTENSIONS: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
};

export const TIMETABLE_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const VALID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type ValidDay = typeof VALID_DAYS[number];

/** Map day abbreviation to JS day-of-week (Mon=1 ... Sun=0) */
export const DAY_TO_WEEKDAY: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};
