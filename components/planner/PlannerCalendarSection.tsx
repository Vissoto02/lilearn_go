'use client';

import { CalendarWidget } from '@/components/calendar';

interface PlannerCalendarSectionProps {
    /** Increment this to force CalendarWidget to re-fetch events */
    refreshKey: number;
    className?: string;
}

/**
 * Thin wrapper around CalendarWidget for the planner page.
 * Uses the `key` prop to force re-mount (and thus re-fetch) when
 * new timetable events are inserted.
 */
export function PlannerCalendarSection({ refreshKey, className }: PlannerCalendarSectionProps) {
    return (
        <CalendarWidget
            key={`planner-calendar-${refreshKey}`}
            variant="planner"
            className={className}
        />
    );
}
