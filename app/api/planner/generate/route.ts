import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateWeakness, getWeakestTopics } from '@/lib/weakness-calculator';
import { generatePlanWithGemini, PlannerContextPayload } from '@/lib/planner/ai-planner';
import { endOfWeek, startOfWeek, addWeeks, format } from 'date-fns';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            user_id,
            planning_mode,
            number_of_weeks,
            until_date,
            focus_mode,
            preferred_time,
            target_hours_per_week,
            preferred_session_length_minutes,
            max_sessions_per_day,
            intensity,
            subject_filter,
            topic_filter,
            preferred_days,
            avoid_back_to_back_sessions,
            notes_to_ai,
        } = body;

        if (!user_id) {
            return NextResponse.json({ success: false, error: 'user_id is required' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Calculate the horizon dates
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });

        let planEndDate = endOfWeek(today, { weekStartsOn: 1 });
        if (planning_mode === 'number_of_weeks' && number_of_weeks) {
            planEndDate = endOfWeek(addWeeks(weekStart, number_of_weeks - 1), { weekStartsOn: 1 });
        } else if (planning_mode === 'until_date' && until_date) {
            planEndDate = new Date(until_date);
        }

        const startDateStr = format(weekStart, 'yyyy-MM-dd');
        const endDateStr = format(planEndDate, 'yyyy-MM-dd');

        // 2. Fetch all necessary data concurrently
        const [
            { data: availability },
            { data: calendarEvents },
            { data: quizzes },
            { data: quizAttempts },
            { data: deadlines }
        ] = await Promise.all([
            supabase.from('availability').select('*').eq('user_id', user_id),
            supabase.from('calendar_events')
                .select('*')
                .eq('user_id', user_id)
                .gte('start_time', startDateStr)
                .lte('end_time', endDateStr + 'T23:59:59'),
            supabase.from('quizzes').select('*').eq('user_id', user_id),
            supabase.from('quiz_attempts').select('*, quizzes(*)').eq('user_id', user_id),
            supabase.from('calendar_events')
                .select('*')
                .eq('user_id', user_id)
                .eq('event_type', 'deadline')
                .gte('end_time', startDateStr)
        ]);

        // 3. Process Weaknesses
        const attemptsWithQuizzes = (quizAttempts || []).map(a => ({ ...a, quiz: a.quizzes }));
        const weaknesses = calculateWeakness(attemptsWithQuizzes, quizzes || []);

        // Helper to format any date to the user's local TZ string (YYYY-MM-DDTHH:mm:ss)
        // Since we know the user is in +08:00, we can manually adjust or use a fixed formatter
        const toLocalISO = (iso: string) => {
            const date = new Date(iso);
            // Manually add 8 hours for MYT (+08:00)
            const localDate = new Date(date.getTime() + (8 * 60 * 60 * 1000));
            return localDate.toISOString().replace('Z', '');
        };

        // 4. Build AI Payload Context
        const payload: PlannerContextPayload = {
            planning_mode: planning_mode || 'number_of_weeks',
            number_of_weeks: number_of_weeks || null,
            until_date: until_date || null,
            focus_mode: focus_mode || 'balanced',
            preferred_time: preferred_time || 'anytime',
            target_hours_per_week: target_hours_per_week || 10,
            preferred_session_length_minutes: preferred_session_length_minutes || null,
            max_sessions_per_day: max_sessions_per_day || 2,
            intensity: intensity || 'normal',
            subject_filter: subject_filter || null,
            topic_filter: topic_filter || null,
            preferred_days: preferred_days || 'all',
            avoid_back_to_back_sessions: avoid_back_to_back_sessions ?? true,
            notes_to_ai: notes_to_ai || null,
            // These are the general weekly available hours
            free_time_slots: (availability || []).map(a => ({
                day_of_week: a.day_of_week,
                start_time: a.start_time,
                end_time: a.end_time
            })),
            subjects: weaknesses,
            existing_events: (calendarEvents || []).map(e => {
                const localStart = toLocalISO(e.start_time);
                const localEnd = toLocalISO(e.end_time);
                return {
                    id: e.id,
                    title: e.title,
                    event_type: e.event_type,
                    start_time: localStart, // Sent as local YYYY-MM-DDTHH:mm
                    end_time: localEnd
                };
            }),
            deadlines: (deadlines || []).map(d => ({
                title: d.title,
                due_date: toLocalISO(d.end_time)
            }))
        };

        // 5. Call Gemini AI helper
        const generatedSessions = await generatePlanWithGemini(payload);

        return NextResponse.json({
            success: true,
            generated_plan: generatedSessions
        });

    } catch (error: any) {
        console.error('Error generating AI plan:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
