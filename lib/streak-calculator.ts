// Streak Calculator
// Pure function to calculate study streak from habit records

import { Habit, StreakData, DayStatus } from './types';

/**
 * Calculate current streak, longest streak, and last 7 days status
 * A streak is broken if there's a day with no check-in
 */
export function calculateStreak(habits: Habit[], today: Date = new Date()): StreakData {
    // Normalize today to start of day in UTC
    const todayStr = formatDate(today);

    // Sort habits by date (most recent first)
    const sortedHabits = [...habits].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Create a map for quick lookup
    const habitMap = new Map<string, Habit>();
    for (const habit of sortedHabits) {
        habitMap.set(habit.date, habit);
    }

    // Calculate current streak (consecutive days with check-in ending today or yesterday)
    let currentStreak = 0;
    let checkDate = new Date(today);

    // Allow today to be missing since user might not have checked in yet
    const todayHabit = habitMap.get(todayStr);
    if (!todayHabit?.checkin) {
        // Start counting from yesterday
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
        const dateStr = formatDate(checkDate);
        const habit = habitMap.get(dateStr);

        if (habit?.checkin) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;

    // Go through all dates from oldest to newest
    const allDates = Array.from(habitMap.keys()).sort();
    let prevDate: Date | null = null;

    for (const dateStr of allDates) {
        const habit = habitMap.get(dateStr);
        const currentDate = new Date(dateStr);

        if (habit?.checkin) {
            if (prevDate && isConsecutive(prevDate, currentDate)) {
                tempStreak++;
            } else {
                tempStreak = 1;
            }
            longestStreak = Math.max(longestStreak, tempStreak);
            prevDate = currentDate;
        } else {
            tempStreak = 0;
            prevDate = null;
        }
    }

    // Build last 7 days status
    const last7Days: DayStatus[] = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = formatDate(date);
        const habit = habitMap.get(dateStr);

        last7Days.push({
            date: dateStr,
            checkin: habit?.checkin ?? false,
            minutes: habit?.studied_minutes ?? 0,
        });
    }

    return {
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
        totalDays: habits.filter(h => h.checkin).length,
        last7Days,
    };
}

/**
 * Format date as YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Check if two dates are consecutive (1 day apart)
 */
function isConsecutive(date1: Date, date2: Date): boolean {
    const diffTime = date2.getTime() - date1.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return Math.abs(diffDays - 1) < 0.1; // Account for DST
}

/**
 * Get the number of days since a date
 */
export function daysSince(dateStr: string, today: Date = new Date()): number {
    const date = new Date(dateStr);
    const diffTime = today.getTime() - date.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
