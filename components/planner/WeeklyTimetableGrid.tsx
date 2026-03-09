'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getWeekDays, formatDateKey, isTodayTz } from '@/lib/calendar/date';
import { createStudyBlock, updateCalendarEvent, deleteCalendarEvent, getEventsForDateRange, createManualSchedule, deleteRecurrenceGroup, getSemesterEndDate, getSubjectsAndTopics } from '@/app/actions/calendar';
import type { CalendarEvent, CreateManualScheduleInput } from '@/lib/calendar/types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
    Plus,
    Pencil,
    Trash2,
    MapPin,
    Clock,
    GraduationCap,
    BookOpen,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    Lock,
    Unlock,
    Repeat,
    Coffee,
    AlertTriangle,
    Loader2,
    Sparkles,
    CheckCircle2,
    RefreshCw,
} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, addDays, startOfWeek, parseISO } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

interface TimeSlot {
    hour: number;
    label: string;
}

interface GridEvent {
    event: CalendarEvent;
    dayIndex: number; // 0=Mon, 1=Tue ... 6=Sun
    startRow: number;
    spanRows: number;
}

interface EventDialogData {
    mode: 'create' | 'edit';
    eventId?: string;
    recurrenceGroup?: string | null;
    title: string;
    startTime: string;
    endTime: string;
    dayIndex: number;
    color: string;
    location: string;
    description: string;
    eventType: string;
    isLocked?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_SLOTS: TimeSlot[] = Array.from({ length: 17 }, (_, i) => {
    const hour = i + 7; // 7:00 AM to 11:00 PM (extends to Midnight)
    const h12 = hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return {
        hour,
        label: `${h12}:00 ${ampm}`,
    };
});

const SLOT_HEIGHT = 60; // px per hour
const HEADER_HEIGHT = 52;

// Color palette for events
const EVENT_PALETTE = [
    { name: 'Teal', value: '#14b8a6', bg: 'rgba(20, 184, 166, 0.18)', border: 'rgba(20, 184, 166, 0.5)', text: '#0d9488' },
    { name: 'Indigo', value: '#6366f1', bg: 'rgba(99, 102, 241, 0.18)', border: 'rgba(99, 102, 241, 0.5)', text: '#4f46e5' },
    { name: 'Rose', value: '#f43f5e', bg: 'rgba(244, 63, 94, 0.18)', border: 'rgba(244, 63, 94, 0.5)', text: '#e11d48' },
    { name: 'Amber', value: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.5)', text: '#d97706' },
    { name: 'Violet', value: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.5)', text: '#7c3aed' },
    { name: 'Cyan', value: '#06b6d4', bg: 'rgba(6, 182, 212, 0.18)', border: 'rgba(6, 182, 212, 0.5)', text: '#0891b2' },
    { name: 'Emerald', value: '#10b981', bg: 'rgba(16, 185, 129, 0.18)', border: 'rgba(16, 185, 129, 0.5)', text: '#059669' },
    { name: 'Pink', value: '#ec4899', bg: 'rgba(236, 72, 153, 0.18)', border: 'rgba(236, 72, 153, 0.5)', text: '#db2777' },
];

function getEventColors(color: string) {
    const palette = EVENT_PALETTE.find(p => p.value === color);
    if (palette) return palette;
    // Fallback for unknown colors
    return {
        name: 'Custom',
        value: color,
        bg: `${color}30`,
        border: `${color}80`,
        text: color,
    };
}

// ============================================================================
// Component
// ============================================================================

interface WeeklyTimetableGridProps {
    referenceDate?: Date;
    refreshKey?: number;
    className?: string;
    previewEvents?: CalendarEvent[];
    onClearPreview?: () => void;
    onSavePreview?: () => void;
    onRegeneratePreview?: () => void;
    savingPreview?: boolean;
    previewFocusMode?: string;
}

export function WeeklyTimetableGrid({
    referenceDate,
    refreshKey = 0,
    className,
    previewEvents = [],
    onClearPreview,
    onSavePreview,
    onRegeneratePreview,
    savingPreview = false,
    previewFocusMode,
}: WeeklyTimetableGridProps) {
    const { toast } = useToast();
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const ref = referenceDate || new Date();
        return startOfWeek(ref, { weekStartsOn: 1 });
    });
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<EventDialogData | null>(null);
    const [saving, setSaving] = useState(false);
    const [hoveredSlot, setHoveredSlot] = useState<{ day: number; hour: number } | null>(null);

    // Manual schedule dialog state
    const [manualDialogOpen, setManualDialogOpen] = useState(false);
    const [manualSaving, setManualSaving] = useState(false);
    const [semesterEndDate, setSemesterEndDate] = useState<string | null>(null);
    const [dbSubjects, setDbSubjects] = useState<string[]>([]);
    const [dbTopics, setDbTopics] = useState<{ subject: string; topic: string }[]>([]);
    const [manualForm, setManualForm] = useState({
        title: '',
        activityType: 'manual_study' as 'manual_study' | 'routine',
        subject: '',
        topic: '',
        customLabel: '',
        pickerMode: 'select' as 'select' | 'custom',
        dayIndex: 0,  // 0=Mon..6=Sun in the UI
        startTime: '09:00',
        endTime: '10:00',
        repeatWeeks: 14,
        color: '#0ea5e9',
        location: '',
        description: '',
    });
    const [manualConflicts, setManualConflicts] = useState<string[]>([]);

    // Get the 7 days of the week
    const weekDays = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart]);

    // Fetch events for the current week
    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const startDate = formatDateKey(weekDays[0]);
            const endDate = formatDateKey(addDays(weekDays[6], 1));
            const result = await getEventsForDateRange(startDate, endDate);
            if (result.data) {
                setEvents(result.data);
            }
        } catch (err) {
            console.error('Failed to fetch events:', err);
        } finally {
            setLoading(false);
        }
    }, [weekDays]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents, refreshKey]);

    // Fetch semester end date & subjects/topics once
    useEffect(() => {
        getSemesterEndDate().then(result => {
            if (result.endDate) setSemesterEndDate(result.endDate);
        });
        getSubjectsAndTopics().then(result => {
            if (result.subjects) setDbSubjects(result.subjects);
            if (result.topics) setDbTopics(result.topics);
        });
    }, []);

    // Map events to grid positions (only events with start_time and end_time)
    const gridEvents = useMemo<GridEvent[]>(() => {
        const allEvents = [...events, ...previewEvents];
        return allEvents
            .filter(e => e.start_time && e.end_time)
            .map(event => {
                const start = parseISO(event.start_time!);
                const end = parseISO(event.end_time!);

                const eventDateKey = formatDateKey(start);
                const dayIndex = weekDays.findIndex(d => formatDateKey(d) === eventDateKey);
                if (dayIndex === -1) return null;

                const startHour = start.getHours() + start.getMinutes() / 60;
                const endHour = end.getHours() + end.getMinutes() / 60;
                const startRow = Math.max(0, startHour - 7);
                const spanRows = Math.max(0.5, endHour - startHour);

                return { event, dayIndex, startRow, spanRows };
            })
            .filter(Boolean) as GridEvent[];
    }, [events, previewEvents, weekDays]);

    // Group assignment deadlines by day (these have no time slot on the grid)
    const assignmentsByDay = useMemo(() => {
        const map = new Map<number, CalendarEvent[]>();
        for (const event of events) {
            if (event.event_type !== 'assignment') continue;
            const dateStr = event.end_time || event.start_time;
            if (!dateStr) continue;
            const eventDateKey = formatDateKey(new Date(dateStr));
            const dayIndex = weekDays.findIndex(d => formatDateKey(d) === eventDateKey);
            if (dayIndex === -1) continue;
            if (!map.has(dayIndex)) map.set(dayIndex, []);
            map.get(dayIndex)!.push(event);
        }
        return map;
    }, [events, weekDays]);

    // Navigation
    const goToPreviousWeek = () => {
        setCurrentWeekStart(prev => addDays(prev, -7));
    };
    const goToNextWeek = () => {
        setCurrentWeekStart(prev => addDays(prev, 7));
    };
    const goToCurrentWeek = () => {
        setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    };

    // Open dialog for creating a new event
    const handleCellDoubleClick = (dayIndex: number, hour: number) => {
        const endHour = Math.min(hour + 1, 21);
        setDialogData({
            mode: 'create',
            title: '',
            startTime: `${String(hour).padStart(2, '0')}:00`,
            endTime: `${String(endHour).padStart(2, '0')}:00`,
            dayIndex,
            color: EVENT_PALETTE[0].value,
            location: '',
            description: '',
            eventType: 'study_block',
        });
        setDialogOpen(true);
    };

    // Open dialog for editing an existing event
    const handleEventDoubleClick = (e: React.MouseEvent, gridEvent: GridEvent) => {
        e.stopPropagation();
        const ev = gridEvent.event;
        const start = parseISO(ev.start_time!);
        const end = parseISO(ev.end_time!);
        setDialogData({
            mode: 'edit',
            eventId: ev.id,
            recurrenceGroup: (ev as any).recurrence_group || null,
            title: ev.title,
            startTime: format(start, 'HH:mm'),
            endTime: format(end, 'HH:mm'),
            dayIndex: gridEvent.dayIndex,
            color: ev.color || EVENT_PALETTE[0].value,
            location: (ev as any).location || '',
            description: ev.description || '',
            eventType: ev.event_type,
            isLocked: (ev as any).is_locked || false,
        });
        setDialogOpen(true);
    };

    // Save event (create or update)
    const handleSaveEvent = async () => {
        if (!dialogData) return;
        if (!dialogData.title.trim()) {
            toast({ title: 'Title required', variant: 'destructive' });
            return;
        }

        setSaving(true);
        try {
            const targetDate = weekDays[dialogData.dayIndex];
            const dateStr = formatDateKey(targetDate);
            const startISO = `${dateStr}T${dialogData.startTime}:00+08:00`;
            const endISO = `${dateStr}T${dialogData.endTime}:00+08:00`;

            if (dialogData.mode === 'create') {
                const result = await createStudyBlock({
                    title: dialogData.title,
                    start_time: startISO,
                    end_time: endISO,
                    color: dialogData.color,
                    description: dialogData.description || undefined,
                });
                if (result.error) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                    return;
                }
                toast({ title: 'Event created', description: dialogData.title });
            } else {
                const result = await updateCalendarEvent({
                    id: dialogData.eventId!,
                    title: dialogData.title,
                    start_time: startISO,
                    end_time: endISO,
                    color: dialogData.color,
                    location: dialogData.location || undefined,
                    description: dialogData.description || undefined,
                    is_locked: dialogData.isLocked,
                });
                if (result.error) {
                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                    return;
                }
                toast({ title: 'Event updated', description: dialogData.title });
            }

            setDialogOpen(false);
            setDialogData(null);
            fetchEvents();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to save event', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    // Delete single event
    const handleDeleteEvent = async () => {
        if (!dialogData?.eventId) return;
        setSaving(true);
        try {
            const result = await deleteCalendarEvent(dialogData.eventId);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                return;
            }
            toast({ title: 'Event deleted' });
            setDialogOpen(false);
            setDialogData(null);
            fetchEvents();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    // Delete all events in the same recurrence series
    const handleDeleteSeries = async () => {
        if (!dialogData?.recurrenceGroup) return;
        setSaving(true);
        try {
            const result = await deleteRecurrenceGroup(dialogData.recurrenceGroup);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                return;
            }
            toast({ title: `Deleted ${result.count} event${result.count !== 1 ? 's' : ''} in series` });
            setDialogOpen(false);
            setDialogData(null);
            fetchEvents();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to delete series', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    // Format the week range for the header
    const weekRange = `${format(weekDays[0], 'MMM d')} — ${format(weekDays[6], 'MMM d, yyyy')}`;

    // ======== Manual Schedule Helpers ========

    // Map UI dayIndex (0=Mon..6=Sun) to JS day-of-week (0=Sun..6=Sat)
    const uiDayToJsDow = (uiDay: number) => {
        // 0=Mon→1, 1=Tue→2 ... 5=Sat→6, 6=Sun→0
        return uiDay === 6 ? 0 : uiDay + 1;
    };

    // Calculate last event date for semester-end check
    const manualLastDate = useMemo(() => {
        if (!manualDialogOpen) return null;
        const jsDow = uiDayToJsDow(manualForm.dayIndex);
        const startDate = currentWeekStart;
        const startDow = startDate.getDay();
        let daysUntil = jsDow - startDow;
        if (daysUntil < 0) daysUntil += 7;
        const first = new Date(startDate);
        first.setDate(startDate.getDate() + daysUntil);
        const last = new Date(first);
        last.setDate(first.getDate() + (manualForm.repeatWeeks - 1) * 7);
        return formatDateKey(last);
    }, [manualDialogOpen, manualForm.dayIndex, manualForm.repeatWeeks, currentWeekStart]);

    const exceedsSemester = semesterEndDate && manualLastDate && manualLastDate > semesterEndDate;

    // Check conflicts in the currently-viewed week for the selected slot
    const slotConflict = useMemo(() => {
        if (!manualDialogOpen) return null;
        const targetDay = weekDays[manualForm.dayIndex];
        if (!targetDay) return null;
        const dateStr = formatDateKey(targetDay);
        const proposedStart = new Date(`${dateStr}T${manualForm.startTime}:00+08:00`);
        const proposedEnd = new Date(`${dateStr}T${manualForm.endTime}:00+08:00`);
        if (proposedStart >= proposedEnd) return null;

        const conflicting = events.filter(e => {
            if (!e.start_time || !e.end_time) return false;
            const eStart = new Date(e.start_time);
            const eEnd = new Date(e.end_time);
            return (proposedStart < eEnd && proposedEnd > eStart);
        });

        return conflicting.length > 0 ? conflicting.map(e => e.title) : null;
    }, [manualDialogOpen, manualForm.dayIndex, manualForm.startTime, manualForm.endTime, events, weekDays]);

    const handleOpenManualDialog = () => {
        setManualForm({
            title: '',
            activityType: 'manual_study',
            subject: '',
            topic: '',
            customLabel: '',
            pickerMode: dbSubjects.length > 0 ? 'select' : 'custom',
            dayIndex: 0,
            startTime: '09:00',
            endTime: '10:00',
            repeatWeeks: 14,
            color: '#0ea5e9',
            location: '',
            description: '',
        });
        setManualConflicts([]);
        setManualDialogOpen(true);
    };

    const handleSaveManualSchedule = async () => {
        const computedTitle = manualForm.activityType === 'manual_study' && manualForm.pickerMode === 'select'
            ? (manualForm.topic || manualForm.subject || 'Study Session')
            : manualForm.title.trim();

        if (!computedTitle) {
            toast({ title: 'Title required', variant: 'destructive' });
            return;
        }
        if (manualForm.startTime >= manualForm.endTime) {
            toast({ title: 'End time must be after start time', variant: 'destructive' });
            return;
        }
        if (manualForm.repeatWeeks < 1) {
            toast({ title: 'Repeat weeks must be 1 or higher', variant: 'destructive' });
            return;
        }

        setManualSaving(true);
        setManualConflicts([]);

        const jsDow = uiDayToJsDow(manualForm.dayIndex);
        const startDateStr = formatDateKey(currentWeekStart);

        // Determine subject for the DB
        const resolvedSubject = manualForm.pickerMode === 'custom'
            ? manualForm.customLabel.trim()
            : manualForm.subject;

        const input: CreateManualScheduleInput = {
            title: computedTitle,
            day_of_week: jsDow,
            start_time: manualForm.startTime,
            end_time: manualForm.endTime,
            activity_type: manualForm.activityType,
            subject: resolvedSubject || undefined,
            topic: (manualForm.pickerMode === 'select' && manualForm.topic) ? manualForm.topic : undefined,
            color: manualForm.color,
            description: manualForm.description.trim() || undefined,
            location: manualForm.location.trim() || undefined,
            repeat_weeks: manualForm.repeatWeeks,
            start_date: startDateStr,
        };

        try {
            const result = await createManualSchedule(input);
            if (result.error && (!result.count || result.count === 0)) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                if (result.conflicts) setManualConflicts(result.conflicts);
                return;
            }

            if (result.conflicts && result.conflicts.length > 0) {
                setManualConflicts(result.conflicts);
            }

            toast({
                title: `Created ${result.count} event${result.count !== 1 ? 's' : ''}`,
                description: result.conflicts?.length
                    ? `${result.conflicts.length} week(s) skipped due to conflicts`
                    : `${manualForm.title} scheduled weekly`,
            });

            setManualDialogOpen(false);
            fetchEvents();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to create schedule', variant: 'destructive' });
        } finally {
            setManualSaving(false);
        }
    };

    const MANUAL_STUDY_COLORS = [
        { name: 'Sky', value: '#0ea5e9' },
        { name: 'Indigo', value: '#6366f1' },
        { name: 'Emerald', value: '#10b981' },
        { name: 'Purple', value: '#8b5cf6' },
        { name: 'Amber', value: '#f59e0b' },
    ];
    const ROUTINE_COLORS = [
        { name: 'Slate', value: '#64748b' },
        { name: 'Stone', value: '#78716c' },
        { name: 'Orange', value: '#f97316' },
        { name: 'Lime', value: '#84cc16' },
        { name: 'Zinc', value: '#71717a' },
    ];
    const activeManualColors = manualForm.activityType === 'manual_study' ? MANUAL_STUDY_COLORS : ROUTINE_COLORS;

    return (
        <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
            {/* ============ Header ============ */}
            {previewEvents.length > 0 ? (
                <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-500/30 bg-indigo-500/10 dark:bg-indigo-950/30">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                        <h3 className="text-base font-semibold text-indigo-900 dark:text-indigo-200">
                            AI Plan Generated ({previewEvents.length} sessions)
                        </h3>
                        {previewFocusMode && (
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 ml-2">
                                {previewFocusMode === 'weak_subjects' ? 'Weak Subjects' : 'Balanced'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {onRegeneratePreview && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRegeneratePreview}
                                disabled={savingPreview}
                                className="bg-white/50 dark:bg-black/20 border-indigo-200/50 hover:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                            >
                                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                                Options/Regenerate
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onClearPreview}
                            disabled={savingPreview}
                            className="bg-transparent border-indigo-200/50 hover:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                        >
                            Discard
                        </Button>
                        <Button
                            size="sm"
                            onClick={onSavePreview}
                            disabled={savingPreview}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {savingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Confirm & Save
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-indigo-500/10">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-teal-500" />
                        <h3 className="text-base font-semibold">Weekly Timetable</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenManualDialog}
                            className="gap-1.5 h-8 text-xs border-teal-500/30 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50"
                        >
                            <Repeat className="h-3.5 w-3.5" />
                            Add Recurring
                        </Button>
                        <div className="flex items-center ml-2 border rounded-md overflow-hidden bg-background">
                            <Button variant="ghost" size="icon" onClick={goToPreviousWeek} className="h-8 w-8 rounded-none border-r">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={goToCurrentWeek} className="text-xs font-medium px-4 h-8 rounded-none">
                                {weekRange}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={goToNextWeek} className="h-8 w-8 rounded-none border-l">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ Grid ============ */}
            <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                    {/* Day Headers */}
                    <div className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-border sticky top-0 bg-card z-10">
                        <div className="p-2 text-xs font-medium text-muted-foreground text-center border-r border-border flex items-center justify-center">
                            <Clock className="h-3.5 w-3.5" />
                        </div>
                        {weekDays.map((day, i) => {
                            const isToday = isTodayTz(day);
                            const dayAssignments = assignmentsByDay.get(i) || [];
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        'p-2 text-center border-r border-border last:border-r-0 transition-colors relative',
                                        isToday && 'bg-teal-500/10'
                                    )}
                                >
                                    <p className={cn(
                                        'text-xs font-medium',
                                        isToday ? 'text-teal-600 dark:text-teal-400' : 'text-muted-foreground'
                                    )}>
                                        {DAY_LABELS[i]}
                                    </p>
                                    <p className={cn(
                                        'text-sm font-bold mt-0.5',
                                        isToday
                                            ? 'bg-teal-500 text-white rounded-full w-7 h-7 flex items-center justify-center mx-auto'
                                            : 'text-foreground'
                                    )}>
                                        {day.getDate()}
                                    </p>

                                    {/* Assignment deadline badge */}
                                    {dayAssignments.length > 0 && (
                                        <TooltipProvider delayDuration={200}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 cursor-pointer">
                                                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                                        {dayAssignments.length > 1 && (
                                                            <span className="text-[9px] font-bold text-red-500">
                                                                {dayAssignments.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" className="max-w-[240px] p-0">
                                                    <div className="p-2 space-y-1.5">
                                                        <p className="text-xs font-semibold text-red-500 flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" />
                                                            {dayAssignments.length} Assignment{dayAssignments.length > 1 ? 's' : ''} Due
                                                        </p>
                                                        {dayAssignments.map((a) => (
                                                            <div key={a.id} className="text-xs border-t border-border pt-1">
                                                                <p className="font-medium">{a.title}</p>
                                                                {a.end_time && (
                                                                    <p className="text-muted-foreground">
                                                                        Due {format(parseISO(a.end_time), 'h:mm a')}
                                                                    </p>
                                                                )}
                                                                {a.description && (
                                                                    <p className="text-muted-foreground/70 truncate">
                                                                        {a.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Time Rows */}
                    <div className="relative">
                        {TIME_SLOTS.map((slot, slotIndex) => (
                            <div key={slot.hour} className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-border/50 last:border-b-0">
                                {/* Time Label */}
                                <div className="p-1 pr-2 text-right text-[11px] text-muted-foreground border-r border-border font-mono flex items-start justify-end pt-1" style={{ height: `${SLOT_HEIGHT}px` }}>
                                    {slot.label}
                                </div>

                                {/* Day Cells */}
                                {weekDays.map((day, dayIndex) => {
                                    const isToday = isTodayTz(day);
                                    const isHovered = hoveredSlot?.day === dayIndex && hoveredSlot?.hour === slot.hour;
                                    return (
                                        <div
                                            key={dayIndex}
                                            className={cn(
                                                'relative border-r border-border/50 last:border-r-0 transition-colors cursor-pointer group',
                                                isToday && 'bg-teal-500/[0.03]',
                                                isHovered && 'bg-muted/60'
                                            )}
                                            style={{ height: `${SLOT_HEIGHT}px` }}
                                            onDoubleClick={() => handleCellDoubleClick(dayIndex, slot.hour)}
                                            onMouseEnter={() => setHoveredSlot({ day: dayIndex, hour: slot.hour })}
                                            onMouseLeave={() => setHoveredSlot(null)}
                                        >
                                            {/* Hover hint */}
                                            {isHovered && (
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[1]">
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 bg-muted/80 rounded px-1.5 py-0.5">
                                                        <Plus className="h-3 w-3" />
                                                        Double-click
                                                    </div>
                                                </div>
                                            )}

                                            {/* Half-hour line */}
                                            <div className="absolute left-0 right-0 top-1/2 border-t border-border/20" />
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        {/* ============ Floating Event Blocks ============ */}
                        <div className="absolute inset-0 pointer-events-none" style={{ marginLeft: '72px' }}>
                            {gridEvents.map((ge, idx) => {
                                const colors = getEventColors(ge.event.color);
                                const topPx = ge.startRow * SLOT_HEIGHT;
                                const heightPx = ge.spanRows * SLOT_HEIGHT;
                                // Calculate left offset: each day column is 1/7th of available width
                                const leftPercent = (ge.dayIndex / 7) * 100;
                                const widthPercent = 100 / 7;

                                const eventLocation = (ge.event as any).location;
                                const isTimetable = ge.event.event_type === 'timetable_class';
                                const isDeadline = ge.event.event_type === 'deadline';
                                const isManualStudy = ge.event.event_type === 'manual_study';
                                const isRoutine = ge.event.event_type === 'routine';
                                const isLocked = (ge.event as any).is_locked;

                                return (
                                    <div
                                        key={ge.event.id}
                                        className="absolute pointer-events-auto cursor-pointer rounded-md px-2 py-1 overflow-hidden transition-all duration-150 hover:shadow-lg hover:scale-[1.02] hover:z-20 group/event"
                                        style={{
                                            top: `${topPx}px`,
                                            height: `${Math.max(heightPx - 2, 24)}px`,
                                            left: `calc(${leftPercent}% + 2px)`,
                                            width: `calc(${widthPercent}% - 4px)`,
                                            backgroundColor: colors.bg,
                                            borderLeft: `3px solid ${colors.border}`,
                                            zIndex: 5,
                                        }}
                                        onDoubleClick={(e) => handleEventDoubleClick(e, ge)}
                                        title={`Double-click to edit\n${ge.event.title}${eventLocation ? `\n📍 ${eventLocation}` : ''}`}
                                    >
                                        <div className="flex flex-col h-full overflow-hidden">
                                            <p
                                                className="text-[11px] font-semibold leading-tight truncate"
                                                style={{ color: colors.text }}
                                            >
                                                {isTimetable && <GraduationCap className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                                                {isManualStudy && <BookOpen className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                                                {isRoutine && <Coffee className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                                                {!isTimetable && !isDeadline && !isManualStudy && !isRoutine && <BookOpen className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                                                {ge.event.title}
                                            </p>
                                            {heightPx >= 40 && (
                                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                                    {ge.event.start_time && format(parseISO(ge.event.start_time), 'h:mm a')}
                                                    {' — '}
                                                    {ge.event.end_time && format(parseISO(ge.event.end_time), 'h:mm a')}
                                                </p>
                                            )}
                                            {heightPx >= 56 && eventLocation && (
                                                <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate flex items-center gap-0.5">
                                                    <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                                                    {eventLocation}
                                                </p>
                                            )}
                                        </div>

                                        {/* Edit & Lock indicators on hover */}
                                        <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover/event:opacity-100 transition-opacity">
                                            {isLocked && <Lock className="h-3 w-3" style={{ color: colors.text }} />}
                                            <Pencil className="h-3 w-3" style={{ color: colors.text }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Current time indicator */}
                        <CurrentTimeIndicator weekDays={weekDays} />
                    </div>
                </div>
            </div>

            {/* ============ Event Dialog ============ */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {dialogData?.mode === 'create' ? (
                                <>
                                    <Plus className="h-5 w-5 text-teal-500" />
                                    New Event
                                </>
                            ) : (
                                <>
                                    <Pencil className="h-5 w-5 text-teal-500" />
                                    Edit Event
                                </>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    {dialogData && (
                        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
                            {/* Title and Lock Toggle Row */}
                            <div className="flex gap-4 items-end">
                                <div className="space-y-2 flex-1">
                                    <Label>Title</Label>
                                    <Input
                                        value={dialogData.title}
                                        onChange={e => setDialogData({ ...dialogData, title: e.target.value })}
                                        placeholder="e.g. Data Structures Lecture"
                                        autoFocus
                                    />
                                </div>
                                {dialogData.mode === 'edit' && (
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-muted-foreground ml-1">AI Protection</Label>
                                        <Button
                                            type="button"
                                            variant={dialogData.isLocked ? "default" : "outline"}
                                            size="sm"
                                            className={cn(
                                                "w-28 gap-1.5 h-9",
                                                dialogData.isLocked
                                                    ? "bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                                                    : "text-muted-foreground"
                                            )}
                                            onClick={() => setDialogData({ ...dialogData, isLocked: !dialogData.isLocked })}
                                            title="Prevent the AI Planner from moving or deleting this event"
                                        >
                                            {dialogData.isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                            {dialogData.isLocked ? 'Locked' : 'Unlocked'}
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Day */}
                            <div className="space-y-2">
                                <Label>Day</Label>
                                <Select
                                    value={String(dialogData.dayIndex)}
                                    onValueChange={v => setDialogData({ ...dialogData, dayIndex: parseInt(v) })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FULL_DAY_LABELS.map((day, i) => (
                                            <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Time */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Time</Label>
                                    <Input
                                        type="time"
                                        value={dialogData.startTime}
                                        onChange={e => setDialogData({ ...dialogData, startTime: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Time</Label>
                                    <Input
                                        type="time"
                                        value={dialogData.endTime}
                                        onChange={e => setDialogData({ ...dialogData, endTime: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Location */}
                            <div className="space-y-2">
                                <Label>Location (optional)</Label>
                                <Input
                                    value={dialogData.location}
                                    onChange={e => setDialogData({ ...dialogData, location: e.target.value })}
                                    placeholder="e.g. Room 301"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label>Description (optional)</Label>
                                <Input
                                    value={dialogData.description}
                                    onChange={e => setDialogData({ ...dialogData, description: e.target.value })}
                                    placeholder="e.g. Bring textbook"
                                />
                            </div>

                            {/* Color */}
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex flex-wrap gap-2">
                                    {EVENT_PALETTE.map(c => (
                                        <button
                                            key={c.value}
                                            type="button"
                                            onClick={() => setDialogData({ ...dialogData, color: c.value })}
                                            className={cn(
                                                'w-7 h-7 rounded-full transition-all duration-150 border-2',
                                                dialogData.color === c.value
                                                    ? 'scale-110 ring-2 ring-offset-2 ring-offset-background'
                                                    : 'border-transparent hover:scale-105'
                                            )}
                                            style={{
                                                backgroundColor: c.value,
                                                borderColor: dialogData.color === c.value ? c.value : 'transparent',
                                            }}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex justify-between sm:justify-between">
                        <div className="flex gap-1">
                            {dialogData?.mode === 'edit' && (
                                <>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleDeleteEvent}
                                        disabled={saving}
                                    >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        {dialogData?.recurrenceGroup ? 'This Event' : 'Delete'}
                                    </Button>
                                    {dialogData?.recurrenceGroup && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleDeleteSeries}
                                            disabled={saving}
                                            className="bg-red-700 hover:bg-red-800"
                                        >
                                            <Trash2 className="h-4 w-4 mr-1" />
                                            All in Series
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveEvent} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
                                {saving ? 'Saving...' : dialogData?.mode === 'create' ? 'Add Event' : 'Save Changes'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ============ Manual Schedule Dialog ============ */}
            <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Repeat className="h-5 w-5 text-teal-500" />
                            Add Recurring Schedule
                        </DialogTitle>
                        <DialogDescription>
                            Create a weekly recurring event. It will repeat on the same day and time each week.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
                        {/* Activity Type Toggle */}
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={manualForm.activityType === 'manual_study' ? 'default' : 'outline'}
                                    size="sm"
                                    className={cn(
                                        'flex-1 gap-1.5',
                                        manualForm.activityType === 'manual_study' && 'bg-sky-600 hover:bg-sky-700'
                                    )}
                                    onClick={() => setManualForm(f => ({
                                        ...f,
                                        activityType: 'manual_study',
                                        color: MANUAL_STUDY_COLORS[0].value,
                                    }))}
                                >
                                    <BookOpen className="h-3.5 w-3.5" />
                                    Study Session
                                </Button>
                                <Button
                                    type="button"
                                    variant={manualForm.activityType === 'routine' ? 'default' : 'outline'}
                                    size="sm"
                                    className={cn(
                                        'flex-1 gap-1.5',
                                        manualForm.activityType === 'routine' && 'bg-slate-600 hover:bg-slate-700'
                                    )}
                                    onClick={() => setManualForm(f => ({
                                        ...f,
                                        activityType: 'routine',
                                        color: ROUTINE_COLORS[0].value,
                                    }))}
                                >
                                    <Coffee className="h-3.5 w-3.5" />
                                    Routine / Activity
                                </Button>
                            </div>
                        </div>

                        {/* Title (Hidden if select mode study session) */}
                        {!(manualForm.activityType === 'manual_study' && manualForm.pickerMode === 'select' && dbSubjects.length > 0) && (
                            <div className="space-y-2">
                                <Label>{manualForm.activityType === 'manual_study' ? 'Title / Topic' : 'Activity Name'}</Label>
                                <Input
                                    value={manualForm.title}
                                    onChange={e => setManualForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder={manualForm.activityType === 'manual_study'
                                        ? 'e.g. Data Structures Revision'
                                        : 'e.g. Gym, Lunch Break, Meeting'}
                                />
                            </div>
                        )}

                        {/* Subject & Topic (only for study) */}
                        {manualForm.activityType === 'manual_study' && (
                            <div className="space-y-3">
                                {/* Mode toggle */}
                                {dbSubjects.length > 0 && (
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant={manualForm.pickerMode === 'select' ? 'default' : 'outline'}
                                            size="sm"
                                            className={cn('flex-1 text-xs h-7', manualForm.pickerMode === 'select' && 'bg-indigo-600 hover:bg-indigo-700')}
                                            onClick={() => setManualForm(f => ({ ...f, pickerMode: 'select', customLabel: '' }))}
                                        >
                                            Choose from list
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={manualForm.pickerMode === 'custom' ? 'default' : 'outline'}
                                            size="sm"
                                            className={cn('flex-1 text-xs h-7', manualForm.pickerMode === 'custom' && 'bg-indigo-600 hover:bg-indigo-700')}
                                            onClick={() => setManualForm(f => ({ ...f, pickerMode: 'custom', subject: '', topic: '' }))}
                                        >
                                            Type custom
                                        </Button>
                                    </div>
                                )}

                                {/* Select mode: Subject & Topic dropdowns */}
                                {manualForm.pickerMode === 'select' && dbSubjects.length > 0 && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Subject <span className="text-muted-foreground text-xs">(optional)</span></Label>
                                            <Select
                                                value={manualForm.subject || '__none__'}
                                                onValueChange={v => setManualForm(f => ({
                                                    ...f,
                                                    subject: v === '__none__' ? '' : v,
                                                    topic: '', // reset topic when subject changes
                                                }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a subject" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">— None —</SelectItem>
                                                    {dbSubjects.map(s => (
                                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {/* Topic dropdown — filtered by selected subject */}
                                        {(() => {
                                            const filteredTopics = manualForm.subject
                                                ? dbTopics.filter(t => t.subject === manualForm.subject)
                                                : dbTopics;
                                            const uniqueTopics = Array.from(new Set(filteredTopics.map(t => t.topic))).sort();
                                            return uniqueTopics.length > 0 ? (
                                                <div className="space-y-2">
                                                    <Label>Topic <span className="text-muted-foreground text-xs">(optional)</span></Label>
                                                    <Select
                                                        value={manualForm.topic || '__none__'}
                                                        onValueChange={v => setManualForm(f => ({ ...f, topic: v === '__none__' ? '' : v }))}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a topic" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__none__">— None —</SelectItem>
                                                            {uniqueTopics.map(t => (
                                                                <SelectItem key={t} value={t}>{t}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : null;
                                        })()}
                                    </>
                                )}

                                {/* Custom mode: free text */}
                                {(manualForm.pickerMode === 'custom' || dbSubjects.length === 0) && (
                                    <div className="space-y-2">
                                        <Label>Subject / Label <span className="text-muted-foreground text-xs">(optional)</span></Label>
                                        <Input
                                            value={manualForm.customLabel}
                                            onChange={e => setManualForm(f => ({ ...f, customLabel: e.target.value }))}
                                            placeholder="e.g. Computer Science, Mathematics"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Day */}
                        <div className="space-y-2">
                            <Label>Day of Week</Label>
                            <Select
                                value={String(manualForm.dayIndex)}
                                onValueChange={v => setManualForm(f => ({ ...f, dayIndex: parseInt(v) }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FULL_DAY_LABELS.map((day, i) => (
                                        <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Time</Label>
                                <Input
                                    type="time"
                                    value={manualForm.startTime}
                                    onChange={e => setManualForm(f => ({ ...f, startTime: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Time</Label>
                                <Input
                                    type="time"
                                    value={manualForm.endTime}
                                    onChange={e => setManualForm(f => ({ ...f, endTime: e.target.value }))}
                                />
                            </div>
                        </div>

                        {/* Slot Conflict Warning */}
                        {slotConflict && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                <div className="text-sm">
                                    <p className="font-medium text-red-600 dark:text-red-400">Slot already occupied this week</p>
                                    <p className="text-red-500/80 text-xs mt-0.5">
                                        Conflicts with: {slotConflict.join(', ')}
                                    </p>
                                    <p className="text-red-500/60 text-xs mt-0.5">
                                        Conflicting weeks will be skipped automatically.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Repeat Config */}
                        <div className="space-y-2">
                            <Label>Repeat for</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    min={1}
                                    max={52}
                                    value={manualForm.repeatWeeks === 0 ? '' : manualForm.repeatWeeks}
                                    onChange={e => {
                                        const val = parseInt(e.target.value);
                                        setManualForm(f => ({ ...f, repeatWeeks: isNaN(val) ? 0 : val }));
                                    }}
                                    className={cn("w-20", manualForm.repeatWeeks < 1 && "border-red-500 bg-red-500/10 focus-visible:ring-red-500")}
                                />
                                <span className="text-sm text-muted-foreground">week(s)</span>
                            </div>
                            {manualForm.repeatWeeks < 1 && (
                                <p className="text-xs text-red-500 font-medium">Weeks must be 1 or greater.</p>
                            )}
                            {manualLastDate && manualForm.repeatWeeks >= 1 && (
                                <p className="text-xs text-muted-foreground">
                                    Last event: {manualLastDate}
                                </p>
                            )}
                        </div>

                        {/* Semester End Warning */}
                        {exceedsSemester && (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                <div className="text-sm">
                                    <p className="font-medium text-amber-600 dark:text-amber-400">Extends beyond semester</p>
                                    <p className="text-amber-500/80 text-xs mt-0.5">
                                        Your semester ends on {semesterEndDate}, but this schedule runs until {manualLastDate}. Are you sure you want to continue?
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Location */}
                        <div className="space-y-2">
                            <Label>Location <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input
                                value={manualForm.location}
                                onChange={e => setManualForm(f => ({ ...f, location: e.target.value }))}
                                placeholder="e.g. Library, Room 301, Gym"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input
                                value={manualForm.description}
                                onChange={e => setManualForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="e.g. Focus on Chapter 5"
                            />
                        </div>

                        {/* Color */}
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex flex-wrap gap-2">
                                {activeManualColors.map(c => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => setManualForm(f => ({ ...f, color: c.value }))}
                                        className={cn(
                                            'w-7 h-7 rounded-full transition-all duration-150 border-2',
                                            manualForm.color === c.value
                                                ? 'scale-110 ring-2 ring-offset-2 ring-offset-background'
                                                : 'border-transparent hover:scale-105'
                                        )}
                                        style={{
                                            backgroundColor: c.value,
                                            borderColor: manualForm.color === c.value ? c.value : 'transparent',
                                        }}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Post-submission conflict list */}
                        {manualConflicts.length > 0 && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
                                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Skipped weeks due to conflicts:</p>
                                {manualConflicts.map((c, i) => (
                                    <p key={i} className="text-xs text-amber-500/80">• {c}</p>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setManualDialogOpen(false)} disabled={manualSaving}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveManualSchedule}
                            disabled={manualSaving || !manualForm.title.trim()}
                            className="gap-2 bg-teal-600 hover:bg-teal-700"
                        >
                            {manualSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {manualSaving ? 'Creating...' : `Schedule ${manualForm.repeatWeeks} Week${manualForm.repeatWeeks !== 1 ? 's' : ''}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ============================================================================
// Current Time Indicator
// ============================================================================

function CurrentTimeIndicator({ weekDays }: { weekDays: Date[] }) {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(interval);
    }, []);

    const todayIndex = weekDays.findIndex(d => isTodayTz(d));
    if (todayIndex === -1) return null;

    const currentHour = now.getHours() + now.getMinutes() / 60;
    if (currentHour < 7 || currentHour > 22) return null;

    const topPx = (currentHour - 7) * SLOT_HEIGHT;
    const leftPercent = (todayIndex / 7) * 100;

    return (
        <div
            className="absolute pointer-events-none z-30"
            style={{
                top: `${topPx}px`,
                left: `calc(${leftPercent}%)`,
                width: `calc(${100 / 7}%)`,
            }}
        >
            {/* Dot */}
            <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500" />
            {/* Line */}
            <div className="h-[2px] bg-red-500 w-full" />
        </div>
    );
}
