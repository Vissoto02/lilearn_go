'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
    TimetableUpload,
    TimetableItem,
    CreateTimetableUploadInput,
    CreateTimetableUploadResult,
    TimetableUploadResult,
    TimetableWebhookPayload,
    ConfirmTimetableInput,
} from '@/lib/timetable/types';
import { TIMETABLE_SUPPORTED_MIMES, TIMETABLE_MAX_FILE_SIZE, VALID_DAYS, DAY_TO_WEEKDAY } from '@/lib/timetable/types';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || 'lilearn-webhook-secret-2026';

// ============================================================================
// createTimetableUpload: Create DB record + signed upload URL
// ============================================================================

export async function createTimetableUpload(
    input: CreateTimetableUploadInput
): Promise<CreateTimetableUploadResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { upload_id: '', signed_url: '', file_path: '', error: 'Unauthorized' };
    }

    // Validate mime type
    if (!TIMETABLE_SUPPORTED_MIMES.includes(input.mime_type as typeof TIMETABLE_SUPPORTED_MIMES[number])) {
        return { upload_id: '', signed_url: '', file_path: '', error: 'Unsupported file type. Please upload PDF, PNG, or JPG.' };
    }

    // Validate file size
    if (input.size_bytes <= 0 || input.size_bytes > TIMETABLE_MAX_FILE_SIZE) {
        return { upload_id: '', signed_url: '', file_path: '', error: 'File size must be between 1 byte and 10MB' };
    }

    const uploadId = crypto.randomUUID();
    const sanitizedName = input.original_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Store under timetables/ prefix to keep separate from quiz uploads
    const filePath = `timetables/${user.id}/${uploadId}/${sanitizedName}`;

    // Create signed upload URL (uses existing 'uploads' bucket)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('uploads')
        .createSignedUploadUrl(filePath);

    if (signedUrlError || !signedUrlData) {
        console.error('Failed to create timetable signed URL:', signedUrlError);
        return { upload_id: '', signed_url: '', file_path: '', error: 'Failed to create upload URL. Make sure the storage bucket exists.' };
    }

    // Insert timetable_uploads record
    const { error: insertError } = await supabase
        .from('timetable_uploads')
        .insert({
            id: uploadId,
            user_id: user.id,
            file_path: filePath,
            original_name: input.original_name,
            mime_type: input.mime_type,
            size_bytes: input.size_bytes,
            status: 'uploaded',
        });

    if (insertError) {
        console.error('Failed to insert timetable upload record:', insertError);
        return { upload_id: '', signed_url: '', file_path: '', error: `Failed to create upload record: ${insertError.message}` };
    }

    return {
        upload_id: uploadId,
        signed_url: signedUrlData.signedUrl,
        file_path: filePath,
    };
}

// ============================================================================
// processTimetableUpload: Verify file, call n8n webhook, store parsed result
// ============================================================================

