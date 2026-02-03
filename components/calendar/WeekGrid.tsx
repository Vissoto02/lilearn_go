'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
    getWeekDays,
    getNext7Days,
    formatDateKey,
    formatShortDate,
    isTodayTz,
    DAY_NAMES,
} from '@/lib/calendar/date';
import type { CalendarEvent } from '@/lib/calendar/types';
import type { Habit } from '@/lib/types';

interface WeekGridProps {
    /**
     * The reference date - week will be shown based on this
     */
    referenceDate: Date;
    /**
     * If true, shows next 7 days from reference date
     * If false, shows the week containing reference date (Mon-Sun)
     */
    showNext7Days?: boolean;
    events: CalendarEvent[];
    habits: Habit[];
    selectedDate: Date | null;
    onDateSelect: (date: Date) => void;
    className?: string;
    compact?: boolean;
}

export function WeekGrid({
    referenceDate,
    showNext7Days = false,
    events,
    habits,
    selectedDate,
    onDateSelect,
    className,
    compact = false,
}: WeekGridProps) {
    // Get days to display
    const days = useMemo(() => {
        return showNext7Days ? getNext7Days(referenceDate) : getWeekDays(referenceDate);
    }, [referenceDate, showNext7Days]);

    // Build event counts by date
    const eventsByDate = useMemo(() => {
        const map = new Map<string, { studyBlocks: number; deadlines: number; habit: boolean }>();

        for (const day of days) {
            const key = formatDateKey(day);
            map.set(key, { studyBlocks: 0, deadlines: 0, habit: false });
        }

        for (const event of events) {
            const eventDate = event.start_time || event.end_time;
            if (!eventDate) continue;

            const key = formatDateKey(new Date(eventDate));
            const counts = map.get(key);
            if (!counts) continue;

            if (event.event_type === 'study_block') {
                counts.studyBlocks++;
            } else if (event.event_type === 'deadline') {
                counts.deadlines++;
            }
        }

        for (const habit of habits) {
            const counts = map.get(habit.date);
            if (counts && habit.checkin) {
                counts.habit = true;
            }
        }

        return map;
    }, [days, events, habits]);

    return (
        <div className={cn('grid grid-cols-7 gap-2', className)}>
            {days.map((day, index) => {
                const key = formatDateKey(day);
                const counts = eventsByDate.get(key)!;
                const isToday = isTodayTz(day);
                const isSelected = selectedDate && formatDateKey(selectedDate) === key;
                const dayName = showNext7Days
                    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()]
                    : DAY_NAMES[index];

                return (
                    <button
                        key={key}
                        onClick={() => onDateSelect(day)}
                        className={cn(
                            'flex flex-col items-center rounded-lg p-2 transition-colors hover:bg-muted',
                            compact ? 'gap-1' : 'gap-2',
                            isToday && 'bg-primary/10',
                            isSelected && 'ring-2 ring-primary'
                        )}
                    >
                        <span className="text-xs text-muted-foreground">{dayName}</span>
                        <span
                            className={cn(
                                'flex items-center justify-center rounded-full text-sm font-medium',
                                compact ? 'h-7 w-7' : 'h-9 w-9',
                                isToday && 'bg-primary text-primary-foreground'
                            )}
                        >
                            {day.getDate()}
                        </span>
                        {!compact && (
                            <span className="text-xs text-muted-foreground">
                                {formatShortDate(day).split(' ')[0]}
                            </span>
                        )}

                        {/* Event Indicators */}
                        <div className="flex gap-0.5">
                            {counts.studyBlocks > 0 && (
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                            )}
                            {counts.deadlines > 0 && (
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            )}
                            {counts.habit && (
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
