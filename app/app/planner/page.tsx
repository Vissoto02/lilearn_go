'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { WeeklyCalendar, TodayView } from '@/components/app/weekly-calendar';
import { CalendarWidget } from '@/components/calendar';
import { UploadPanel } from '@/components/uploads';
import { EmptyState } from '@/components/app/empty-state';
import { LoadingSkeleton } from '@/components/app/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { Plan, PlanTask, Availability, Topic } from '@/lib/types';
import {
    generateStudyPlan,
    sessionsToTasks,
    getWeekStartDate,
    formatWeekStartDate,
} from '@/lib/plan-generator';
import { getWeakestTopics } from '@/lib/weakness-calculator';
import {
    Calendar,
    Settings,
    Loader2,
    Plus,
    Sparkles,
} from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PlannerPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const [plan, setPlan] = useState<Plan | null>(null);
    const [tasks, setTasks] = useState<PlanTask[]>([]);
    const [availability, setAvailability] = useState<Availability[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);

    const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
    const [targetHours, setTargetHours] = useState('10');

    // Availability form
    const [editDay, setEditDay] = useState<number>(1);
    const [editStartTime, setEditStartTime] = useState('18:00');
    const [editEndTime, setEditEndTime] = useState('21:00');

    const weekStart = getWeekStartDate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const weekStartStr = formatWeekStartDate(weekStart);

        const [
            { data: planData },
            { data: availabilityData },
            { data: topicsData },
        ] = await Promise.all([
            supabase
                .from('plans')
                .select('*, plan_tasks(*)')
                .eq('user_id', user.id)
                .eq('week_start_date', weekStartStr)
                .single(),
            supabase.from('availability').select('*').eq('user_id', user.id),
            supabase.from('topics').select('*').eq('user_id', user.id),
        ]);

        if (planData) {
            setPlan(planData);
            setTasks(planData.plan_tasks || []);
        }
        if (availabilityData) setAvailability(availabilityData);
        if (topicsData) setTopics(topicsData);

        setLoading(false);
    };

    const handleGeneratePlan = async () => {
        if (availability.length === 0) {
            toast({
                title: 'Set availability first',
                description: 'Configure your available study times before generating a plan',
                variant: 'destructive',
            });
            setAvailabilityDialogOpen(true);
            return;
        }

        if (topics.length === 0) {
            toast({
                title: 'Add topics first',
                description: 'You need some topics to generate a study plan',
                variant: 'destructive',
            });
            return;
        }

        setGenerating(true);

        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get quiz attempts for weakness calculation
            const { data: attempts } = await supabase
                .from('quiz_attempts')
                .select('*, quizzes(*)')
                .eq('user_id', user.id);

            const { data: quizzes } = await supabase
                .from('quizzes')
                .select('*')
                .eq('user_id', user.id);

            const weaknesses = getWeakestTopics(
                (attempts || []).map(a => ({ ...a, quiz: a.quizzes })),
                quizzes || []
            );

            // Generate study sessions
            const sessions = generateStudyPlan(
                weekStart,
                availability,
                topics,
                weaknesses,
                parseInt(targetHours)
            );

            // Delete existing plan for this week
            const weekStartStr = formatWeekStartDate(weekStart);
            await supabase
                .from('plans')
                .delete()
                .eq('user_id', user.id)
                .eq('week_start_date', weekStartStr);

            // Create new plan
            const { data: newPlan, error: planError } = await supabase
                .from('plans')
                .insert({
                    user_id: user.id,
                    week_start_date: weekStartStr,
                })
                .select()
                .single();

            if (planError || !newPlan) throw new Error('Failed to create plan');

            // Create tasks
            const tasksToInsert = sessionsToTasks(sessions, newPlan.id);
            const { data: newTasks, error: tasksError } = await supabase
                .from('plan_tasks')
                .insert(tasksToInsert)
                .select();

            if (tasksError) throw new Error('Failed to create tasks');

            setPlan(newPlan);
            setTasks(newTasks || []);

            toast({
                title: 'Plan generated!',
                description: `Created ${sessions.length} study sessions`,
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to generate plan',
                variant: 'destructive',
            });
        } finally {
            setGenerating(false);
        }
    };

    const handleTaskStatusChange = async (
        taskId: string,
        status: 'todo' | 'done' | 'skipped'
    ) => {
        const supabase = createClient();

        const { error } = await supabase
            .from('plan_tasks')
            .update({ status })
            .eq('id', taskId);

        if (!error) {
            setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? { ...t, status } : t))
            );
        }
    };

    const handleSaveAvailability = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Upsert availability
        const { error } = await supabase
            .from('availability')
            .upsert({
                user_id: user.id,
                day_of_week: editDay,
                start_time: editStartTime,
                end_time: editEndTime,
            }, {
                onConflict: 'user_id,day_of_week',
            });

        if (error) {
            toast({
                title: 'Error',
                description: 'Failed to save availability',
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Saved',
                description: `${DAYS[editDay]} availability updated`,
            });
            fetchData();
        }
    };

    if (loading) {
        return (
            <div className="space-y-8">
                <PageHeader title="Planner" description="Your weekly study schedule" />
                <LoadingSkeleton variant="page" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="Planner"
                description="Your adaptive weekly study schedule"
                action={{
                    label: generating ? 'Generating...' : 'Generate Plan',
                    onClick: handleGeneratePlan,
                    icon: generating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                    ),
                }}
            />

            {/* Upload & Generate Quiz Section */}
            <UploadPanel className="mb-2" />

            {/* Settings Row */}
            <div className="flex flex-wrap items-center gap-4">
                <Button
                    variant="outline"
                    onClick={() => setAvailabilityDialogOpen(true)}
                >
                    <Settings className="mr-2 h-4 w-4" />
                    Set Availability
                </Button>
                <div className="flex items-center gap-2">
                    <Label htmlFor="targetHours" className="text-sm">
                        Target hours/week:
                    </Label>
                    <Input
                        id="targetHours"
                        type="number"
                        value={targetHours}
                        onChange={(e) => setTargetHours(e.target.value)}
                        className="w-20"
                        min="1"
                        max="40"
                    />
                </div>
            </div>

            {/* Calendar Views */}
            <Tabs defaultValue="week">
                <TabsList>
                    <TabsTrigger value="week">Week View</TabsTrigger>
                    <TabsTrigger value="today">Today</TabsTrigger>
                    <TabsTrigger value="calendar">Calendar</TabsTrigger>
                </TabsList>

                <TabsContent value="week" className="mt-4">
                    {tasks.length === 0 ? (
                        <EmptyState
                            icon={Calendar}
                            title="No study plan yet"
                            description="Generate a plan based on your availability and weak areas"
                            action={{
                                label: 'Generate Plan',
                                onClick: handleGeneratePlan,
                            }}
                        />
                    ) : (
                        <WeeklyCalendar
                            weekStartDate={weekStart}
                            tasks={tasks}
                            onTaskStatusChange={handleTaskStatusChange}
                        />
                    )}
                </TabsContent>

                <TabsContent value="today" className="mt-4">
                    <TodayView
                        tasks={tasks}
                        onTaskStatusChange={handleTaskStatusChange}
                    />
                </TabsContent>

                <TabsContent value="calendar" className="mt-4">
                    <CalendarWidget variant="planner" />
                </TabsContent>
            </Tabs>

            {/* Availability Summary */}
            {availability.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Your Availability</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            {availability.map((a) => (
                                <div
                                    key={a.id}
                                    className="rounded-lg border border-border p-3 text-sm"
                                >
                                    <p className="font-medium">{DAYS[a.day_of_week]}</p>
                                    <p className="text-muted-foreground">
                                        {a.start_time} - {a.end_time}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Availability Dialog */}
            <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Set Availability</DialogTitle>
                        <DialogDescription>
                            Configure when you're available to study
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Day</Label>
                            <Select
                                value={String(editDay)}
                                onValueChange={(v) => setEditDay(parseInt(v))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DAYS.map((day, i) => (
                                        <SelectItem key={day} value={String(i)}>
                                            {day}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Time</Label>
                                <Input
                                    type="time"
                                    value={editStartTime}
                                    onChange={(e) => setEditStartTime(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Time</Label>
                                <Input
                                    type="time"
                                    value={editEndTime}
                                    onChange={(e) => setEditEndTime(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAvailabilityDialogOpen(false)}>
                            Close
                        </Button>
                        <Button onClick={handleSaveAvailability}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
