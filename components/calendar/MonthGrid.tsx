'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
    getMonthViewDays,
    formatDateKey,
    formatMonthYear,
    isSameMonthTz,
    isTodayTz,
    nextMonth,
    prevMonth,
    DAY_NAMES,
} from '@/lib/calendar/date';
import type { CalendarEvent, CalendarFilter, DayEvents } from '@/lib/calendar/types';
import type { Habit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthGridProps {
    currentMonth: Date;
    events: CalendarEvent[];
    habits: Habit[];
    selectedDate: Date | null;
    filter: CalendarFilter;
    onDateSelect: (date: Date) => void;
    onMonthChange: (date: Date) => void;
    className?: string;
}

export function MonthGrid({
    currentMonth,
    events,
    habits,
    selectedDate,
    filter,
    onDateSelect,
    onMonthChange,
    className,
}: MonthGridProps) {
    // Get all days to display in the grid
    const days = useMemo(() => getMonthViewDays(currentMonth), [currentMonth]);

    // Build a map of events by date
    const eventsByDate = useMemo(() => {
        const map = new Map<string, DayEvents>();

        // Initialize all days
        for (const day of days) {
            const key = formatDateKey(day);
            map.set(key, {
                date: day,
                dateKey: key,
                studyBlocks: [],
                deadlines: [],
                habitCheckin: false,
                habitMinutes: 0,
            });
        }

        // Add events
        for (const event of events) {
            // For study blocks, use start_time date
            // For deadlines, use end_time date
            const eventDate = event.start_time || event.end_time;
            if (!eventDate) continue;

            const key = formatDateKey(new Date(eventDate));
            const dayEvents = map.get(key);
            if (!dayEvents) continue;

            if (event.event_type === 'study_block' || event.event_type === 'timetable_class') {
                dayEvents.studyBlocks.push(event);
            } else if (event.event_type === 'deadline' || event.event_type === 'assignment') {
                dayEvents.deadlines.push(event);
            }
        }

        // Add habit check-ins
        for (const habit of habits) {
            const key = habit.date;
            const dayEvents = map.get(key);
            if (dayEvents && habit.checkin) {
                dayEvents.habitCheckin = true;
                dayEvents.habitMinutes = habit.studied_minutes;
            }
        }

        return map;
    }, [days, events, habits]);

    return (
        <div className={cn('space-y-4', className)}>
            {/* Month Header */}
            <div className="flex items-center justify-between">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onMonthChange(prevMonth(currentMonth))}
                    aria-label="Previous month"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-lg font-semibold">{formatMonthYear(currentMonth)}</h2>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onMonthChange(nextMonth(currentMonth))}
                    aria-label="Next month"
                >
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>

            {/* Day Names Header */}
            <div className="grid grid-cols-7 gap-1">
                {DAY_NAMES.map((day) => (
                    <div
                        key={day}
                        className="py-2 text-center text-xs font-medium text-muted-foreground"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                    const key = formatDateKey(day);
                    const dayEvents = eventsByDate.get(key)!;
                    const isCurrentMonth = isSameMonthTz(day, currentMonth);
                    const isToday = isTodayTz(day);
                    const isSelected = selectedDate && formatDateKey(selectedDate) === key;

                    // Filter events based on current filter
                    const showStudyBlocks = filter === 'all' || filter === 'study_block' || filter === 'timetable_class';
                    const showDeadlines = filter === 'all' || filter === 'deadline' || filter === 'assignment';
                    const showHabits = filter === 'all' || filter === 'habit';

                    const hasStudyBlocks = dayEvents.studyBlocks.length > 0 && showStudyBlocks;
                    const hasDeadlines = dayEvents.deadlines.length > 0 && showDeadlines;
                    const hasHabit = dayEvents.habitCheckin && showHabits;

                    return (
                        <button
                            key={key}
                            onClick={() => onDateSelect(day)}
                            className={cn(
                                'relative flex h-12 flex-col items-center justify-start rounded-lg p-1 text-sm transition-colors hover:bg-muted',
                                !isCurrentMonth && 'text-muted-foreground/50',
                                isToday && 'bg-primary/10 font-semibold',
                                isSelected && 'ring-2 ring-primary'
                            )}
                        >
                            <span
                                className={cn(
                                    'flex h-6 w-6 items-center justify-center rounded-full',
                                    isToday && 'bg-primary text-primary-foreground'
                                )}
                            >
                                {day.getDate()}
                            </span>

                            {/* Event Indicators */}
                            <div className="mt-0.5 flex gap-0.5">
                                {hasStudyBlocks && (
                                    <span
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{ backgroundColor: dayEvents.studyBlocks[0]?.color || '#6366f1' }}
                                        title={`${dayEvents.studyBlocks.length} study block(s)`}
                                    />
                                )}
                                {hasDeadlines && (
                                    <span
                                        className="h-1.5 w-1.5 rounded-full bg-red-500"
                                        title={`${dayEvents.deadlines.length} deadline(s)`}
                                    />
                                )}
                                {hasHabit && (
                                    <span
                                        className="h-1.5 w-1.5 rounded-full bg-green-500"
                                        title="Studied today"
                                    />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
