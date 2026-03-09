'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
    CalendarEvent,
    CreateStudyBlockInput,
    CreateDeadlineInput,
    CreateManualScheduleInput,
    UpdateEventInput,
    CalendarActionResult,
    CalendarQueryResult,
} from '@/lib/calendar/types';
import { hasTimeOverlap, formatDateKey } from '@/lib/calendar/date';

// ============================================================================
// STUDY BLOCKS
// ============================================================================

export async function createStudyBlock(
    input: CreateStudyBlockInput
): Promise<CalendarActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    // Check for conflicts
    const conflict = await checkConflict(
        supabase,
        user.id,
        input.start_time,
        input.end_time
    );

    if (conflict) {
        return {
            error: 'Time conflict: This overlaps with an existing study block',
            conflictWith: conflict.title
        };
    }

    const { data, error } = await supabase
        .from('calendar_events')
        .insert({
            user_id: user.id,
            title: input.title,
            event_type: 'study_block',
            start_time: input.start_time,
            end_time: input.end_time,
            topic_id: input.topic_id || null,
            color: input.color || '#6366f1',
            description: input.description || null,
        })
        .select()
        .single();

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/app');
    revalidatePath('/app/planner');
    return { data };
}

// ============================================================================
// DEADLINES
// ============================================================================

export async function createDeadline(
    input: CreateDeadlineInput
): Promise<CalendarActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    // Store deadline as end_time with time set to end of day in Malaysia timezone
    const dueDateTime = `${input.due_date}T23:59:59+08:00`;

    const { data, error } = await supabase
        .from('calendar_events')
        .insert({
            user_id: user.id,
            title: input.title,
            event_type: 'deadline',
            start_time: null,
            end_time: dueDateTime,
            topic_id: input.topic_id || null,
            color: input.color || '#ef4444', // red for deadlines
            description: input.description || null,
        })
        .select()
        .single();

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/app');
    revalidatePath('/app/planner');
    return { data };
}

// ============================================================================
// UPDATE & DELETE
// ============================================================================

export async function updateCalendarEvent(
    input: UpdateEventInput
): Promise<CalendarActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    // If updating times, check for conflicts
    if (input.start_time && input.end_time) {
        const conflict = await checkConflict(
            supabase,
            user.id,
            input.start_time,
            input.end_time,
            input.id // Exclude self from conflict check
        );

        if (conflict) {
            return {
                error: 'Time conflict: This overlaps with an existing study block',
                conflictWith: conflict.title
            };
        }
    }

    const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.start_time !== undefined) updateData.start_time = input.start_time;
    if (input.end_time !== undefined) updateData.end_time = input.end_time;
    if (input.topic_id !== undefined) updateData.topic_id = input.topic_id;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.location !== undefined) updateData.location = input.location;
    if (input.is_locked !== undefined) updateData.is_locked = input.is_locked;

    const { data, error } = await supabase
        .from('calendar_events')
        .update(updateData)
        .eq('id', input.id)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/app');
    revalidatePath('/app/planner');
    return { data };
}

export async function deleteCalendarEvent(
    eventId: string
): Promise<{ success?: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', user.id);

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/app');
    revalidatePath('/app/planner');
    return { success: true };
}

// ============================================================================
// QUERIES
// ============================================================================

export async function getEventsForMonth(
    year: number,
    month: number // 0-indexed
): Promise<CalendarQueryResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized', data: [] };
    }

    // Get start and end of the month view (includes padding days)
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    // Add padding for calendar grid (week before and after)
    const viewStart = new Date(monthStart);
    viewStart.setDate(viewStart.getDate() - 7);
    const viewEnd = new Date(monthEnd);
    viewEnd.setDate(viewEnd.getDate() + 7);

    const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .or(`start_time.gte.${viewStart.toISOString()},end_time.gte.${viewStart.toISOString()}`)
        .lte('end_time', viewEnd.toISOString())
        .order('start_time', { ascending: true, nullsFirst: false });

    if (error) {
        return { error: error.message, data: [] };
    }

    return { data: data as CalendarEvent[] };
}

export async function getEventsForDateRange(
    startDate: string,
    endDate: string
): Promise<CalendarQueryResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized', data: [] };
    }

    const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('end_time', startDate)
        .lte('end_time', endDate)
        .order('start_time', { ascending: true, nullsFirst: false });

    if (error) {
        return { error: error.message, data: [] };
    }

    return { data: data as CalendarEvent[] };
}

