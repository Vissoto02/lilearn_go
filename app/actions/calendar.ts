'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
    CalendarEvent,
    CreateStudyBlockInput,
    CreateDeadlineInput,
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
