// Upload types for file upload and quiz generation pipeline

export type UploadStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';

export type SupportedMimeType =
    | 'application/pdf'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export interface QuizGenerationOptions {
    difficulty: 'easy' | 'medium' | 'hard';
    question_count: number;
    question_types: ('mcq' | 'short_answer' | 'tf' | 'fill')[];
    question_type?: 'mcq' | 'tf' | 'fill';
}

export interface Upload {
    id: string;
    user_id: string;
    file_path: string;
    original_name: string;
    mime_type: SupportedMimeType;
    size_bytes: number;
    status: UploadStatus;
    error_message: string | null;
    quiz_id: string | null;
    options: QuizGenerationOptions;
    created_at: string;
    updated_at: string;
}

// Input types for server actions
export interface CreateUploadInput {
    original_name: string;
    mime_type: SupportedMimeType;
    size_bytes: number;
    options?: Partial<QuizGenerationOptions>;
}

export interface ConfirmUploadInput {
    upload_id: string;
}

// Response types
export interface CreateUploadResult {
    upload_id: string;
    signed_url: string;
    file_path: string;
    error?: string;
}

export interface UploadActionResult {
    data?: Upload;
    error?: string;
}

// n8n webhook payload - matches ingest_upload_webhook workflow expectations
export interface N8nWebhookPayload {
    upload_id: string;
    user_id: string;
    file_name: string;
    file_path: string;
    mime_type: string;
    signed_url: string;
    options: QuizGenerationOptions;
    // Quiz and topic IDs - created before sending to n8n
    topic_id: string;
    topic_name: string;
    quiz_id: string;
    // Supabase connection details for n8n to update status
    supabase_url: string;
    supabase_service_key: string;
}

// Supported file extensions
export const SUPPORTED_EXTENSIONS: Record<string, SupportedMimeType> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export const MIME_TYPE_LABELS: Record<SupportedMimeType, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
};

// Limits
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE_LABEL = '10MB';

// Default options
export const DEFAULT_QUIZ_OPTIONS: QuizGenerationOptions = {
    difficulty: 'medium',
    question_count: 10,
    question_types: ['mcq'],
};