export async function getEventsForDay(
    dateKey: string // YYYY-MM-DD format
): Promise<CalendarQueryResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized', data: [] };
    }

    const dayStart = `${dateKey}T00:00:00+08:00`;
    const dayEnd = `${dateKey}T23:59:59+08:00`;

    const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .or(`and(start_time.gte.${dayStart},start_time.lte.${dayEnd}),and(end_time.gte.${dayStart},end_time.lte.${dayEnd})`)
        .order('start_time', { ascending: true, nullsFirst: false });

    if (error) {
        return { error: error.message, data: [] };
    }

    return { data: data as CalendarEvent[] };
}

export async function getTodayEvents(): Promise<CalendarQueryResult> {
    const today = formatDateKey(new Date());
    return getEventsForDay(today);
}

// ============================================================================
// CONFLICT DETECTION (Internal)
// ============================================================================

async function checkConflict(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    startTime: string,
    endTime: string,
    excludeId?: string
): Promise<CalendarEvent | null> {
    // Fetch all study blocks that might overlap
    let query = supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .eq('event_type', 'study_block')
        .not('start_time', 'is', null);

    if (excludeId) {
        query = query.neq('id', excludeId);
    }

    const { data: events } = await query;

    if (!events || events.length === 0) {
        return null;
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    for (const event of events) {
        const eventStart = new Date(event.start_time!);
        const eventEnd = new Date(event.end_time!);

        if (hasTimeOverlap(newStart, newEnd, eventStart, eventEnd)) {
            return event as CalendarEvent;
        }
    }

    return null;
}

// ============================================================================
// MANUAL SCHEDULE (Recurring)
// ============================================================================

export async function createManualSchedule(
    input: CreateManualScheduleInput
): Promise<{ count?: number; conflicts?: string[]; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    // Validate
    if (!input.title.trim()) return { error: 'Title is required' };
    if (input.start_time >= input.end_time) return { error: 'End time must be after start time' };
    if (input.repeat_weeks < 1 || input.repeat_weeks > 52) return { error: 'Repeat weeks must be 1-52' };

    const recurrenceGroup = crypto.randomUUID();
    const conflicts: string[] = [];

    // Calculate dates for each week
    const startDate = new Date(input.start_date + 'T00:00:00+08:00');
    if (isNaN(startDate.getTime())) {
        return { error: 'Invalid start date' };
    }

    // Find the first occurrence of the target day-of-week from start_date
    const targetDow = input.day_of_week; // 0=Sun ... 6=Sat
    const startDow = startDate.getDay();
    let daysUntilFirst = targetDow - startDow;
    if (daysUntilFirst < 0) daysUntilFirst += 7;
    const firstDate = new Date(startDate);
    firstDate.setDate(startDate.getDate() + daysUntilFirst);

    const eventsToInsert: Array<Record<string, unknown>> = [];

    for (let week = 0; week < input.repeat_weeks; week++) {
        const eventDate = new Date(firstDate);
        eventDate.setDate(firstDate.getDate() + week * 7);

        const dateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
        const startISO = `${dateStr}T${input.start_time}:00+08:00`;
        const endISO = `${dateStr}T${input.end_time}:00+08:00`;

        // Check for conflicts on this specific date/time
        const conflict = await checkConflictAll(
            supabase,
            user.id,
            startISO,
            endISO
        );

        if (conflict) {
            conflicts.push(`Week ${week + 1} (${dateStr}): conflicts with "${conflict.title}"`);
            continue; // Skip this week but continue with others
        }

        // Build description including topic if selected
        const descParts: string[] = [];
        if (input.topic?.trim()) descParts.push(`📚 ${input.topic.trim()}`);
        if (input.description?.trim()) descParts.push(input.description.trim());
        const finalDescription = descParts.length > 0 ? descParts.join('\n') : null;

        eventsToInsert.push({
            user_id: user.id,
            title: input.title.trim(),
            event_type: input.activity_type,
            start_time: startISO,
            end_time: endISO,
            color: input.color || (input.activity_type === 'manual_study' ? '#0ea5e9' : '#64748b'),
            description: finalDescription,
            location: input.location?.trim() || null,
            subject: input.subject?.trim() || null,
            topic_id: null,
            is_locked: true,
            recurrence_group: recurrenceGroup,
            source: 'manual',
        });
    }

    if (eventsToInsert.length === 0) {
        if (conflicts.length > 0) {
            return { count: 0, conflicts, error: 'All weeks have conflicts. No events were created.' };
        }
        return { error: 'No events to create' };
    }

    // Batch insert
    const BATCH_SIZE = 500;
    let insertedCount = 0;

    for (let i = 0; i < eventsToInsert.length; i += BATCH_SIZE) {
        const batch = eventsToInsert.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
            .from('calendar_events')
            .insert(batch);

        if (insertError) {
            return { count: insertedCount, conflicts, error: `Insert failed: ${insertError.message}` };
        }
        insertedCount += batch.length;
    }

    revalidatePath('/app');
    revalidatePath('/app/planner');
    return { count: insertedCount, conflicts: conflicts.length > 0 ? conflicts : undefined };
}

// Delete all events in a recurrence group
export async function deleteRecurrenceGroup(
    recurrenceGroup: string
): Promise<{ count?: number; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    const { data, error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('user_id', user.id)
        .eq('recurrence_group', recurrenceGroup)
        .select('id');

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/app');
    revalidatePath('/app/planner');
    return { count: data?.length || 0 };
}

// Get semester end date from the most recent confirmed timetable upload
export async function getSemesterEndDate(): Promise<{ endDate?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    const { data: upload } = await supabase
        .from('timetable_uploads')
        .select('semester_start_date, weeks')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!upload || !upload.semester_start_date || !upload.weeks) {
        return {}; // No confirmed timetable found
    }

    const start = new Date(upload.semester_start_date + 'T00:00:00+08:00');
    const end = new Date(start);
    end.setDate(end.getDate() + upload.weeks * 7);
    return { endDate: formatDateKey(end) };
}

// Get unique subjects & topics from the user's topics table
export async function getSubjectsAndTopics(): Promise<{
    subjects: string[];
    topics: { subject: string; topic: string }[];
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { subjects: [], topics: [], error: 'Unauthorized' };
    }

    const { data, error } = await supabase
        .from('topics')
        .select('subject, topic')
        .eq('user_id', user.id)
        .order('subject');

    if (error) {
        return { subjects: [], topics: [], error: error.message };
    }

    const rows = (data || []) as { subject: string; topic: string }[];
    const subjects = Array.from(new Set(rows.map(r => r.subject))).filter(Boolean).sort();
    const topics = rows.filter(r => r.subject && r.topic);

    return { subjects, topics };
}

