'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getWeekDays, formatDateKey, isTodayTz } from '@/lib/calendar/date';
import { createStudyBlock, updateCalendarEvent, deleteCalendarEvent, getEventsForDateRange } from '@/app/actions/calendar';
import type { CalendarEvent } from '@/lib/calendar/types';
import {
    Dialog,
    DialogContent,
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
} from 'lucide-react';
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
    title: string;
    startTime: string;
    endTime: string;
    dayIndex: number;
    color: string;
    location: string;
    description: string;
    eventType: string;
}

// ============================================================================
// Constants
// ============================================================================

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_SLOTS: TimeSlot[] = Array.from({ length: 15 }, (_, i) => {
    const hour = i + 7; // 7:00 AM to 9:00 PM
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
}

export function WeeklyTimetableGrid({
    referenceDate,
    refreshKey = 0,
    className,
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

    // Map events to grid positions
    const gridEvents = useMemo<GridEvent[]>(() => {
        return events
            .filter(e => e.start_time && e.end_time)
            .map(event => {
                const start = parseISO(event.start_time!);
                const end = parseISO(event.end_time!);

                // Find which day column
                const eventDateKey = formatDateKey(start);
                const dayIndex = weekDays.findIndex(d => formatDateKey(d) === eventDateKey);
                if (dayIndex === -1) return null;

                // Calculate row position (relative to 7:00 AM)
                const startHour = start.getHours() + start.getMinutes() / 60;
                const endHour = end.getHours() + end.getMinutes() / 60;
                const startRow = Math.max(0, startHour - 7);
                const spanRows = Math.max(0.5, endHour - startHour);

                return { event, dayIndex, startRow, spanRows };
            })
            .filter(Boolean) as GridEvent[];
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
            title: ev.title,
            startTime: format(start, 'HH:mm'),
            endTime: format(end, 'HH:mm'),
            dayIndex: gridEvent.dayIndex,
            color: ev.color || EVENT_PALETTE[0].value,
            location: (ev as any).location || '',
            description: ev.description || '',
            eventType: ev.event_type,
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
                    description: dialogData.description || undefined,
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

    // Delete event
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

    // Format the week range for the header
    const weekRange = `${format(weekDays[0], 'MMM d')} — ${format(weekDays[6], 'MMM d, yyyy')}`;

    return (
        <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
            {/* ============ Header ============ */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-indigo-500/10">
                <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-teal-500" />
                    <h3 className="text-base font-semibold">Weekly Timetable</h3>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={goToPreviousWeek} className="h-8 w-8">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={goToCurrentWeek} className="text-xs font-medium px-3 h-8">
                        {weekRange}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={goToNextWeek} className="h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

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
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        'p-2 text-center border-r border-border last:border-r-0 transition-colors',
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
                                                {!isTimetable && !isDeadline && <BookOpen className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
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

                                        {/* Edit indicator on hover */}
                                        <div className="absolute top-1 right-1 opacity-0 group-hover/event:opacity-100 transition-opacity">
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
                <DialogContent className="sm:max-w-md">
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
                        <div className="space-y-4 py-2">
                            {/* Title */}
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input
                                    value={dialogData.title}
                                    onChange={e => setDialogData({ ...dialogData, title: e.target.value })}
                                    placeholder="e.g. Data Structures Lecture"
                                    autoFocus
                                />
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
                        <div>
                            {dialogData?.mode === 'edit' && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteEvent}
                                    disabled={saving}
                                >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                </Button>
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
