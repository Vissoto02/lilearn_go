'use server';

import { createClient } from '@/lib/supabase/server';
import type { Notification, StudyNotificationType } from '@/lib/types';

const STARTING_SOON_MINUTES = 10;
const MISSED_GRACE_MINUTES = 15;

function getDisplayTitleAndMessage(event: any, type: StudyNotificationType): {
    title: string;
    message: string;
} {
    const rawSubject = event.subject || event.title?.split(':')[0]?.trim() || 'Study session';
    const rawTopic = event.title?.includes(':')
        ? event.title.split(':').slice(1).join(':').trim()
        : null;

    const subject = rawSubject || 'Study session';
    const topic = rawTopic && rawTopic.length > 0 ? rawTopic : null;

    const sessionLabel = topic ? `${topic} under ${subject}` : subject;

    switch (type) {
        case 'study_session_starting_soon':
            return {
                title: 'Study session starting soon',
                message: `Your ${sessionLabel} revision starts in ${STARTING_SOON_MINUTES} minutes.`,
            };
        case 'study_session_ready_now':
            return {
                title: 'Study session ready',
                message: `Your ${sessionLabel} session is ready. Click Start to begin.`,
            };
        case 'study_session_missed':
            return {
                title: 'Study session missed',
                message: `You missed your ${sessionLabel} study session. Reschedule or start a recovery session.`,
            };
    }
}

async function ensureStudyNotification(params: {
    userId: string;
    type: StudyNotificationType;
    event: any;
    linkTarget?: string;
}) {
    const supabase = await createClient();

    const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', params.userId)
        .eq('type', params.type)
        .eq('related_calendar_event_id', params.event.id)
        .limit(1);

    if (existing && existing.length > 0) {
        return;
    }

    const { title, message } = getDisplayTitleAndMessage(params.event, params.type);

    await supabase
        .from('notifications')
        .insert({
            user_id: params.userId,
            type: params.type,
            scheduled_at: new Date().toISOString(),
            status: 'sent',
            title,
            message,
            related_calendar_event_id: params.event.id,
            related_revision_session_id: null,
            link_target: params.linkTarget ?? '/app/planner',
            is_read: false,
        });
}

export async function runStudySessionNotificationSweep(): Promise<{ created: number }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { created: 0 };
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);

    const { data: events, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .in('event_type', ['study_block', 'manual_study', 'generated_plan'])
        .gte('start_time', todayStart.toISOString())
        .lt('start_time', tomorrowStart.toISOString())
        .order('start_time', { ascending: true });

    if (error || !events || events.length === 0) {
        return { created: 0 };
    }

    let created = 0;

    for (const event of events) {
        if (!event.start_time || !event.end_time) continue;

        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        const minutesUntilStart = (start.getTime() - now.getTime()) / 60000;
        const minutesSinceStart = (now.getTime() - start.getTime()) / 60000;

        // Starting soon (only for future sessions within threshold)
        if (minutesUntilStart > 0 && minutesUntilStart <= STARTING_SOON_MINUTES) {
            await ensureStudyNotification({
                userId: user.id,
                type: 'study_session_starting_soon',
                event,
                linkTarget: '/app/planner',
            });
            created++;
        }

        // Ready now (session has just started and is ongoing)
        if (now >= start && now <= end) {
            await ensureStudyNotification({
                userId: user.id,
                type: 'study_session_ready_now',
                event,
                linkTarget: '/app/revision',
            });
            created++;
        }

        // Missed session (start passed long enough ago, no revision session started)
        if (minutesSinceStart > MISSED_GRACE_MINUTES && minutesSinceStart < 8 * 60) {
            const { data: sessions } = await supabase
                .from('revision_sessions')
                .select('id, status')
                .eq('user_id', user.id)
                .eq('calendar_event_id', event.id)
                .limit(1);

            const hasSession = sessions && sessions.length > 0;
            if (!hasSession) {
                await ensureStudyNotification({
                    userId: user.id,
                    type: 'study_session_missed',
                    event,
                    linkTarget: '/app/planner',
                });
                created++;
            }
        }
    }

    return { created };
}

export async function getNotifications(limit: number = 20): Promise<{ notifications: Notification[] }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { notifications: [] };
    }

    const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    return { notifications: (data || []) as Notification[] };
}

export async function getUnreadNotificationCount(): Promise<{ count: number }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { count: 0 };
    }

    const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

    return { count: count || 0 };
}

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false };
    }

    await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id);

    return { success: true };
}

export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false };
    }

    await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

    return { success: true };
}