// ============================================================================
// CONFLICT DETECTION (All event types) — used by manual schedule
// ============================================================================

async function checkConflictAll(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    startTime: string,
    endTime: string,
    excludeId?: string
): Promise<CalendarEvent | null> {
    let query = supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .not('start_time', 'is', null)
        .not('end_time', 'is', null);

    if (excludeId) {
        query = query.neq('id', excludeId);
    }

    // Only fetch events on the same day to limit scope
    const dayStart = startTime.split('T')[0] + 'T00:00:00+08:00';
    const dayEnd = startTime.split('T')[0] + 'T23:59:59+08:00';
    query = query.gte('start_time', dayStart).lte('start_time', dayEnd);

    const { data: events } = await query;

    if (!events || events.length === 0) {
        return null;
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    for (const event of events) {
        const eventStart = new Date(event.start_time!);
        const eventEnd = new Date(event.end_time!);

        if (hasTimeOverlap(newStart, newEnd, eventStart, eventEnd)) {
            return event as CalendarEvent;
        }
    }

    return null;
}

// ============================================================================
// AI PLAN SAVER
// ============================================================================

export async function saveGeneratedPlan(
    sessions: {
        date: string;
        start_time: string;
        end_time: string;
        subject: string;
        topic: string | null;
        reason: string;
    }[],
    startDateStr: string,
    endDateStr: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        // Delete any previously generated AI plans within this time window
        const { error: deleteError } = await supabase
            .from('calendar_events')
            .delete()
            .eq('user_id', user.id)
            .eq('event_type', 'generated_plan')
            .gte('start_time', `${startDateStr}T00:00:00+08:00`)
            .lte('end_time', `${endDateStr}T23:59:59+08:00`);

        if (deleteError) {
            console.error('Error deleting old generated plan:', deleteError);
            return { success: false, error: deleteError.message };
        }

        if (sessions.length === 0) {
            return { success: true };
        }

        // Map sessions to calendar_events
        const eventsToInsert = sessions.map(session => {
            const description = session.topic
                ? `📚 ${session.topic}\n\n🤖 AI Reason: ${session.reason}`
                : `🤖 AI Reason: ${session.reason}`;

            return {
                user_id: user.id,
                title: session.topic ? `${session.subject}: ${session.topic}` : session.subject,
                event_type: 'generated_plan',
                start_time: `${session.date}T${session.start_time}:00+08:00`,
                end_time: `${session.date}T${session.end_time}:00+08:00`,
                subject: session.subject,
                color: '#6366f1', // Indigo as default for AI
                description: description,
                is_locked: false, // User can move or delete these freely
                source: 'ai'
            };
        });

        const { error: insertError } = await supabase
            .from('calendar_events')
            .insert(eventsToInsert);

        if (insertError) {
            console.error('Error inserting new generated plan:', insertError);
            return { success: false, error: insertError.message };
        }

        revalidatePath('/app');
        return { success: true };
    } catch (err: any) {
        console.error('Failed to save plan:', err);
        return { success: false, error: err.message };
    }
}
