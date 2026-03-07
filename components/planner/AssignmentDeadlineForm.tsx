'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import {
    Plus,
    Trash2,
    CalendarClock,
    ArrowRight,
    SkipForward,
    Loader2,
    BookOpen,
    AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeadlineEntry {
    id: string;
    title: string;
    subject: string;
    dueDate: string;
    dueTime: string;
}

interface AssignmentDeadlineFormProps {
    className?: string;
    onComplete: (count: number) => void;
    onSkip: () => void;
    onBack: () => void;
}

function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

function getDefaultDueDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 7); // Default 1 week from now
    return d.toISOString().split('T')[0];
}

export function AssignmentDeadlineForm({
    className,
    onComplete,
    onSkip,
    onBack,
}: AssignmentDeadlineFormProps) {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [entries, setEntries] = useState<DeadlineEntry[]>([
        {
            id: generateId(),
            title: '',
            subject: '',
            dueDate: getDefaultDueDate(),
            dueTime: '23:59',
        },
    ]);

    const addEntry = () => {
        setEntries((prev) => [
            ...prev,
            {
                id: generateId(),
                title: '',
                subject: '',
                dueDate: getDefaultDueDate(),
                dueTime: '23:59',
            },
        ]);
    };

    const removeEntry = (id: string) => {
        if (entries.length <= 1) return;
        setEntries((prev) => prev.filter((e) => e.id !== id));
    };

    const updateEntry = (id: string, field: keyof DeadlineEntry, value: string) => {
        setEntries((prev) =>
            prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
        );
    };

    const getValidEntries = () => {
        return entries.filter((e) => e.title.trim() !== '' && e.dueDate !== '');
    };

    const handleSave = async () => {
        const valid = getValidEntries();
        if (valid.length === 0) {
            toast({
                title: 'No deadlines to save',
                description: 'Add at least one deadline with a title, or click "Skip for now".',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);

        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Build calendar events for each deadline
            const events = valid.map((entry) => {
                const dueDatetime = `${entry.dueDate}T${entry.dueTime}:00`;
                return {
                    user_id: user.id,
                    title: entry.title.trim(),
                    event_type: 'assignment',
                    start_time: null,
                    end_time: dueDatetime,
                    description: entry.subject ? `Subject: ${entry.subject}` : null,
                    color: '#ef4444', // Red for deadlines
                };
            });

            const { error } = await supabase.from('calendar_events').insert(events);

            if (error) throw new Error(error.message);

            toast({
                title: `${valid.length} deadline${valid.length > 1 ? 's' : ''} saved!`,
                description: 'You can always add or modify deadlines later from the schedule view.',
            });

            onComplete(valid.length);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to save';
            toast({ title: 'Error', description: msg, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className={cn('overflow-hidden', className)}>
            <CardHeader className="bg-gradient-to-r from-rose-600 to-orange-600 text-white pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <CalendarClock className="h-5 w-5" />
                        Assignment Deadlines
                    </CardTitle>
                    <Badge className="bg-white/20 text-white border-0">
                        Step 3 of 3
                    </Badge>
                </div>
                <p className="text-sm text-rose-100 mt-1">
                    Add your assignment deadlines so we can help you plan ahead. You can always add more later!
                </p>
            </CardHeader>

            <CardContent className="pt-5 space-y-5">
                {/* Entries */}
                <div className="space-y-4">
                    {entries.map((entry, index) => (
                        <div
                            key={entry.id}
                            className="relative rounded-lg border border-border/60 p-4 space-y-3 bg-muted/20 hover:border-rose-500/30 transition-colors"
                        >
                            {/* Entry number + delete */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Deadline #{index + 1}
                                </span>
                                {entries.length > 1 && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeEntry(entry.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>

                            {/* Title + Subject */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Assignment Title *</Label>
                                    <Input
                                        placeholder="e.g. Network Security Report"
                                        value={entry.title}
                                        onChange={(e) =>
                                            updateEntry(entry.id, 'title', e.target.value)
                                        }
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Subject / Course</Label>
                                    <Input
                                        placeholder="e.g. DIT1233"
                                        value={entry.subject}
                                        onChange={(e) =>
                                            updateEntry(entry.id, 'subject', e.target.value)
                                        }
                                        className="h-9"
                                    />
                                </div>
                            </div>

                            {/* Due date + time */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Due Date *</Label>
                                    <Input
                                        type="date"
                                        value={entry.dueDate}
                                        onChange={(e) =>
                                            updateEntry(entry.id, 'dueDate', e.target.value)
                                        }
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Due Time</Label>
                                    <Input
                                        type="time"
                                        value={entry.dueTime}
                                        onChange={(e) =>
                                            updateEntry(entry.id, 'dueTime', e.target.value)
                                        }
                                        className="h-9"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add Another button */}
                <Button
                    variant="outline"
                    className="w-full border-dashed gap-2 text-muted-foreground hover:text-rose-600 hover:border-rose-500/50"
                    onClick={addEntry}
                >
                    <Plus className="h-4 w-4" />
                    Add Another Deadline
                </Button>

                {/* Info hint */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                        Don't know your deadlines yet? No worries — click "Skip for now" and add them anytime from the schedule view.
                    </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between gap-3 pt-2">
                    <Button
                        variant="ghost"
                        onClick={onBack}
                        className="text-muted-foreground"
                    >
                        ← Back
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={onSkip}
                            className="gap-2"
                        >
                            <SkipForward className="h-4 w-4" />
                            Skip for now
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || getValidEntries().length === 0}
                            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <ArrowRight className="h-4 w-4" />
                            )}
                            {saving ? 'Saving...' : 'Save & View Schedule'}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
