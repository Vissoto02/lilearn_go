'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { WeeklyCalendar, TodayView } from '@/components/app/weekly-calendar';
import { UploadPanel } from '@/components/uploads';
import { EmptyState } from '@/components/app/empty-state';
import { LoadingSkeleton } from '@/components/app/loading-skeleton';
import { TimetableUploadCard } from '@/components/planner/TimetableUploadCard';
import { WeeklyTimetableGrid } from '@/components/planner/WeeklyTimetableGrid';
import { TimetablePreviewTable } from '@/components/planner/TimetablePreviewTable';
import { PlannerCalendarSection } from '@/components/planner/PlannerCalendarSection';
import { AssignmentDeadlineForm } from '@/components/planner/AssignmentDeadlineForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import type { TimetableUpload } from '@/lib/timetable/types';
import { getRecentTimetableUploads } from '@/app/actions/timetable';
import {
    Calendar,
    Settings,
    Loader2,
    Sparkles,
    Upload,
    CheckCircle2,
    CalendarClock,
    Eye,
    ArrowLeft,
    Plus,
} from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Wizard steps
type WizardStep = 'upload' | 'review' | 'deadlines' | 'schedule';

// Step indicator component
function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
    const steps: { key: WizardStep; label: string; icon: typeof Upload }[] = [
        { key: 'upload', label: 'Upload', icon: Upload },
        { key: 'review', label: 'Review', icon: CheckCircle2 },
        { key: 'deadlines', label: 'Deadlines', icon: CalendarClock },
        { key: 'schedule', label: 'Schedule', icon: Eye },
    ];

    const currentIndex = steps.findIndex((s) => s.key === currentStep);

    return (
        <div className="flex items-center justify-center gap-2 py-4">
            {steps.map((step, i) => {
                const isActive = step.key === currentStep;
                const isCompleted = i < currentIndex;
                const Icon = step.icon;

                return (
                    <div key={step.key} className="flex items-center gap-2">
                        <div
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isActive
                                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25'
                                    : isCompleted
                                        ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                                        : 'bg-muted text-muted-foreground'
                                }`}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{step.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <div
                                className={`h-px w-6 ${i < currentIndex ? 'bg-teal-500' : 'bg-border'
                                    }`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

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

    // Wizard state
    const [wizardStep, setWizardStep] = useState<WizardStep>('upload');
    const [timetableUpload, setTimetableUpload] = useState<TimetableUpload | null>(null);
    const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
    const [hasConfirmedTimetable, setHasConfirmedTimetable] = useState(false);

    const weekStart = getWeekStartDate();

    useEffect(() => {
        fetchData();
        fetchTimetableUploads();
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

    const fetchTimetableUploads = async () => {
        const result = await getRecentTimetableUploads(1);
        if (result.data && result.data.length > 0) {
            const latest = result.data[0];

            if (latest.status === 'confirmed') {
                // User already has a confirmed timetable — go straight to schedule
                setHasConfirmedTimetable(true);
                setWizardStep('schedule');
            } else if (latest.status === 'needs_review') {
                // Timetable was parsed, needs review
                setTimetableUpload(latest);
                setWizardStep('review');
            } else if (latest.status === 'processing' || latest.status === 'uploaded') {
                setTimetableUpload(latest);
                setWizardStep('upload');
            } else {
                // Failed or no upload
                setWizardStep('upload');
            }
        } else {
            // Check if user has any timetable_class events already
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { count } = await supabase
                    .from('calendar_events')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('event_type', 'timetable_class');

                if (count && count > 0) {
                    setHasConfirmedTimetable(true);
                    setWizardStep('schedule');
                }
            }
        }
    };

    // ========================================================================
    // Plan Generation
    // ========================================================================

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

            const sessions = generateStudyPlan(
                weekStart,
                availability,
                topics,
                weaknesses,
                parseInt(targetHours)
            );

            const weekStartStr = formatWeekStartDate(weekStart);
            await supabase
                .from('plans')
                .delete()
                .eq('user_id', user.id)
                .eq('week_start_date', weekStartStr);

            const { data: newPlan, error: planError } = await supabase
                .from('plans')
                .insert({
                    user_id: user.id,
                    week_start_date: weekStartStr,
                })
                .select()
                .single();

            if (planError || !newPlan) throw new Error('Failed to create plan');

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

    // ========================================================================
    // Wizard handlers
    // ========================================================================

    const handleTimetableUploadComplete = (upload: TimetableUpload) => {
        setTimetableUpload(upload);
        setWizardStep('review');
    };

    const handleTimetableDiscard = () => {
        setTimetableUpload(null);
        setWizardStep('upload');
    };

    const handleTimetableConfirmed = (count: number) => {
        setTimetableUpload(null);
        setHasConfirmedTimetable(true);
        setCalendarRefreshKey((prev) => prev + 1);
        setWizardStep('deadlines');
    };

    const handleDeadlinesComplete = (count: number) => {
        setCalendarRefreshKey((prev) => prev + 1);
        setWizardStep('schedule');
    };

    const handleDeadlinesSkip = () => {
        setWizardStep('schedule');
    };

    const handleDeadlinesBack = () => {
        setWizardStep('review');
    };

    const handleResetWizard = () => {
        setWizardStep('upload');
        setTimetableUpload(null);
    };

    // ========================================================================
    // Render
    // ========================================================================

    if (loading) {
        return (
            <div className="space-y-8">
                <PageHeader title="Planner" description="Your weekly study schedule" />
                <LoadingSkeleton variant="page" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title="Planner"
                description="Your adaptive weekly study schedule"
                action={wizardStep === 'schedule' ? {
                    label: generating ? 'Generating...' : 'Generate Plan',
                    onClick: handleGeneratePlan,
                    icon: generating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                    ),
                } : undefined}
            />

            {/* ========== WIZARD STEP INDICATOR ========== */}
            {wizardStep !== 'schedule' && (
                <StepIndicator currentStep={wizardStep} />
            )}

            {/* ========== STEP 1: UPLOAD TIMETABLE ========== */}
            {wizardStep === 'upload' && (
                <div className="max-w-2xl mx-auto space-y-4">
                    <TimetableUploadCard
                        currentUpload={timetableUpload}
                        onUploadComplete={handleTimetableUploadComplete}
                        onDiscard={handleTimetableDiscard}
                    />

                    {/* Skip to schedule if already has timetable */}
                    {hasConfirmedTimetable && (
                        <Button
                            variant="ghost"
                            className="w-full text-muted-foreground"
                            onClick={() => setWizardStep('schedule')}
                        >
                            ← Back to my schedule
                        </Button>
                    )}
                </div>
            )}

            {/* ========== STEP 2: REVIEW & MODIFY ========== */}
            {wizardStep === 'review' && timetableUpload?.status === 'needs_review' && timetableUpload.parsed_json && (
                <div className="max-w-4xl mx-auto">
                    <TimetablePreviewTable
                        uploadId={timetableUpload.id}
                        initialItems={timetableUpload.parsed_json}
                        onConfirmed={handleTimetableConfirmed}
                        onDiscard={handleTimetableDiscard}
                    />
                </div>
            )}

            {/* ========== STEP 3: ASSIGNMENT DEADLINES ========== */}
            {wizardStep === 'deadlines' && (
                <div className="max-w-2xl mx-auto">
                    <AssignmentDeadlineForm
                        onComplete={handleDeadlinesComplete}
                        onSkip={handleDeadlinesSkip}
                        onBack={handleDeadlinesBack}
                    />
                </div>
            )}

            {/* ========== STEP 4: SCHEDULE VIEW ========== */}
            {wizardStep === 'schedule' && (
                <>
                    {/* Quick actions bar */}
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setWizardStep('upload')}
                            className="gap-2"
                        >
                            <Upload className="h-3.5 w-3.5" />
                            Upload New Timetable
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setWizardStep('deadlines')}
                            className="gap-2"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Deadlines
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAvailabilityDialogOpen(true)}
                            className="gap-2"
                        >
                            <Settings className="h-3.5 w-3.5" />
                            Set Availability
                        </Button>
                        <div className="flex items-center gap-2 ml-auto">
                            <Label htmlFor="targetHours" className="text-sm text-muted-foreground">
                                Target hrs/week:
                            </Label>
                            <Input
                                id="targetHours"
                                type="number"
                                value={targetHours}
                                onChange={(e) => setTargetHours(e.target.value)}
                                className="w-16 h-8 text-sm"
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

                        <TabsContent value="week" className="mt-4 space-y-6">
                            {/* Interactive Timetable Grid */}
                            <WeeklyTimetableGrid
                                referenceDate={weekStart}
                                refreshKey={calendarRefreshKey}
                            />

                            {/* Study Plan Tasks (below the grid) */}
                            {tasks.length > 0 && (
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
                            <PlannerCalendarSection refreshKey={calendarRefreshKey} />
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
                </>
            )}

            {/* Availability Dialog */}
            <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Set Availability</DialogTitle>
                        <DialogDescription>
                            Configure when you&apos;re available to study
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
