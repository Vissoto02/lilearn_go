'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    CheckCircle2,
    Loader2,
    RotateCcw,
    Trash2,
    Plus,
    AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { confirmTimetableEvents } from '@/app/actions/timetable';
import type { TimetableItem, ConfirmTimetableInput } from '@/lib/timetable/types';
import { VALID_DAYS } from '@/lib/timetable/types';

interface TimetablePreviewTableProps {
    uploadId: string;
    initialItems: TimetableItem[];
    onConfirmed: (count: number) => void;
    onDiscard: () => void;
}

export function TimetablePreviewTable({
    uploadId,
    initialItems,
    onConfirmed,
    onDiscard,
}: TimetablePreviewTableProps) {
    const { toast } = useToast();
    const [items, setItems] = useState<TimetableItem[]>(initialItems);
    const [semesterStartDate, setSemesterStartDate] = useState('');
    const [weeks, setWeeks] = useState(14);
    const [confirming, setConfirming] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    // Update a single item
    const updateItem = (index: number, field: keyof TimetableItem, value: string) => {
        setItems(prev => prev.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        ));
        setErrors([]); // Clear errors on edit
    };

    // Add a new empty row
    const addItem = () => {
        setItems(prev => [...prev, { day: 'Mon', start: '08:00', end: '09:00', title: '', location: '' }]);
    };

    // Remove a row
    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    // Validate all items client-side
    const validateItems = (): string[] => {
        const errs: string[] = [];

        if (!semesterStartDate) {
            errs.push('Semester start date is required');
        }

        if (items.length === 0) {
            errs.push('At least one class session is required');
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            if (!VALID_DAYS.includes(item.day as typeof VALID_DAYS[number])) {
                errs.push(`Row ${i + 1}: Select a valid day`);
            }

            if (!/^\d{2}:\d{2}$/.test(item.start)) {
                errs.push(`Row ${i + 1}: Start time must be HH:MM`);
            }

            if (!/^\d{2}:\d{2}$/.test(item.end)) {
                errs.push(`Row ${i + 1}: End time must be HH:MM`);
            }

            if (item.start >= item.end) {
                errs.push(`Row ${i + 1}: End time must be after start time`);
            }

            if (!item.title.trim()) {
                errs.push(`Row ${i + 1}: Title is required`);
            }
        }

        return errs;
    };

    // Confirm and insert events
    const handleConfirm = async () => {
        const validationErrors = validateItems();
        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        setConfirming(true);
        setErrors([]);

        try {
            const input: ConfirmTimetableInput = {
                upload_id: uploadId,
                items,
                semester_start_date: semesterStartDate,
                weeks,
            };

            const result = await confirmTimetableEvents(input);

            if (result.error) {
                setErrors([result.error]);
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({
                    title: 'Timetable confirmed!',
                    description: `${result.count} events added to your calendar.`,
                });
                onConfirmed(result.count || 0);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Confirmation failed';
            setErrors([msg]);
        } finally {
            setConfirming(false);
        }
    };

    return (
        <Card className="border-teal-200 dark:border-teal-800/50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-teal-600" />
                        Review Extracted Classes
                        <Badge variant="secondary" className="ml-1">
                            {items.length} sessions
                        </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-teal-600/10 text-teal-600 border-teal-600/20">
                            Step 2 of 3
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={onDiscard} className="text-muted-foreground">
                            <Trash2 className="mr-1 h-3 w-3" />
                            Discard
                        </Button>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground">
                    Edit any incorrect values below, then confirm to save and continue.
                </p>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Validation errors */}
                {errors.length > 0 && (
                    <div className="rounded-lg bg-destructive/10 p-3 space-y-1">
                        {errors.map((err, i) => (
                            <p key={i} className="text-sm text-destructive flex items-start gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                {err}
                            </p>
                        ))}
                    </div>
                )}

                {/* Items table */}
                <div className="rounded-lg border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[100px]">Day</TableHead>
                                <TableHead className="w-[100px]">Start</TableHead>
                                <TableHead className="w-[100px]">End</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={index} className="group">
                                    <TableCell>
                                        <Select
                                            value={item.day}
                                            onValueChange={(v) => updateItem(index, 'day', v)}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {VALID_DAYS.map((day) => (
                                                    <SelectItem key={day} value={day}>{day}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="time"
                                            value={item.start}
                                            onChange={(e) => updateItem(index, 'start', e.target.value)}
                                            className="h-8 text-xs"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="time"
                                            value={item.end}
                                            onChange={(e) => updateItem(index, 'end', e.target.value)}
                                            className="h-8 text-xs"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            value={item.title}
                                            onChange={(e) => updateItem(index, 'title', e.target.value)}
                                            placeholder="Class name"
                                            className="h-8 text-xs"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            value={item.location}
                                            onChange={(e) => updateItem(index, 'location', e.target.value)}
                                            placeholder="Room / Lab"
                                            className="h-8 text-xs"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => removeItem(index)}
                                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Add row button */}
                <Button size="sm" variant="outline" onClick={addItem} className="w-full">
                    <Plus className="mr-1 h-3 w-3" />
                    Add Class Session
                </Button>

                {/* Semester config */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                    <div className="space-y-2">
                        <Label htmlFor="semesterStart" className="text-sm font-medium">
                            Semester Start Date <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="semesterStart"
                            type="date"
                            value={semesterStartDate}
                            onChange={(e) => {
                                setSemesterStartDate(e.target.value);
                                setErrors([]);
                            }}
                            className="h-9"
                        />
                        <p className="text-xs text-muted-foreground">
                            First day of your semester/term
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="weeks" className="text-sm font-medium">
                            Number of Weeks
                        </Label>
                        <Input
                            id="weeks"
                            type="number"
                            value={weeks === 0 ? '' : weeks}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                    setWeeks(0);
                                } else {
                                    setWeeks(Math.min(52, parseInt(val) || 0));
                                }
                            }}
                            min={1}
                            max={52}
                            className={`h-9 w-24 ${weeks < 1 ? 'border-destructive' : ''}`}
                        />
                        {weeks < 1 ? (
                            <p className="text-xs text-destructive">
                                Must be at least 1 week
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                How many weeks to generate (1–52)
                            </p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                    <Button
                        onClick={handleConfirm}
                        disabled={confirming}
                        className="bg-teal-600 hover:bg-teal-700 flex-1 sm:flex-none"
                    >
                        {confirming ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Confirm & Next →
                    </Button>
                    <Button variant="outline" onClick={onDiscard} disabled={confirming}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Re-upload
                    </Button>
                </div>

                {/* Event count preview */}
                <p className="text-xs text-muted-foreground">
                    This will create <strong>{items.length * weeks}</strong> events
                    ({items.length} classes × {weeks} weeks)
                </p>
            </CardContent>
        </Card>
    );
}
