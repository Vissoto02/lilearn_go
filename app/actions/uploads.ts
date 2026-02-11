'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
    Upload,
    CreateUploadInput,
    CreateUploadResult,
    UploadActionResult,
    N8nWebhookPayload,
    QuizGenerationOptions,
    SupportedMimeType,
    DEFAULT_QUIZ_OPTIONS,
    MAX_FILE_SIZE_BYTES,
    SUPPORTED_EXTENSIONS,
} from '@/lib/uploads/types';

// Placeholder webhook secret - replace with env variable
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || 'lilearn-webhook-secret-2026';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';

// ============================================================================
// Validation helpers
// ============================================================================

function isValidMimeType(mimeType: string): mimeType is SupportedMimeType {
    return [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ].includes(mimeType);
}

function validateFileSize(sizeBytes: number): boolean {
    return sizeBytes > 0 && sizeBytes <= 10 * 1024 * 1024; // 10MB
}

// ============================================================================
// createUpload: Create DB record and return signed upload URL
// ============================================================================

export async function createUpload(
    input: CreateUploadInput
): Promise<CreateUploadResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { upload_id: '', signed_url: '', file_path: '', error: 'Unauthorized' };
    }

    // Validate inputs
    if (!isValidMimeType(input.mime_type)) {
        return { upload_id: '', signed_url: '', file_path: '', error: 'Unsupported file type' };
    }

    if (!validateFileSize(input.size_bytes)) {
        return { upload_id: '', signed_url: '', file_path: '', error: 'File size must be between 1 byte and 10MB' };
    }

    // Generate upload ID first for file path
    const uploadId = crypto.randomUUID();

    // Sanitize filename
    const sanitizedName = input.original_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/${uploadId}/${sanitizedName}`;

    // Merge options with defaults
    const options: QuizGenerationOptions = {
        difficulty: input.options?.difficulty || 'medium',
        question_count: input.options?.question_count || 10,
        question_types: input.options?.question_types || ['mcq'],
    };

    // Create signed upload URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('uploads')
        .createSignedUploadUrl(filePath);

    if (signedUrlError || !signedUrlData) {
        console.error('Failed to create signed URL:', signedUrlError);
        return { upload_id: '', signed_url: '', file_path: '', error: 'Failed to create upload URL' };
    }

    // Insert upload record
    const { error: insertError } = await supabase
        .from('uploads')
        .insert({
            id: uploadId,
            user_id: user.id,
            file_path: filePath,
            original_name: input.original_name,
            mime_type: input.mime_type,
            size_bytes: input.size_bytes,
            status: 'pending',
            options,
        });

    if (insertError) {
        console.error('Failed to insert upload record:', insertError);
        return { upload_id: '', signed_url: '', file_path: '', error: 'Failed to create upload record' };
    }

    return {
        upload_id: uploadId,
        signed_url: signedUrlData.signedUrl,
        file_path: filePath,
    };
}

// ============================================================================
// confirmUpload: Verify file exists, trigger n8n webhook
// ============================================================================

export async function confirmUpload(uploadId: string): Promise<UploadActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    // Fetch upload record
    const { data: upload, error: fetchError } = await supabase
        .from('uploads')
        .select('*')
        .eq('id', uploadId)
        .eq('user_id', user.id)
        .single();

    if (fetchError || !upload) {
        return { error: 'Upload not found' };
    }

    if (upload.status !== 'pending') {
        return { error: `Invalid status: ${upload.status}` };
    }

    // Update status to uploading
    await supabase
        .from('uploads')
        .update({ status: 'uploading' })
        .eq('id', uploadId);

    // Verify file exists in storage
    const { data: fileData, error: fileError } = await supabase.storage
        .from('uploads')
        .list(upload.file_path.split('/').slice(0, -1).join('/'));

    const fileName = upload.file_path.split('/').pop();
    const fileExists = fileData?.some(f => f.name === fileName);

    if (fileError || !fileExists) {
        await supabase
            .from('uploads')
            .update({ status: 'failed', error_message: 'File not found in storage' })
            .eq('id', uploadId);
        return { error: 'File not found in storage' };
    }

    // Generate signed download URL for n8n (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('uploads')
        .createSignedUrl(upload.file_path, 3600);

    if (signedUrlError || !signedUrlData) {
        await supabase
            .from('uploads')
            .update({ status: 'failed', error_message: 'Failed to generate download URL' })
            .eq('id', uploadId);
        return { error: 'Failed to generate download URL' };
    }

    // Extract subject and topic from filename
    // Example: "Topic 9 DIT1233 IP SECURITY.pdf" -> subject: "DIT1233", topic: "Topic 9 IP SECURITY"
    const fileNameWithoutExt = upload.original_name.replace(/\.[^/.]+$/, ''); // Remove extension

    // Try to extract subject code (e.g., DIT1233, CSC101, etc.)
    const subjectMatch = fileNameWithoutExt.match(/\b[A-Z]{2,4}\d{3,4}\b/);
    const subject = subjectMatch ? subjectMatch[0] : 'General';
    const topic = fileNameWithoutExt;

    // Create topic record first
    const { data: topicRecord, error: topicError } = await supabase
        .from('topics')
        .insert({
            user_id: upload.user_id,
            subject: subject,
            topic: topic,
            difficulty_pref: upload.options.difficulty,
        })
        .select()
        .single();

    if (topicError || !topicRecord) {
        console.error('Failed to create topic:', topicError);
        await supabase
            .from('uploads')
            .update({ status: 'failed', error_message: `Failed to create topic: ${topicError?.message || 'Unknown error'}` })
            .eq('id', uploadId);
        return { error: `Failed to create topic: ${topicError?.message || 'Unknown error'}` };
    }

    // NOTE: We do NOT create the quiz record here anymore.
    // n8n will create it when questions are ready, so empty quizzes don't appear in the list.

    // Prepare n8n webhook payload - matches ingest_upload_webhook expectations
    const webhookPayload: N8nWebhookPayload = {
        upload_id: upload.id,
        user_id: upload.user_id,
        file_name: upload.original_name,
        file_path: upload.file_path,
        mime_type: upload.mime_type,
        signed_url: signedUrlData.signedUrl,
        options: upload.options as QuizGenerationOptions,
        topic_id: topicRecord.id,
        topic_name: topic,
        quiz_id: '', // n8n will create the quiz and update the upload record
        // Include Supabase connection details for n8n
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    };

    // Call n8n webhook
    if (N8N_WEBHOOK_URL) {
        try {
            const response = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-n8n-secret': N8N_WEBHOOK_SECRET,
                },
                body: JSON.stringify(webhookPayload),
            });

            if (!response.ok) {
                throw new Error(`Webhook returned ${response.status}`);
            }
        } catch (err) {
            console.error('n8n webhook call failed:', err);
            // Don't fail the upload - n8n might be temporarily unavailable
            // Mark as processing and let n8n retry or user retry later
        }
    }

    // Update status to processing
    const { data: updatedUpload, error: updateError } = await supabase
        .from('uploads')
        .update({ status: 'processing' })
        .eq('id', uploadId)
        .select()
        .single();

    if (updateError) {
        return { error: 'Failed to update status' };
    }

    revalidatePath('/app');
    revalidatePath('/app/planner');

    return { data: updatedUpload };
}

// ============================================================================
// getUploadStatus: Get current status of an upload
// ============================================================================

export async function getUploadStatus(uploadId: string): Promise<UploadActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .eq('id', uploadId)
        .eq('user_id', user.id)
        .single();

    if (error || !data) {
        return { error: 'Upload not found' };
    }

    return { data };
}

// ============================================================================
// getRecentUploads: List user's recent uploads
// ============================================================================

export async function getRecentUploads(limit = 10): Promise<{ data?: Upload[]; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        return { error: error.message };
    }

    return { data: data || [] };
}

// ============================================================================
// retryUpload: Retry a failed upload
// ============================================================================

export async function retryUpload(uploadId: string): Promise<UploadActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    // Fetch upload record
    const { data: upload, error: fetchError } = await supabase
        .from('uploads')
        .select('*')
        .eq('id', uploadId)
        .eq('user_id', user.id)
        .single();

    if (fetchError || !upload) {
        return { error: 'Upload not found' };
    }

    if (upload.status !== 'failed') {
        return { error: 'Can only retry failed uploads' };
    }

    // Reset status and error
    await supabase
        .from('uploads')
        .update({ status: 'pending', error_message: null })
        .eq('id', uploadId);

    // Re-trigger the confirm flow
    return confirmUpload(uploadId);
}

// ============================================================================
// deleteUpload: Delete an upload and its file
// ============================================================================

export async function deleteUpload(uploadId: string): Promise<{ error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    // Fetch upload record
    const { data: upload, error: fetchError } = await supabase
        .from('uploads')
        .select('*')
        .eq('id', uploadId)
        .eq('user_id', user.id)
        .single();

    if (fetchError || !upload) {
        return { error: 'Upload not found' };
    }

    // Delete file from storage
    await supabase.storage
        .from('uploads')
        .remove([upload.file_path]);

    // Delete upload record
    const { error: deleteError } = await supabase
        .from('uploads')
        .delete()
        .eq('id', uploadId);

    if (deleteError) {
        return { error: deleteError.message };
    }

    revalidatePath('/app');
    revalidatePath('/app/planner');

    return {};
}
