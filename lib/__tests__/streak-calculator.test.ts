import { describe, it, expect } from 'vitest';
import { calculateStreak, formatDate } from '../streak-calculator';
import { Habit } from '../types';

// Helper to create a habit record
function createHabit(
    daysAgo: number,
    checkin: boolean,
    minutes: number = 30,
    baseDate: Date = new Date()
): Habit {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - daysAgo);

    return {
        id: `habit-${daysAgo}`,
        user_id: 'test-user',
        date: formatDate(date),
        studied_minutes: minutes,
        checkin,
        study_type: null,
        subject: null,
        topic: null,
        note: null,
        created_at: date.toISOString(),
    };
}

describe('calculateStreak', () => {
    const today = new Date('2024-01-15');

    it('returns zero streak for empty habits', () => {
        const result = calculateStreak([], today);

        expect(result.currentStreak).toBe(0);
        expect(result.longestStreak).toBe(0);
        expect(result.totalDays).toBe(0);
        expect(result.last7Days).toHaveLength(7);
    });

    it('calculates a 3-day streak correctly', () => {
        const habits = [
            createHabit(0, true, 30, today), // today
            createHabit(1, true, 45, today), // yesterday
            createHabit(2, true, 60, today), // 2 days ago
            createHabit(3, false, 0, today), // 3 days ago (break)
        ];

        const result = calculateStreak(habits, today);

        expect(result.currentStreak).toBe(3);
        expect(result.totalDays).toBe(3);
    });

    it('handles streak starting from yesterday when today has no check-in', () => {
        const habits = [
            createHabit(1, true, 30, today), // yesterday
            createHabit(2, true, 45, today), // 2 days ago
        ];

        const result = calculateStreak(habits, today);

        expect(result.currentStreak).toBe(2);
    });

    it('returns 0 streak when yesterday was missed and today not checked in', () => {
        const habits = [
            createHabit(2, true, 30, today), // 2 days ago
            createHabit(3, true, 45, today), // 3 days ago
        ];

        const result = calculateStreak(habits, today);

        expect(result.currentStreak).toBe(0);
    });

    it('calculates longest streak correctly', () => {
        const habits = [
            createHabit(0, true, 30, today), // today (current streak: 1)
            createHabit(1, false, 0, today), // break
            createHabit(2, true, 30, today), // older streak
            createHabit(3, true, 30, today),
            createHabit(4, true, 30, today),
            createHabit(5, true, 30, today), // oldest (4-day streak)
        ];

        const result = calculateStreak(habits, today);

        expect(result.currentStreak).toBe(1);
        expect(result.longestStreak).toBe(4);
    });

    it('returns correct last 7 days data', () => {
        const habits = [
            createHabit(0, true, 60, today),
            createHabit(2, true, 30, today),
            createHabit(5, true, 45, today),
        ];

        const result = calculateStreak(habits, today);

        expect(result.last7Days).toHaveLength(7);

        // Check that the last entry is today
        const todayEntry = result.last7Days[6];
        expect(todayEntry.date).toBe(formatDate(today));
        expect(todayEntry.checkin).toBe(true);
        expect(todayEntry.minutes).toBe(60);
    });

    it('counts total study days correctly', () => {
        const habits = [
            createHabit(0, true, 30, today),
            createHabit(1, false, 0, today),
            createHabit(2, true, 30, today),
            createHabit(3, true, 30, today),
        ];

        const result = calculateStreak(habits, today);

        expect(result.totalDays).toBe(3);
    });
});

describe('formatDate', () => {
    it('formats date as YYYY-MM-DD', () => {
        const date = new Date('2024-01-15T12:00:00Z');
        expect(formatDate(date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('pads single digit months and days', () => {
        const date = new Date(2024, 0, 5); // Jan 5, 2024
        const formatted = formatDate(date);
        expect(formatted).toBe('2024-01-05');
    });
});
