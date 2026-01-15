// Study Plan Generator
// Creates adaptive study plans based on availability and weakness scores

import {
    Availability,
    TopicWeakness,
    PlanTask,
    Topic
} from './types';
import { formatDate } from './streak-calculator';

export interface TimeSlot {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    durationMinutes: number;
}

export interface StudySession {
    title: string;
    subject: string;
    topic: string;
    startDatetime: Date;
    durationMin: number;
}

/**
 * Generate a weekly study plan based on availability and topic weaknesses
 */
export function generateStudyPlan(
    weekStartDate: Date,
    availability: Availability[],
    topics: Topic[],
    weaknesses: TopicWeakness[],
    targetHoursPerWeek: number = 10
): StudySession[] {
    const sessions: StudySession[] = [];
    const targetMinutes = targetHoursPerWeek * 60;

    // Convert availability to time slots with duration
    const slots = availability
        .map(a => ({
            dayOfWeek: a.day_of_week,
            startTime: a.start_time,
            endTime: a.end_time,
            durationMinutes: calculateDuration(a.start_time, a.end_time),
        }))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    if (slots.length === 0 || topics.length === 0) {
        return [];
    }

    // Calculate priority scores for each topic
    const topicPriorities = calculateTopicPriorities(topics, weaknesses);

    // Distribute study time across slots
    let totalScheduledMinutes = 0;
    const sessionDuration = 45; // Default session length

    for (const slot of slots) {
        if (totalScheduledMinutes >= targetMinutes) break;

        // Calculate how many sessions fit in this slot
        const availableMinutes = Math.min(slot.durationMinutes, 180); // Cap at 3 hours per day
        const sessionsInSlot = Math.floor(availableMinutes / sessionDuration);

        // Get the date for this slot
        const slotDate = getDateForDayOfWeek(weekStartDate, slot.dayOfWeek);

        for (let i = 0; i < sessionsInSlot && totalScheduledMinutes < targetMinutes; i++) {
            // Pick a topic based on priority (weighted random)
            const topic = pickWeightedTopic(topicPriorities);
            if (!topic) break;

            // Calculate session start time
            const startTime = addMinutesToTime(slot.startTime, i * (sessionDuration + 15));
            const startDatetime = combineDateAndTime(slotDate, startTime);

            sessions.push({
                title: `Study ${topic.topic}`,
                subject: topic.subject,
                topic: topic.topic,
                startDatetime,
                durationMin: sessionDuration,
            });

            totalScheduledMinutes += sessionDuration;

            // Reduce priority of scheduled topic to distribute learning
            const priority = topicPriorities.find(p =>
                p.subject === topic.subject && p.topic === topic.topic
            );
            if (priority) {
                priority.score = Math.max(priority.score - 10, 10);
            }
        }
    }

    return sessions;
}

/**
 * Calculate duration between two time strings (HH:MM format)
 */
function calculateDuration(startTime: string, endTime: string): number {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return endMinutes - startMinutes;
}

/**
 * Add minutes to a time string
 */
function addMinutesToTime(time: string, minutes: number): string {
    const [hour, min] = time.split(':').map(Number);
    const totalMinutes = hour * 60 + min + minutes;

    const newHour = Math.floor(totalMinutes / 60) % 24;
    const newMin = totalMinutes % 60;

    return `${String(newHour).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`;
}

/**
 * Get the date for a specific day of week from a week start date
 */
function getDateForDayOfWeek(weekStart: Date, dayOfWeek: number): Date {
    const date = new Date(weekStart);
    const weekStartDay = date.getDay();
    const diff = dayOfWeek - weekStartDay;
    date.setDate(date.getDate() + diff);
    return date;
}

/**
 * Combine a date and time string into a Date object
 */
function combineDateAndTime(date: Date, time: string): Date {
    const [hour, min] = time.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hour, min, 0, 0);
    return result;
}

interface TopicPriority {
    subject: string;
    topic: string;
    score: number;
}

/**
 * Calculate priority scores for topics based on weakness data
 */
function calculateTopicPriorities(
    topics: Topic[],
    weaknesses: TopicWeakness[]
): TopicPriority[] {
    const weaknessMap = new Map<string, TopicWeakness>();
    for (const w of weaknesses) {
        weaknessMap.set(`${w.subject}::${w.topic}`, w);
    }

    return topics.map(t => {
        const key = `${t.subject}::${t.topic}`;
        const weakness = weaknessMap.get(key);

        // Base score
        let score = 50;

        if (weakness) {
            // Lower accuracy = higher priority
            score = 100 - weakness.accuracy;

            // Boost for low attempt counts
            if (weakness.totalAttempts < 5) {
                score += 15;
            }
        } else {
            // Topics with no attempts are high priority
            score = 80;
        }

        // Difficulty preference adjustment
        if (t.difficulty_pref === 'hard') {
            score += 5;
        }

        return {
            subject: t.subject,
            topic: t.topic,
            score: Math.min(score, 100),
        };
    });
}

/**
 * Pick a topic using weighted random selection based on priority
 */
function pickWeightedTopic(priorities: TopicPriority[]): TopicPriority | null {
    if (priorities.length === 0) return null;

    const totalScore = priorities.reduce((sum, p) => sum + p.score, 0);
    if (totalScore === 0) return priorities[0];

    let random = Math.random() * totalScore;

    for (const priority of priorities) {
        random -= priority.score;
        if (random <= 0) {
            return priority;
        }
    }

    return priorities[priorities.length - 1];
}

/**
 * Convert StudySessions to PlanTask format for database insertion
 */
export function sessionsToTasks(
    sessions: StudySession[],
    planId: string
): Omit<PlanTask, 'id' | 'created_at'>[] {
    return sessions.map(session => ({
        plan_id: planId,
        title: session.title,
        subject: session.subject,
        topic: session.topic,
        start_datetime: session.startDatetime.toISOString(),
        duration_min: session.durationMin,
        status: 'todo' as const,
    }));
}

/**
 * Get the start of the current week (Monday)
 */
export function getWeekStartDate(date: Date = new Date()): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Format a week start date as ISO date string
 */
export function formatWeekStartDate(date: Date): string {
    return formatDate(date);
}
