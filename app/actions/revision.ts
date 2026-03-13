'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
    calculateQuizPoints,
    calculateUploadPoints,
    calculateTitle,
    isWeakSubject,
    THRESHOLDS,
} from '@/lib/gamification';
import type { RevisionSession, UserStats, LeaderboardEntry } from '@/lib/types';

// ============================================================================
// GET CURRENT ACTIVE STUDY BLOCK
// Finds the study_block or generated_plan event happening RIGHT NOW
// ============================================================================

export async function getCurrentStudyBlock(): Promise<{
    event: any | null;
    hasQuiz: boolean;
    quizId: string | null;
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { event: null, hasQuiz: false, quizId: null, error: 'Unauthorized' };
    }

    const now = new Date().toISOString();

    // Find study_block, manual_study, or generated_plan events where current time falls between start and end
    const { data: events, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .in('event_type', ['study_block', 'manual_study', 'generated_plan'])
        .lte('start_time', now)
        .gte('end_time', now)
        .order('start_time', { ascending: true })
        .limit(1);

    if (error) {
        return { event: null, hasQuiz: false, quizId: null, error: error.message };
    }

    if (!events || events.length === 0) {
        return { event: null, hasQuiz: false, quizId: null };
    }

    const event = events[0];

    // Extract subject from the event title (format is usually "Subject: Topic" or just "Subject")
    const subject = event.subject || event.title?.split(':')[0]?.trim() || '';
    const topic = event.title?.includes(':') ? event.title.split(':').slice(1).join(':').trim() : null;

    // Check if there's a quiz for this subject/topic
    let quizQuery = supabase
        .from('quizzes')
        .select('id')
        .eq('user_id', user.id)
        .eq('subject', subject);

    if (topic) {
        quizQuery = quizQuery.eq('topic', topic);
    }

    const { data: quizzes } = await quizQuery.limit(1);
    const hasQuiz = quizzes && quizzes.length > 0;
    const quizId = hasQuiz ? quizzes[0].id : null;

    return {
        event: { ...event, parsed_subject: subject, parsed_topic: topic },
        hasQuiz: !!hasQuiz,
        quizId,
    };
}

// ============================================================================
// GET TODAY'S STUDY BLOCKS (for showing schedule)
// ============================================================================