export async function processTimetableUpload(
    uploadId: string
): Promise<TimetableUploadResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    // Fetch timetable upload record
    const { data: upload, error: fetchError } = await supabase
        .from('timetable_uploads')
        .select('*')
        .eq('id', uploadId)
        .eq('user_id', user.id)
        .single();

    if (fetchError || !upload) {
        return { error: 'Timetable upload not found' };
    }

    if (upload.status !== 'uploaded' && upload.status !== 'failed') {
        return { error: `Invalid status for processing: ${upload.status}` };
    }

    // Update status to processing
    await supabase
        .from('timetable_uploads')
        .update({ status: 'processing', error_message: null })
        .eq('id', uploadId);

    // Verify file exists in storage
    const folderPath = upload.file_path.split('/').slice(0, -1).join('/');
    const fileName = upload.file_path.split('/').pop();
    const { data: fileData, error: fileError } = await supabase.storage
        .from('uploads')
        .list(folderPath);

    const fileExists = fileData?.some((f: { name: string }) => f.name === fileName);

    if (fileError || !fileExists) {
        await supabase
            .from('timetable_uploads')
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
            .from('timetable_uploads')
            .update({ status: 'failed', error_message: 'Failed to generate download URL' })
            .eq('id', uploadId);
        return { error: 'Failed to generate download URL' };
    }

    // Prepare n8n webhook payload
    const webhookPayload: TimetableWebhookPayload = {
        upload_id: upload.id,
        user_id: upload.user_id,
        file_name: upload.original_name,
        file_path: upload.file_path,
        mime_type: upload.mime_type,
        signed_url: signedUrlData.signedUrl,
        purpose: 'timetable',
        // Send empty/defaults for quiz-specific fields
        options: {},
        topic_id: '',
        quiz_id: '',
        topic_name: '',
    };

    // Call n8n webhook
    if (!N8N_WEBHOOK_URL) {
        await supabase
            .from('timetable_uploads')
            .update({ status: 'failed', error_message: 'N8N webhook URL not configured' })
            .eq('id', uploadId);
        return { error: 'N8N webhook URL not configured' };
    }

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
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Webhook returned ${response.status}: ${errorText}`);
        }

        // The timetable branch in n8n processes synchronously and returns parsed data
        const result = await response.json();

        // Extract parsed items from n8n response
        // The parse_timetable_subworkflow returns: { items: [...], meta: {...} }
        // But the response might be wrapped differently depending on n8n version
        let parsedItems: TimetableItem[] = [];

        if (result && result.items && Array.isArray(result.items)) {
            parsedItems = result.items;
        } else if (result && Array.isArray(result)) {
            // n8n might return array directly
            const firstItem = result[0];
            if (firstItem && firstItem.items) {
                parsedItems = firstItem.items;
            }
        }

        if (parsedItems.length === 0) {
            await supabase
                .from('timetable_uploads')
                .update({
                    status: 'failed',
                    error_message: 'No timetable items could be extracted from the file. Try a clearer PDF.',
                    parsed_json: result, // Store raw response for debugging
                })
                .eq('id', uploadId);

            return { error: 'No timetable items could be extracted from the file' };
        }

        // Store parsed items and set status to needs_review
        const { data: updatedUpload, error: updateError } = await supabase
            .from('timetable_uploads')
            .update({
                status: 'needs_review',
                parsed_json: parsedItems,
            })
            .eq('id', uploadId)
            .select()
            .single();

        if (updateError) {
            return { error: 'Failed to save parsed items' };
        }

        return { data: updatedUpload };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Webhook call failed';
        console.error('n8n timetable webhook failed:', err);

        await supabase
            .from('timetable_uploads')
            .update({ status: 'failed', error_message: errorMsg })
            .eq('id', uploadId);

        return { error: `Processing failed: ${errorMsg}` };
    }
}

// ============================================================================
// getTimetableUpload: Get current status + parsed data
// ============================================================================

export async function getTimetableUpload(
    uploadId: string
): Promise<TimetableUploadResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    const { data, error } = await supabase
        .from('timetable_uploads')
        .select('*')
        .eq('id', uploadId)
        .eq('user_id', user.id)
        .single();

    if (error || !data) {
        return { error: 'Timetable upload not found' };
    }

    return { data };
}

// ============================================================================
// getRecentTimetableUploads: List user's timetable uploads
// ============================================================================

export async function getRecentTimetableUploads(
    limit = 5
): Promise<{ data?: TimetableUpload[]; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    const { data, error } = await supabase
        .from('timetable_uploads')
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
// confirmTimetableEvents: Validate items, generate calendar events, insert
// ============================================================================

export async function confirmTimetableEvents(
    input: ConfirmTimetableInput
): Promise<{ count?: number; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    // Validate upload exists and is in needs_review status
    const { data: upload, error: fetchError } = await supabase
        .from('timetable_uploads')
        .select('*')
        .eq('id', input.upload_id)
        .eq('user_id', user.id)
        .single();

    if (fetchError || !upload) {
        return { error: 'Timetable upload not found' };
    }

    if (upload.status !== 'needs_review') {
        return { error: `Cannot confirm: status is ${upload.status}` };
    }

    // Validate semester start date
    const semesterStart = new Date(input.semester_start_date + 'T00:00:00+08:00');
    if (isNaN(semesterStart.getTime())) {
        return { error: 'Invalid semester start date' };
    }

    // Validate weeks
    const weeks = Math.max(1, Math.min(52, input.weeks || 14));

    // Validate each item
    const validationErrors: string[] = [];
    for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];

        if (!VALID_DAYS.includes(item.day as typeof VALID_DAYS[number])) {
            validationErrors.push(`Row ${i + 1}: Invalid day "${item.day}"`);
        }

        if (!/^\d{2}:\d{2}$/.test(item.start)) {
            validationErrors.push(`Row ${i + 1}: Invalid start time "${item.start}"`);
        }

        if (!/^\d{2}:\d{2}$/.test(item.end)) {
            validationErrors.push(`Row ${i + 1}: Invalid end time "${item.end}"`);
        }

        if (item.start >= item.end) {
            validationErrors.push(`Row ${i + 1}: End time must be after start time`);
        }

        if (!item.title.trim()) {
            validationErrors.push(`Row ${i + 1}: Title is required`);
        }
    }

    if (validationErrors.length > 0) {
        return { error: validationErrors.join('; ') };
    }

    // Generate calendar events for each class over N weeks
    const eventsToInsert: Array<{
        user_id: string;
        title: string;
        event_type: string;
        start_time: string;
        end_time: string;
        color: string;
        description: string;
        location: string;
        source: string;
    }> = [];

    // Timetable class colors - rotate through these
    const classColors = ['#14b8a6', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#3b82f6'];

    for (let weekOffset = 0; weekOffset < weeks; weekOffset++) {
        for (let itemIdx = 0; itemIdx < input.items.length; itemIdx++) {
            const item = input.items[itemIdx];
            const dayOfWeek = DAY_TO_WEEKDAY[item.day];
            if (dayOfWeek === undefined) continue;

            // Calculate the date for this class in this week
            const classDate = new Date(semesterStart);
            // Find the first occurrence of this day-of-week from semester start
            const semesterDayOfWeek = semesterStart.getDay(); // 0=Sun
            let daysUntilFirst = dayOfWeek - semesterDayOfWeek;
            if (daysUntilFirst < 0) daysUntilFirst += 7;

            classDate.setDate(semesterStart.getDate() + daysUntilFirst + (weekOffset * 7));

            // Build ISO timestamps in Asia/Kuala_Lumpur (UTC+8)
            const dateStr = `${classDate.getFullYear()}-${String(classDate.getMonth() + 1).padStart(2, '0')}-${String(classDate.getDate()).padStart(2, '0')}`;
            const startIso = `${dateStr}T${item.start}:00+08:00`;
            const endIso = `${dateStr}T${item.end}:00+08:00`;

            const color = classColors[itemIdx % classColors.length];

            eventsToInsert.push({
                user_id: user.id,
                title: item.title,
                event_type: 'timetable_class',
                start_time: startIso,
                end_time: endIso,
                color,
                description: item.location ? `📍 ${item.location}` : '',
                location: item.location || '',
                source: `timetable:${input.upload_id}`,
            });
        }
    }

    if (eventsToInsert.length === 0) {
        return { error: 'No events to insert' };
    }

    // Insert events in batches (Supabase has a limit per request)
    const BATCH_SIZE = 500;
    let insertedCount = 0;

    for (let i = 0; i < eventsToInsert.length; i += BATCH_SIZE) {
        const batch = eventsToInsert.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
            .from('calendar_events')
            .insert(batch);

        if (insertError) {
            console.error('Failed to insert calendar events batch:', insertError);
            // If partial insert, still update status
            if (insertedCount > 0) {
                await supabase
                    .from('timetable_uploads')
                    .update({
                        status: 'confirmed',
                        semester_start_date: input.semester_start_date,
                        weeks,
                        error_message: `Partial insert: ${insertedCount} events created, error on batch ${i}: ${insertError.message}`,
                    })
                    .eq('id', input.upload_id);
                return { count: insertedCount, error: `Partial insert: ${insertError.message}` };
            }
            return { error: `Failed to insert events: ${insertError.message}` };
        }
        insertedCount += batch.length;
    }

    // Update timetable_uploads status to confirmed
    await supabase
        .from('timetable_uploads')
        .update({
            status: 'confirmed',
            parsed_json: input.items,
            semester_start_date: input.semester_start_date,
            weeks,
        })
        .eq('id', input.upload_id);

    revalidatePath('/app');
    revalidatePath('/app/planner');

    return { count: insertedCount };
}

// ============================================================================
// deleteTimetableUpload: Delete upload record and file
// ============================================================================

export async function deleteTimetableUpload(
    uploadId: string
): Promise<{ error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    const { data: upload, error: fetchError } = await supabase
        .from('timetable_uploads')
        .select('*')
        .eq('id', uploadId)
        .eq('user_id', user.id)
        .single();

    if (fetchError || !upload) {
        return { error: 'Timetable upload not found' };
    }

    // Delete file from storage
    await supabase.storage
        .from('uploads')
        .remove([upload.file_path]);

    // Delete the record
    const { error: deleteError } = await supabase
        .from('timetable_uploads')
        .delete()
        .eq('id', uploadId);

    if (deleteError) {
        return { error: deleteError.message };
    }

    revalidatePath('/app/planner');
    return {};
}
