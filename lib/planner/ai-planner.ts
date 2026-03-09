import { GoogleGenAI } from '@google/genai';

export interface GeneratedSession {
    date: string;       // YYYY-MM-DD
    start_time: string; // HH:MM
    end_time: string;   // HH:MM
    subject: string;
    topic: string | null;
    reason: string;
}

export interface PlannerContextPayload {
    planning_mode: 'number_of_weeks' | 'until_date';
    number_of_weeks: number | null;
    until_date: string | null;
    focus_mode: 'weak_subjects' | 'balanced';
    preferred_time: 'morning' | 'afternoon' | 'night' | 'anytime';
    target_hours_per_week: number;
    preferred_session_length_minutes: number | null;
    max_sessions_per_day: number;
    intensity: 'light' | 'normal' | 'intensive';
    subject_filter: string[] | null;
    topic_filter: string | null;
    preferred_days: 'weekdays' | 'weekends' | 'all';
    avoid_back_to_back_sessions: boolean;
    notes_to_ai: string | null;
    free_time_slots: any[];
    subjects: any[];
    existing_events: any[];
    deadlines: any[];
}

export async function generatePlanWithGemini(context: PlannerContextPayload): Promise<GeneratedSession[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a study planner AI. Generate a realistic study or revision schedule based on the provided context.

Context:
${JSON.stringify(context, null, 2)}

Rules strictly follow:
1. AVAILABILITY: Use the provided free_time_slots. HOWEVER, if preferred_days is "all" or "weekends", you MUST generate sessions on Saturday and Sunday even if they are missing from free_time_slots. In that case, use a default window of 09:00 to 21:00 for weekends.
2. OVERLAP: ABSOLUTELY Do NOT overlap with any of the existing_events. This is your highest priority. Check the times of your existing_events (classes) and stay clear of them.
3. SCHEDULE WINDOW: If preferred_time is morning, aim for 6am-12pm. If afternoon, 12pm-5pm. If night, 5pm onwards. If anytime, spread realistically.
4. DAY FILTERING: If preferred_days is weekdays, avoid Sat/Sun. If weekends, avoid Mon-Fri. If 'all', use the entire week (Mon-Sun).
5. SESSION LIMITS: Do NOT schedule more than max_sessions_per_day (${context.max_sessions_per_day}) sessions on a single day.
6. BACK-TO-BACK: If avoid_back_to_back_sessions is true (${context.avoid_back_to_back_sessions}), leave at least a 30m break between sessions on the same day.
7. TARGET HOURS: Create roughly ${context.target_hours_per_week} hours of study total per week. If intensity is "light", lean towards fewer sessions. If "intensive", pack the slots.
8. SESSION LENGTH: Ideally blocks should be 30 to 90 mins. If preferred_session_length_minutes (${context.preferred_session_length_minutes}) is set, strictly adhere to it unless slot is smaller.
9. FOCUS: If focus_mode is "weak_subjects", prioritize weaker subjects more frequently. If "balanced", distribute evenly.
10. FILTERS: If subject_filter is provided (${context.subject_filter ? context.subject_filter.join(', ') : 'none'}), generate sessions ONLY for those subjects. If topic_filter is provided (${context.topic_filter ? context.topic_filter : 'none'}), generate ONLY for those topics.
11. NOTES: User notes for you: ${context.notes_to_ai || 'None'}
12. Return ONLY a valid JSON array of objects.
13. Human-like distribution: Spread sessions out logically across the week, do not cram them all into a single day just because there is free time. Make it a realistic human schedule.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'OBJECT',
                properties: {
                    study_plan: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                date: { type: 'STRING', description: 'YYYY-MM-DD' },
                                start_time: { type: 'STRING', description: 'HH:MM in 24-hr format' },
                                end_time: { type: 'STRING', description: 'HH:MM in 24-hr format' },
                                subject: { type: 'STRING' },
                                topic: { type: 'STRING', nullable: true },
                                reason: { type: 'STRING' }
                            },
                            required: ['date', 'start_time', 'end_time', 'subject', 'reason']
                        }
                    }
                },
                required: ['study_plan']
            }
        }
    });

    const text = response.text;
    if (!text) {
        throw new Error('AI returned empty response');
    }

    try {
        const parsed = JSON.parse(text);
        if (parsed.study_plan && Array.isArray(parsed.study_plan)) {
            return validateGeneratedPlan(parsed.study_plan, context.existing_events, context.max_sessions_per_day || 2);
        }
        return [];
    } catch (e) {
        throw new Error('Failed to parse AI JSON response');
    }
}

export function validateGeneratedPlan(sessions: any[], existingEvents: any[] = [], limitSessionCountPerDay: number = 2): GeneratedSession[] {
    const valid: GeneratedSession[] = [];
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // Helper to check for overlap between two time ranges on the same date
    const overlaps = (date1: string, start1: string, end1: string, date2: string, start2: string, end2: string) => {
        if (date1 !== date2) return false;
        return start1 < end2 && start2 < end1;
    };

    // Track sessions per day to enforce max_sessions_per_day on backend side
    const dayCounts: Record<string, number> = {};

    for (const session of sessions) {
        if (!session.date || !dateRegex.test(session.date)) continue;
        if (!session.start_time || !timeRegex.test(session.start_time)) continue;
        if (!session.end_time || !timeRegex.test(session.end_time)) continue;
        if (!session.subject) continue;

        // Ensure start_time < end_time
        if (session.start_time >= session.end_time) continue;

        // 1. Check STRICT overlap against existing_events
        let hasConflict = false;
        for (const existing of existingEvents) {
            // Now start_time is local ISO: YYYY-MM-DDTHH:mm:ss
            const parts = existing.start_time.split('T');
            const eDate = parts[0];
            const eTimeFull = parts[1] || '00:00';
            const eStart = eTimeFull.substring(0, 5);

            const endParts = existing.end_time.split('T');
            const eEnd = (endParts[1] || '23:59').substring(0, 5);

            if (overlaps(session.date, session.start_time, session.end_time, eDate, eStart, eEnd)) {
                hasConflict = true;
                break;
            }
        }

        if (hasConflict) continue;

        // 2. Enforce max sessions per day
        if (!dayCounts[session.date]) {
            dayCounts[session.date] = 0;
        }

        if (dayCounts[session.date] >= limitSessionCountPerDay) {
            continue;
        }

        dayCounts[session.date]++;

        valid.push({
            date: session.date,
            start_time: session.start_time,
            end_time: session.end_time,
            subject: session.subject,
            topic: session.topic || null,
            reason: session.reason || 'AI generated session',
        });
    }

    // Deduplicate exact matches
    const deduped = valid.filter((v, i, a) =>
        a.findIndex(t => (t.date === v.date && t.start_time === v.start_time && t.end_time === v.end_time)) === i
    );

    return deduped;
}