export async function getTodayStudyBlocks(): Promise<{
    events: any[];
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { events: [], error: 'Unauthorized' };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const { data: events, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .in('event_type', ['study_block', 'manual_study', 'generated_plan'])
        .gte('start_time', todayStart.toISOString())
        .lt('end_time', todayEnd.toISOString())
        .order('start_time', { ascending: true });

    if (error) {
        return { events: [], error: error.message };
    }

    // Enrich events with quiz availability
    const enrichedEvents = [];
    for (const event of events || []) {
        const subject = event.subject || event.title?.split(':')[0]?.trim() || '';
        const topic = event.title?.includes(':') ? event.title.split(':').slice(1).join(':').trim() : null;

        let quizQuery = supabase
            .from('quizzes')
            .select('id')
            .eq('user_id', user.id)
            .eq('subject', subject);

        if (topic) {
            quizQuery = quizQuery.eq('topic', topic);
        }

        const { data: quizzes } = await quizQuery.limit(1);

        enrichedEvents.push({
            ...event,
            parsed_subject: subject,
            parsed_topic: topic,
            has_quiz: quizzes && quizzes.length > 0,
            quiz_id: quizzes && quizzes.length > 0 ? quizzes[0].id : null,
        });
    }

    return { events: enrichedEvents };
}

// ============================================================================
// START REVISION SESSION
// ============================================================================

export async function startRevisionSession(calendarEventId: string): Promise<{
    session: RevisionSession | null;
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { session: null, error: 'Unauthorized' };
    }

    // Get the calendar event
    const { data: event, error: eventError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', calendarEventId)
        .eq('user_id', user.id)
        .single();

    if (eventError || !event) {
        return { session: null, error: 'Study block not found' };
    }

    // Verify it's currently active
    const now = new Date();
    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time);

    if (now < eventStart || now > eventEnd) {
        return { session: null, error: 'This study block is not currently active' };
    }

    // Check if there's already an active session for this event
    const { data: existingSessions } = await supabase
        .from('revision_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('calendar_event_id', calendarEventId)
        .in('status', ['active', 'validating']);

    if (existingSessions && existingSessions.length > 0) {
        return { session: existingSessions[0] as RevisionSession, error: undefined };
    }

    // Parse subject and topic from event
    const subject = event.subject || event.title?.split(':')[0]?.trim() || '';
    const topic = event.title?.includes(':') ? event.title.split(':').slice(1).join(':').trim() : null;

    // Check if this is a weak subject
    const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('quiz_id, is_correct')
        .eq('user_id', user.id);

    const { data: quizzes } = await supabase
        .from('quizzes')
        .select('id, subject')
        .eq('user_id', user.id);

    const weakSubject = isWeakSubject(
        attempts || [],
        quizzes || [],
        subject
    );

    // Find subject_id if it exists
    const { data: subjectData } = await supabase
        .from('subjects')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', subject)
        .limit(1);

    // Calculate remaining duration
    const remainingMinutes = Math.max(1, Math.round((eventEnd.getTime() - now.getTime()) / 60000));

    // Create the session
    const { data: session, error: insertError } = await supabase
        .from('revision_sessions')
        .insert({
            user_id: user.id,
            calendar_event_id: calendarEventId,
            subject,
            topic,
            subject_id: subjectData && subjectData.length > 0 ? subjectData[0].id : null,
            is_weak_subject: weakSubject,
            duration_minutes: remainingMinutes,
            status: 'active',
        })
        .select()
        .single();

    if (insertError) {
        return { session: null, error: insertError.message };
    }

    revalidatePath('/app/revision');
    return { session: session as RevisionSession };
}

// ============================================================================
// GET ACTIVE SESSION
// ============================================================================

export async function getActiveSession(): Promise<{
    session: RevisionSession | null;
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { session: null, error: 'Unauthorized' };
    }

    const { data: sessions, error } = await supabase
        .from('revision_sessions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'validating'])
        .order('started_at', { ascending: false })
        .limit(1);

    if (error) {
        return { session: null, error: error.message };
    }

    if (!sessions || sessions.length === 0) {
        return { session: null };
    }

    return { session: sessions[0] as RevisionSession };
}

// ============================================================================
// COMPLETE QUIZ VALIDATION
// ============================================================================

export async function completeQuizValidation(
    sessionId: string,
    quizId: string,
    scorePercent: number,
    options?: { usedRetry?: boolean }
): Promise<{
    points: number;
    passed: boolean;
    isPersonalBest: boolean;
    message: string;
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { points: 0, passed: false, isPersonalBest: false, message: '', error: 'Unauthorized' };
    }

    // Get the session
    const { data: session, error: sessionError } = await supabase
        .from('revision_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

    if (sessionError || !session) {
        return { points: 0, passed: false, isPersonalBest: false, message: '', error: 'Session not found' };
    }

    const usedRetry = options?.usedRetry ?? false;

    // Get previous best score for this quiz
    const { data: previousSessions } = await supabase
        .from('revision_sessions')
        .select('validation_score')
        .eq('user_id', user.id)
        .eq('validation_quiz_id', quizId)
        .eq('status', 'completed')
        .order('validation_score', { ascending: false })
        .limit(1);

    const previousBest = previousSessions && previousSessions.length > 0
        ? Number(previousSessions[0].validation_score)
        : null;

    // Calculate points using Validation Hub rules (80% pass, optional half points on retry)
    const result = calculateQuizPoints(scorePercent, session.is_weak_subject, previousBest, {
        isValidationHub: true,
        usedRetry,
    });

    // Optionally extend duration by 5 minutes when a retry was used
    const newDurationMinutes =
        usedRetry
            ? (session.duration_minutes ?? 0) + 5
            : session.duration_minutes;

    // Update the session
    const { error: updateError } = await supabase
        .from('revision_sessions')
        .update({
            validation_type: 'quiz',
            validation_quiz_id: quizId,
            validation_score: scorePercent,
            points_earned: result.points,
            is_personal_best: result.isPersonalBest,
            duration_minutes: newDurationMinutes,
            status: 'completed',
            ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

    if (updateError) {
        return { points: 0, passed: false, isPersonalBest: false, message: '', error: updateError.message };
    }

    // Update user_stats
    await updateUserStats(supabase, user.id, result.points, scorePercent);

    revalidatePath('/app/revision');
    revalidatePath('/app');
    return {
        points: result.points,
        passed: result.passed,
        isPersonalBest: result.isPersonalBest,
        message: result.message,
    };
}

// ============================================================================
// COMPLETE FILE VALIDATION
// ============================================================================

export async function completeFileValidation(
    sessionId: string,
    filePath: string,
    fileName: string,
    fileSizeBytes: number,
    note: string
): Promise<{
    points: number;
    message: string;
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { points: 0, message: '', error: 'Unauthorized' };
    }

    // Validate note length
    if (note.trim().length < THRESHOLDS.MIN_NOTE_LENGTH) {
        return {
            points: 0,
            message: '',
            error: `Your study note must be at least ${THRESHOLDS.MIN_NOTE_LENGTH} characters long.`,
        };
    }

    // Get the session
    const { data: session, error: sessionError } = await supabase
        .from('revision_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

    if (sessionError || !session) {
        return { points: 0, message: '', error: 'Session not found' };
    }

    const points = calculateUploadPoints();

    // Create file validation record
    const { error: fileError } = await supabase
        .from('file_validations')
        .insert({
            session_id: sessionId,
            user_id: user.id,
            file_path: filePath,
            file_name: fileName,
            file_size_bytes: fileSizeBytes,
            note: note.trim(),
            points_earned: points,
        });

    if (fileError) {
        return { points: 0, message: '', error: fileError.message };
    }

    // Update the session
    const { error: updateError } = await supabase
        .from('revision_sessions')
        .update({
            validation_type: 'file_upload',
            points_earned: points,
            status: 'completed',
            ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

    if (updateError) {
        return { points: 0, message: '', error: updateError.message };
    }

    // Update user_stats
    await updateUserStats(supabase, user.id, points);

    revalidatePath('/app/revision');
    revalidatePath('/app');
    return {
        points,
        message: `File uploaded successfully! You earned ${points} points. 📎`,
    };
}

// ============================================================================
// SKIP SESSION (user chose not to validate)
// ============================================================================

export async function skipSession(sessionId: string): Promise<{
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    const { error } = await supabase
        .from('revision_sessions')
        .update({
            status: 'skipped',
            ended_at: new Date().toISOString(),
            points_earned: 0,
        })
        .eq('id', sessionId)
        .eq('user_id', user.id);

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/app/revision');
    return {};
}

// ============================================================================
// GET USER STATS
// ============================================================================

export async function getUserStats(): Promise<{
    stats: UserStats | null;
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { stats: null, error: 'Unauthorized' };
    }

    let { data: stats, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error && error.code === 'PGRST116') {
        // No row found — create one
        const { data: newStats, error: insertError } = await supabase
            .from('user_stats')
            .insert({ user_id: user.id })
            .select()
            .single();

        if (insertError) {
            return { stats: null, error: insertError.message };
        }
        stats = newStats;
    } else if (error) {
        return { stats: null, error: error.message };
    }

    return { stats: stats as UserStats };
}

// ============================================================================
// GET LEADERBOARD
// ============================================================================

export async function getLeaderboard(period: 'daily' | 'weekly' | 'all_time'): Promise<{
    entries: LeaderboardEntry[];
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { entries: [], error: 'Unauthorized' };
    }

    const viewName = `leaderboard_${period}`;

    const { data, error } = await supabase
        .from(viewName)
        .select('*')
        .order('rank', { ascending: true })
        .limit(50);

    if (error) {
        return { entries: [], error: error.message };
    }

    return { entries: (data || []) as LeaderboardEntry[] };
}

// ============================================================================
// GET SESSION HISTORY
// ============================================================================

export async function getSessionHistory(limit: number = 10): Promise<{
    sessions: RevisionSession[];
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { sessions: [], error: 'Unauthorized' };
    }

    const { data, error } = await supabase
        .from('revision_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(limit);

    if (error) {
        return { sessions: [], error: error.message };
    }

    return { sessions: (data || []) as RevisionSession[] };
}

// ============================================================================
// INTERNAL: Update user stats after earning points
// ============================================================================

async function updateUserStats(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    pointsEarned: number,
    scorePercent?: number
) {
    // Get current stats
    let { data: stats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (!stats) {
        // Create if not exists
        const { data: newStats } = await supabase
            .from('user_stats')
            .insert({ user_id: userId })
            .select()
            .single();
        stats = newStats;
    }

    if (!stats) return;

    const newTotal = stats.total_points + pointsEarned;
    const newTitle = calculateTitle(newTotal);

    const updateData: Record<string, unknown> = {
        total_points: newTotal,
        title: newTitle,
    };

    // Track best improvement if score is provided
    if (scorePercent !== undefined && scorePercent > (stats.best_improvement_pct || 0)) {
        updateData.best_improvement_pct = scorePercent;
    }

    await supabase
        .from('user_stats')
        .update(updateData)
        .eq('user_id', userId);
}
