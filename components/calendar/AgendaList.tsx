'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatFullDate, formatTime, formatDateKey } from '@/lib/calendar/date';
import type { CalendarEvent } from '@/lib/calendar/types';
import type { Habit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Clock,
    BookOpen,
    AlertCircle,
    CheckCircle2,
    Pencil,
    Trash2,
    CalendarDays,
} from 'lucide-react';

interface AgendaListProps {
    selectedDate: Date;
    events: CalendarEvent[];
    habits: Habit[];
    onEditEvent: (event: CalendarEvent) => void;
    onDeleteEvent: (eventId: string) => void;
    className?: string;
    maxHeight?: string;
}

export function AgendaList({
    selectedDate,
    events,
    habits,
    onEditEvent,
    onDeleteEvent,
    className,
    maxHeight = '400px',
}: AgendaListProps) {
    const dateKey = formatDateKey(selectedDate);

    // Filter events for selected date
    const { studyBlocks, deadlines, habitData } = useMemo(() => {
        const dayStudyBlocks: CalendarEvent[] = [];
        const dayDeadlines: CalendarEvent[] = [];

        for (const event of events) {
            const eventDate = event.start_time || event.end_time;
            if (!eventDate) continue;

            const eventKey = formatDateKey(new Date(eventDate));
            if (eventKey !== dateKey) continue;

            if (event.event_type === 'study_block') {
                dayStudyBlocks.push(event);
            } else if (event.event_type === 'deadline') {
                dayDeadlines.push(event);
            }
        }

        // Sort study blocks by start time
        dayStudyBlocks.sort((a, b) => {
            if (!a.start_time || !b.start_time) return 0;
            return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        });

        // Find habit for this date
        const habit = habits.find((h) => h.date === dateKey);

        return {
            studyBlocks: dayStudyBlocks,
            deadlines: dayDeadlines,
            habitData: habit,
        };
    }, [events, habits, dateKey]);

    const isEmpty = studyBlocks.length === 0 && deadlines.length === 0 && !habitData?.checkin;

    return (
        <div className={cn('rounded-lg border border-border bg-card', className)}>
            {/* Header */}
            <div className="border-b border-border px-4 py-3">
                <h3 className="font-semibold">{formatFullDate(selectedDate)}</h3>
                <p className="text-sm text-muted-foreground">
                    {studyBlocks.length} study block{studyBlocks.length !== 1 ? 's' : ''} •{' '}
                    {deadlines.length} deadline{deadlines.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Content */}
            <ScrollArea style={{ maxHeight }}>
                <div className="p-4 space-y-4">
                    {isEmpty ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-3" />
                            <p className="text-sm text-muted-foreground">No events for this day</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Click "Add Event" to create one
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Study Blocks */}
                            {studyBlocks.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                        <BookOpen className="h-4 w-4" />
                                        Study Blocks
                                    </h4>
                                    {studyBlocks.map((event) => (
                                        <EventCard
                                            key={event.id}
                                            event={event}
                                            onEdit={onEditEvent}
                                            onDelete={onDeleteEvent}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Deadlines */}
                            {deadlines.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                        <AlertCircle className="h-4 w-4" />
                                        Deadlines
                                    </h4>
                                    {deadlines.map((event) => (
                                        <EventCard
                                            key={event.id}
                                            event={event}
                                            onEdit={onEditEvent}
                                            onDelete={onDeleteEvent}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Habit Check-in */}
                            {habitData?.checkin && (
                                <div className="space-y-2">
                                    <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Habit
                                    </h4>
                                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                            <div>
                                                <p className="font-medium text-green-800 dark:text-green-200">
                                                    Checked in
                                                </p>
                                                <p className="text-sm text-green-600 dark:text-green-400">
                                                    Studied {habitData.studied_minutes} minutes
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

// Individual event card component
interface EventCardProps {
    event: CalendarEvent;
    onEdit: (event: CalendarEvent) => void;
    onDelete: (eventId: string) => void;
}

function EventCard({ event, onEdit, onDelete }: EventCardProps) {
    const isStudyBlock = event.event_type === 'study_block';

    return (
        <div
            className="group relative rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
            style={{ borderLeftColor: event.color, borderLeftWidth: '4px' }}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{event.title}</p>
                    {isStudyBlock && event.start_time && event.end_time && (
                        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                                {formatTime(event.start_time)} – {formatTime(event.end_time)}
                            </span>
                        </div>
                    )}
                    {event.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {event.description}
                        </p>
                    )}
                </div>

                {/* Action buttons (visible on hover) */}
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(event)}
                        aria-label="Edit event"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(event.id)}
                        aria-label="Delete event"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
