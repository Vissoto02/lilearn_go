import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hasTimeOverlap } from '@/lib/calendar/date';
import type { CalendarEvent } from '@/lib/calendar/types';

/**
 * Calendar API Route for external access (n8n webhooks)
 * 
 * Authentication: Uses Bearer token with Supabase service role key
 * Header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 * 
 * Endpoints:
 * GET  /api/calendar?user_id=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD
 * POST /api/calendar (create event)
 * PUT  /api/calendar (update event)
 * DELETE /api/calendar?id=xxx&user_id=xxx
 */

// Create admin client that bypasses RLS
function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

// Validate the API key
function validateApiKey(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return false;
    }

    const token = authHeader.substring(7);
    // Accept either the service role key or a custom API key
    const validKeys = [
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        process.env.CALENDAR_API_KEY, // Optional custom key
    ].filter(Boolean);

    return validKeys.includes(token);
}

// ============================================================================
// GET - Fetch events for a user
// ============================================================================
export async function GET(request: NextRequest) {
    if (!validateApiKey(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const eventId = searchParams.get('id');

    if (!userId) {
        return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    try {
        // If fetching a specific event
        if (eventId) {
            const { data, error } = await supabase
                .from('calendar_events')
                .select('*')
                .eq('id', eventId)
                .eq('user_id', userId)
                .single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }

            return NextResponse.json({ data });
        }

        // Fetch events for date range
        let query = supabase
            .from('calendar_events')
            .select('*')
            .eq('user_id', userId)
            .order('start_time', { ascending: true, nullsFirst: false });

        if (startDate) {
            query = query.gte('end_time', `${startDate}T00:00:00+08:00`);
        }
        if (endDate) {
            query = query.lte('end_time', `${endDate}T23:59:59+08:00`);
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (err) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ============================================================================
// POST - Create a new event
// ============================================================================
export async function POST(request: NextRequest) {
    if (!validateApiKey(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { user_id, title, event_type, start_time, end_time, topic_id, color, description } = body;

        if (!user_id || !title || !event_type) {
            return NextResponse.json(
                { error: 'user_id, title, and event_type are required' },
                { status: 400 }
            );
        }

        if (event_type !== 'study_block' && event_type !== 'deadline') {
            return NextResponse.json(
                { error: 'event_type must be "study_block" or "deadline"' },
                { status: 400 }
            );
        }

        if (event_type === 'study_block' && (!start_time || !end_time)) {
            return NextResponse.json(
                { error: 'start_time and end_time are required for study_block' },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();

        // Check for conflicts if creating a study block
        if (event_type === 'study_block') {
            const { data: existingEvents } = await supabase
                .from('calendar_events')
                .select('*')
                .eq('user_id', user_id)
                .eq('event_type', 'study_block')
                .not('start_time', 'is', null);

            if (existingEvents && existingEvents.length > 0) {
                const newStart = new Date(start_time);
                const newEnd = new Date(end_time);

                for (const event of existingEvents) {
                    const eventStart = new Date(event.start_time!);
                    const eventEnd = new Date(event.end_time!);

                    if (hasTimeOverlap(newStart, newEnd, eventStart, eventEnd)) {
                        return NextResponse.json(
                            { error: 'Time conflict', conflictWith: event.title },
                            { status: 409 }
                        );
                    }
                }
            }
        }

        const { data, error } = await supabase
            .from('calendar_events')
            .insert({
                user_id,
                title,
                event_type,
                start_time: event_type === 'study_block' ? start_time : null,
                end_time: end_time || (event_type === 'deadline' ? body.due_date + 'T23:59:59+08:00' : null),
                topic_id: topic_id || null,
                color: color || (event_type === 'deadline' ? '#ef4444' : '#6366f1'),
                description: description || null,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

// ============================================================================
// PUT - Update an existing event
// ============================================================================
export async function PUT(request: NextRequest) {
    if (!validateApiKey(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { id, user_id, title, start_time, end_time, topic_id, color, description } = body;

        if (!id || !user_id) {
            return NextResponse.json(
                { error: 'id and user_id are required' },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();

        // Check for conflicts if updating times
        if (start_time && end_time) {
            const { data: existingEvents } = await supabase
                .from('calendar_events')
                .select('*')
                .eq('user_id', user_id)
                .eq('event_type', 'study_block')
                .neq('id', id)
                .not('start_time', 'is', null);

            if (existingEvents && existingEvents.length > 0) {
                const newStart = new Date(start_time);
                const newEnd = new Date(end_time);

                for (const event of existingEvents) {
                    const eventStart = new Date(event.start_time!);
                    const eventEnd = new Date(event.end_time!);

                    if (hasTimeOverlap(newStart, newEnd, eventStart, eventEnd)) {
                        return NextResponse.json(
                            { error: 'Time conflict', conflictWith: event.title },
                            { status: 409 }
                        );
                    }
                }
            }
        }

        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (title !== undefined) updateData.title = title;
        if (start_time !== undefined) updateData.start_time = start_time;
        if (end_time !== undefined) updateData.end_time = end_time;
        if (topic_id !== undefined) updateData.topic_id = topic_id;
        if (color !== undefined) updateData.color = color;
        if (description !== undefined) updateData.description = description;

        const { data, error } = await supabase
            .from('calendar_events')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', user_id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (err) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

// ============================================================================
// DELETE - Delete an event
// ============================================================================
export async function DELETE(request: NextRequest) {
    if (!validateApiKey(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');
    const userId = searchParams.get('user_id');

    if (!eventId || !userId) {
        return NextResponse.json(
            { error: 'id and user_id are required' },
            { status: 400 }
        );
    }

    const supabase = createAdminClient();

    const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', userId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
