'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { PlanTask } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Clock, SkipForward } from 'lucide-react';

interface WeeklyCalendarProps {
    weekStartDate: Date;
    tasks: PlanTask[];
    onTaskStatusChange?: (taskId: string, status: 'todo' | 'done' | 'skipped') => void;
    className?: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function WeeklyCalendar({
    weekStartDate,
    tasks,
    onTaskStatusChange,
    className,
}: WeeklyCalendarProps) {
    // Get date strings for the week
    const weekDates = useMemo(() => {
        const dates: Date[] = [];
        const start = new Date(weekStartDate);

        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            dates.push(date);
        }

        return dates;
    }, [weekStartDate]);

    // Group tasks by day
    const tasksByDay = useMemo(() => {
        const grouped: Map<string, PlanTask[]> = new Map();

        for (const date of weekDates) {
            const dateStr = formatDateKey(date);
            grouped.set(dateStr, []);
        }

        for (const task of tasks) {
            const taskDate = new Date(task.start_datetime);
            const dateStr = formatDateKey(taskDate);
            const existing = grouped.get(dateStr) || [];
            existing.push(task);
            grouped.set(dateStr, existing.sort((a, b) =>
                new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
            ));
        }

        return grouped;
    }, [tasks, weekDates]);

    const today = formatDateKey(new Date());

    return (
        <div className={cn('grid gap-4 md:grid-cols-7', className)}>
            {weekDates.map((date, index) => {
                const dateStr = formatDateKey(date);
                const dayTasks = tasksByDay.get(dateStr) || [];
                const isToday = dateStr === today;
                const isPast = date < new Date(today);

                return (
                    <Card
                        key={dateStr}
                        className={cn(
                            'min-h-[200px] transition-shadow',
                            isToday && 'ring-2 ring-primary',
                            isPast && 'opacity-75'
                        )}
                    >
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center justify-between text-sm">
                                <span className={cn(isToday && 'text-primary')}>
                                    <span className="font-medium">{DAYS[index]}</span>
                                    <span className="ml-1 text-muted-foreground">
                                        {date.getDate()}
                                    </span>
                                </span>
                                {isToday && (
                                    <Badge variant="default" className="text-xs">
                                        Today
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {dayTasks.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">
                                    No tasks
                                </p>
                            ) : (
                                dayTasks.map((task) => (
                                    <TaskItem
                                        key={task.id}
                                        task={task}
                                        onStatusChange={onTaskStatusChange}
                                    />
                                ))
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

interface TaskItemProps {
    task: PlanTask;
    onStatusChange?: (taskId: string, status: 'todo' | 'done' | 'skipped') => void;
}

function TaskItem({ task, onStatusChange }: TaskItemProps) {
    const startTime = new Date(task.start_datetime);
    const timeStr = formatTime(startTime);

    const statusIcon = {
        todo: Circle,
        done: CheckCircle2,
        skipped: SkipForward,
    }[task.status];

    const StatusIcon = statusIcon;

    const handleToggle = () => {
        if (!onStatusChange) return;

        if (task.status === 'todo') {
            onStatusChange(task.id, 'done');
        } else if (task.status === 'done') {
            onStatusChange(task.id, 'todo');
        }
    };

    return (
        <div
            className={cn(
                'group flex items-start gap-2 rounded-lg border border-border bg-background p-2 text-xs transition-colors',
                task.status === 'done' && 'bg-muted/50 opacity-75',
                task.status === 'skipped' && 'opacity-50'
            )}
        >
            <button
                onClick={handleToggle}
                className={cn(
                    'mt-0.5 shrink-0 transition-colors',
                    task.status === 'done' ? 'text-green-600' : 'text-muted-foreground hover:text-primary'
                )}
                aria-label={`Mark ${task.title} as ${task.status === 'done' ? 'incomplete' : 'complete'}`}
            >
                <StatusIcon className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
                <p
                    className={cn(
                        'font-medium truncate',
                        task.status === 'done' && 'line-through'
                    )}
                >
                    {task.title}
                </p>
                <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{timeStr}</span>
                    <span>•</span>
                    <span>{task.duration_min}m</span>
                </div>
                {task.topic && (
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                        {task.topic}
                    </Badge>
                )}
            </div>
        </div>
    );
}

// Today view component
interface TodayViewProps {
    tasks: PlanTask[];
    onTaskStatusChange?: (taskId: string, status: 'todo' | 'done' | 'skipped') => void;
    className?: string;
}

export function TodayView({ tasks, onTaskStatusChange, className }: TodayViewProps) {
    const today = formatDateKey(new Date());

    const todayTasks = tasks
        .filter((task) => formatDateKey(new Date(task.start_datetime)) === today)
        .sort((a, b) =>
            new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
        );

    const completed = todayTasks.filter((t) => t.status === 'done').length;
    const total = todayTasks.length;

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Today's Plan</span>
                    <Badge variant="outline">
                        {completed}/{total} done
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {todayTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                        No tasks scheduled for today
                    </p>
                ) : (
                    <div className="space-y-3">
                        {todayTasks.map((task) => (
                            <TaskItem
                                key={task.id}
                                task={task}
                                onStatusChange={onTaskStatusChange}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Utility functions
function formatDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}
