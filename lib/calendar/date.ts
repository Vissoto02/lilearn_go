// LiLearn Calendar Date Utilities
// All dates displayed in Asia/Kuala_Lumpur timezone

import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    format,
    parseISO,
    isSameDay,
    isSameMonth,
    addDays,
    addMonths,
    subMonths,
    isToday,
    startOfDay,
    endOfDay,
} from 'date-fns';
import { TZDate } from '@date-fns/tz';

export const TIMEZONE = 'Asia/Kuala_Lumpur';

/**
 * Get current time in Malaysia timezone
 */
export function nowInTimezone(): Date {
    return new TZDate(new Date(), TIMEZONE);
}

/**
 * Format date as YYYY-MM-DD (for keys and comparisons)
 */
export function formatDateKey(date: Date): string {
    return format(date, 'yyyy-MM-dd');
}

/**
 * Get all days to display in a month view (includes padding from prev/next month)
 * Week starts on Monday
 */
export function getMonthViewDays(date: Date): Date[] {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const viewStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const viewEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: viewStart, end: viewEnd });
}

/**
 * Get week days starting from Monday
 */
export function getWeekDays(date: Date): Date[] {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    return eachDayOfInterval({
        start: weekStart,
        end: addDays(weekStart, 6)
    });
}

/**
 * Get the next 7 days starting from a date
 */
export function getNext7Days(date: Date): Date[] {
    return eachDayOfInterval({
        start: date,
        end: addDays(date, 6),
    });
}

/**
 * Check if two time ranges overlap (for conflict detection)
 */
export function hasTimeOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
): boolean {
    return start1 < end2 && start2 < end1;
}

/**
 * Format time for display (e.g., "2:30 PM")
 */
export function formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'h:mm a');
}

/**
 * Format date for display (e.g., "Jan 27")
 */
export function formatShortDate(date: Date): string {
    return format(date, 'MMM d');
}

/**
 * Format date for display (e.g., "Monday, Jan 27")
 */
export function formatFullDate(date: Date): string {
    return format(date, 'EEEE, MMM d');
}

/**
 * Format month for header (e.g., "January 2026")
 */
export function formatMonthYear(date: Date): string {
    return format(date, 'MMMM yyyy');
}

/**
 * Parse ISO string to Date object
 */
export function parseToLocal(isoString: string): Date {
    return new TZDate(parseISO(isoString), TIMEZONE);
}

/**
 * Convert Date to ISO string
 */
export function toISOString(date: Date): string {
    return date.toISOString();
}

/**
 * Get start of day in timezone as ISO string
 */
export function getStartOfDayISO(date: Date): string {
    const tzDate = new TZDate(date, TIMEZONE);
    return startOfDay(tzDate).toISOString();
}

/**
 * Get end of day in timezone as ISO string
 */
export function getEndOfDayISO(date: Date): string {
    const tzDate = new TZDate(date, TIMEZONE);
    return endOfDay(tzDate).toISOString();
}

/**
 * Check if date is same day (timezone aware)
 */
export function isSameDayTz(date1: Date, date2: Date): boolean {
    return isSameDay(date1, date2);
}

/**
 * Check if date is in same month
 */
export function isSameMonthTz(date1: Date, date2: Date): boolean {
    return isSameMonth(date1, date2);
}

/**
 * Check if date is today
 */
export function isTodayTz(date: Date): boolean {
    return isToday(date);
}

/**
 * Navigate to next month
 */
export function nextMonth(date: Date): Date {
    return addMonths(date, 1);
}

/**
 * Navigate to previous month
 */
export function prevMonth(date: Date): Date {
    return subMonths(date, 1);
}

/**
 * Day names for header (starting Monday)
 */
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * Full day names
 */
export const FULL_DAY_NAMES = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
] as const;
