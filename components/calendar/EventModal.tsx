'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatDateKey, nowInTimezone } from '@/lib/calendar/date';
import type {
    CalendarEvent,
    CalendarEventType,
    CreateStudyBlockInput,
    CreateDeadlineInput,
    UpdateEventInput,
    EVENT_COLORS,
} from '@/lib/calendar/types';
import type { Topic } from '@/lib/types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { AlertCircle, BookOpen, Loader2 } from 'lucide-react';

// Color options
const STUDY_BLOCK_COLORS = [
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Amber', value: '#f59e0b' },
];

const DEADLINE_COLORS = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Pink', value: '#ec4899' },
];

interface EventModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editEvent: CalendarEvent | null;
    selectedDate: Date | null;
    topics: Topic[];
    onCreateStudyBlock: (input: CreateStudyBlockInput) => Promise<{ error?: string; conflictWith?: string }>;
    onCreateDeadline: (input: CreateDeadlineInput) => Promise<{ error?: string }>;
    onUpdateEvent: (input: UpdateEventInput) => Promise<{ error?: string; conflictWith?: string }>;
}

export function EventModal({
    open,
    onOpenChange,
    editEvent,
    selectedDate,
    topics,
    onCreateStudyBlock,
    onCreateDeadline,
    onUpdateEvent,
}: EventModalProps) {
    const isEditing = !!editEvent;
    const today = formatDateKey(nowInTimezone());

    // Form state
    const [eventType, setEventType] = useState<CalendarEventType>('study_block');
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [topicId, setTopicId] = useState<string>('none');
    const [color, setColor] = useState('#6366f1');
    const [description, setDescription] = useState('');

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize form when modal opens
    useEffect(() => {
        if (open) {
            if (editEvent) {
                // Editing existing event
                setEventType(editEvent.event_type);
                setTitle(editEvent.title);

                if (editEvent.start_time) {
                    const start = new Date(editEvent.start_time);
                    setDate(formatDateKey(start));
                    setStartTime(formatTimeInput(start));
                }
                if (editEvent.end_time) {
                    const end = new Date(editEvent.end_time);
                    if (editEvent.event_type === 'deadline') {
                        setDate(formatDateKey(end));
                    } else {
                        setEndTime(formatTimeInput(end));
                    }
                }

                setTopicId(editEvent.topic_id || 'none');
                setColor(editEvent.color);
                setDescription(editEvent.description || '');
            } else {
                // Creating new event
                setEventType('study_block');
                setTitle('');
                setDate(selectedDate ? formatDateKey(selectedDate) : today);
                setStartTime('09:00');
                setEndTime('10:00');
                setTopicId('none');
                setColor('#6366f1');
                setDescription('');
            }
            setError(null);
        }
    }, [open, editEvent, selectedDate]);

    // Update color when event type changes
    useEffect(() => {
        if (!isEditing) {
            setColor(eventType === 'deadline' ? '#ef4444' : '#6366f1');
        }
    }, [eventType, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!isEditing && date < today) {
            setError('Cannot create events in the past');
            setLoading(false);
            return;
        }

        try {
            if (isEditing && editEvent) {
                // Update existing event
                const updateInput: UpdateEventInput = {
                    id: editEvent.id,
                    title,
                    color,
                    description: description || undefined,
                    topic_id: topicId === 'none' ? undefined : topicId,
                };

                if (eventType === 'study_block') {
                    updateInput.start_time = `${date}T${startTime}:00+08:00`;
                    updateInput.end_time = `${date}T${endTime}:00+08:00`;
                }

                const result = await onUpdateEvent(updateInput);
                if (result.error) {
                    setError(result.conflictWith
                        ? `Time conflict with "${result.conflictWith}"`
                        : result.error);
                    return;
                }
            } else {
                // Create new event
                if (eventType === 'study_block') {
                    const result = await onCreateStudyBlock({
                        title,
                        start_time: `${date}T${startTime}:00+08:00`,
                        end_time: `${date}T${endTime}:00+08:00`,
                        topic_id: topicId === 'none' ? undefined : topicId,
                        color,
                        description: description || undefined,
                    });

                    if (result.error) {
                        setError(result.conflictWith
                            ? `Time conflict with "${result.conflictWith}"`
                            : result.error);
                        return;
                    }
                } else {
                    const result = await onCreateDeadline({
                        title,
                        due_date: date,
                        topic_id: topicId === 'none' ? undefined : topicId,
                        color,
                        description: description || undefined,
                    });

                    if (result.error) {
                        setError(result.error);
                        return;
                    }
                }
            }

            onOpenChange(false);
        } finally {
            setLoading(false);
        }
    };

    const colorOptions = eventType === 'deadline' ? DEADLINE_COLORS : STUDY_BLOCK_COLORS;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? 'Edit Event' : 'Create Event'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? 'Make changes to your calendar event'
                            : 'Add a new study block or deadline to your calendar'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    {/* Event Type Tabs (only for new events) */}
                    {!isEditing && (
                        <Tabs value={eventType} onValueChange={(v) => setEventType(v as CalendarEventType)}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="study_block" className="gap-2">
                                    <BookOpen className="h-4 w-4" />
                                    Study Block
                                </TabsTrigger>
                                <TabsTrigger value="deadline" className="gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    Deadline
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}

                    <div className="mt-4 space-y-4">
                        {/* Title */}
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={eventType === 'deadline' ? 'Assignment due' : 'Study session'}
                                required
                            />
                        </div>

                        {/* Date */}
                        <div className="space-y-2">
                            <Label htmlFor="date">
                                {eventType === 'deadline' ? 'Due Date' : 'Date'}
                            </Label>
                            <Input
                                id="date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                min={!isEditing ? today : undefined}
                                required
                            />
                        </div>

                        {/* Time (only for study blocks) */}
                        {eventType === 'study_block' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="startTime">Start Time</Label>
                                    <Input
                                        id="startTime"
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endTime">End Time</Label>
                                    <Input
                                        id="endTime"
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* Topic (optional) */}
                        <div className="space-y-2">
                            <Label htmlFor="topic">Topic (Optional)</Label>
                            <Select value={topicId} onValueChange={setTopicId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a topic" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No topic</SelectItem>
                                    {topics.map((topic) => (
                                        <SelectItem key={topic.id} value={topic.id}>
                                            {topic.subject} – {topic.topic}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Color */}
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex gap-2">
                                {colorOptions.map((c) => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => setColor(c.value)}
                                        className={cn(
                                            'h-8 w-8 rounded-full transition-transform hover:scale-110',
                                            color === c.value && 'ring-2 ring-offset-2 ring-primary'
                                        )}
                                        style={{ backgroundColor: c.value }}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Description (optional) */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Notes (Optional)</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add any notes..."
                                rows={3}
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditing ? 'Save Changes' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// Helper function to format time for input
function formatTimeInput(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
