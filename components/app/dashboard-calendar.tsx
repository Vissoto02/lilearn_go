'use client';

import { CalendarWidget } from '@/components/calendar';

/**
 * Dashboard Calendar Section
 * Client component wrapper for embedding the calendar widget in the server-rendered dashboard
 */
export function DashboardCalendar() {
    return <CalendarWidget variant="dashboard" />;
}
