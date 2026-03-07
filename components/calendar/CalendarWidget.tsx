'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDateKey, nowInTimezone } from '@/lib/calendar/date';
import { MonthGrid, WeekGrid, AgendaList, EventModal } from '@/components/calendar';
import type { CalendarEvent, CalendarFilter, CreateStudyBlockInput, CreateDeadlineInput, UpdateEventInput } from '@/lib/calendar/types';
import type { Topic, Habit } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import {
    createStudyBlock,
    createDeadline,
    updateCalendarEvent,
    deleteCalendarEvent,
} from '@/app/actions/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar, Filter } from 'lucide-react';

interface CalendarWidgetProps {
    /**
     * 'dashboard' for compact week view
     * 'planner' for full month view with filters
     */
    variant: 'dashboard' | 'planner';
    className?: string;
}

export function CalendarWidget({ variant, className }: CalendarWidgetProps) {
    const { toast } = useToast();

    // State
    const [currentMonth, setCurrentMonth] = useState(() => nowInTimezone());
    const [selectedDate, setSelectedDate] = useState<Date | null>(() => nowInTimezone());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [habits, setHabits] = useState<Habit[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [filter, setFilter] = useState<CalendarFilter>('all');
    const [loading, setLoading] = useState(true);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);

    // Fetch data
    const fetchData = useCallback(async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get date range for current view
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const viewStart = new Date(year, month - 1, 1);
        const viewEnd = new Date(year, month + 2, 0);

        const [eventsResult, habitsResult, topicsResult] = await Promise.all([
            supabase
                .from('calendar_events')
                .select('*')
                .eq('user_id', user.id)
                .gte('end_time', viewStart.toISOString())
                .lte('end_time', viewEnd.toISOString())
                .order('start_time', { ascending: true, nullsFirst: false }),
            supabase
                .from('habits')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', formatDateKey(viewStart))
                .lte('date', formatDateKey(viewEnd)),
            supabase
                .from('topics')
                .select('*')
                .eq('user_id', user.id),
        ]);

        if (eventsResult.data) setEvents(eventsResult.data);
        if (habitsResult.data) setHabits(habitsResult.data);
        if (topicsResult.data) setTopics(topicsResult.data);
        setLoading(false);
    }, [currentMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Event handlers
    const handleCreateStudyBlock = async (input: CreateStudyBlockInput) => {
        const result = await createStudyBlock(input);
        if (!result.error && result.data) {
            setEvents((prev) => [...prev, result.data!]);
            toast({ title: 'Study block created' });
        }
        return result;
    };

    const handleCreateDeadline = async (input: CreateDeadlineInput) => {
        const result = await createDeadline(input);
        if (!result.error && result.data) {
            setEvents((prev) => [...prev, result.data!]);
            toast({ title: 'Deadline created' });
        }
        return result;
    };

    const handleUpdateEvent = async (input: UpdateEventInput) => {
        const result = await updateCalendarEvent(input);
        if (!result.error && result.data) {
            setEvents((prev) => prev.map((e) => (e.id === input.id ? result.data! : e)));
            toast({ title: 'Event updated' });
        }
        return result;
    };

    const handleDeleteEvent = async (eventId: string) => {
        const result = await deleteCalendarEvent(eventId);
        if (!result.error) {
            setEvents((prev) => prev.filter((e) => e.id !== eventId));
            toast({ title: 'Event deleted' });
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    const handleEditEvent = (event: CalendarEvent) => {
        setEditEvent(event);
        setModalOpen(true);
    };

    const handleOpenCreate = () => {
        setEditEvent(null);
        setModalOpen(true);
    };

    // Dashboard variant - compact
    if (variant === 'dashboard') {
        return (
            <Card className={className}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        This Week
                    </CardTitle>
                    <Button size="sm" onClick={handleOpenCreate}>
                        <Plus className="mr-1 h-4 w-4" />
                        Add
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    <WeekGrid
                        referenceDate={nowInTimezone()}
                        showNext7Days
                        events={events}
                        habits={habits}
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        compact
                    />

                    {selectedDate && (
                        <AgendaList
                            selectedDate={selectedDate}
                            events={events}
                            habits={habits}
                            onEditEvent={handleEditEvent}
                            onDeleteEvent={handleDeleteEvent}
                            maxHeight="200px"
                        />
                    )}
                </CardContent>

                <EventModal
                    open={modalOpen}
                    onOpenChange={setModalOpen}
                    editEvent={editEvent}
                    selectedDate={selectedDate}
                    topics={topics}
                    onCreateStudyBlock={handleCreateStudyBlock}
                    onCreateDeadline={handleCreateDeadline}
                    onUpdateEvent={handleUpdateEvent}
                />
            </Card>
        );
    }

    // Planner variant - full calendar
    return (
        <div className={className}>
            {/* Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={filter} onValueChange={(v) => setFilter(v as CalendarFilter)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Events</SelectItem>
                            <SelectItem value="study_block">Study Blocks</SelectItem>
                            <SelectItem value="deadline">Deadlines</SelectItem>
                            <SelectItem value="assignment">Assignments</SelectItem>
                            <SelectItem value="timetable_class">Timetable</SelectItem>
                            <SelectItem value="habit">Habits</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleOpenCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Event
                </Button>
            </div>

            {/* Calendar Grid + Agenda */}
            <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
                <Card>
                    <CardContent className="pt-6">
                        <MonthGrid
                            currentMonth={currentMonth}
                            events={events}
                            habits={habits}
                            selectedDate={selectedDate}
                            filter={filter}
                            onDateSelect={setSelectedDate}
                            onMonthChange={setCurrentMonth}
                        />
                    </CardContent>
                </Card>

                {selectedDate && (
                    <AgendaList
                        selectedDate={selectedDate}
                        events={events}
                        habits={habits}
                        onEditEvent={handleEditEvent}
                        onDeleteEvent={handleDeleteEvent}
                        maxHeight="500px"
                    />
                )}
            </div>

            <EventModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                editEvent={editEvent}
                selectedDate={selectedDate}
                topics={topics}
                onCreateStudyBlock={handleCreateStudyBlock}
                onCreateDeadline={handleCreateDeadline}
                onUpdateEvent={handleUpdateEvent}
            />
        </div>
    );
}
