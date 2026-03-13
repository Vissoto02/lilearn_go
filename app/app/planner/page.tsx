'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
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

    // AI Generation state
    const [previewEvents, setPreviewEvents] = useState<any[]>([]);
    const [previewReasoning, setPreviewReasoning] = useState<any>(null);
    const [previewExplanation, setPreviewExplanation] = useState<string>('');
    const [generateOptionsModalOpen, setGenerateOptionsModalOpen] = useState(false);
    const [todayEvents, setTodayEvents] = useState<any[]>([]);

    // New Advanced AI Generator State
    const [genPlanningMode, setGenPlanningMode] = useState<'number_of_weeks' | 'until_date'>('number_of_weeks');
    const [genWeeks, setGenWeeks] = useState<number>(1);
    const [genUntilDate, setGenUntilDate] = useState<string>('');
    const [genTargetHours, setGenTargetHours] = useState<number>(10);
    const [genFocusMode, setGenFocusMode] = useState<'balanced' | 'weak_subjects'>('balanced');
    const [genPreferredTime, setGenPreferredTime] = useState<'morning' | 'afternoon' | 'night' | 'anytime'>('anytime');
    const [genSessionLength, setGenSessionLength] = useState<string>('0'); // 0 = flexible
    const [genMaxSessions, setGenMaxSessions] = useState<number>(2);
    const [genIntensity, setGenIntensity] = useState<'light' | 'normal' | 'intensive'>('normal');
    const [genPreferredDays, setGenPreferredDays] = useState<'weekdays' | 'weekends' | 'all'>('all');
    const [genAvoidB2B, setGenAvoidB2B] = useState<boolean>(true);
    const [genSubjectFilter, setGenSubjectFilter] = useState<string[]>([]);
    const [genTopicFilter, setGenTopicFilter] = useState<string[]>([]);
    const [savingPreview, setSavingPreview] = useState(false);

    // Wizard state
    const [wizardStep, setWizardStep] = useState<WizardStep>('upload');
    const [timetableUpload, setTimetableUpload] = useState<TimetableUpload | null>(null);
    const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
    const [hasConfirmedTimetable, setHasConfirmedTimetable] = useState(false);

    const uniqueSubjects = useMemo(() => {
        return Array.from(new Set(topics.map(t => t.subject).filter(Boolean))).sort();
    }, [topics]);

    const uniqueTopics = useMemo(() => {
        return Array.from(new Set(topics.map(t => t.topic).filter(Boolean))).sort();
    }, [topics]);

    const weekStart = getWeekStartDate();

    useEffect(() => {
        fetchData();
        fetchTimetableUploads();
    }, []);

    const fetchData = async () => {
        // Run study-session notification sweep so alerts are ready on planner load
        try {
            const { runStudySessionNotificationSweep } = await import('@/app/actions/notifications');
            await runStudySessionNotificationSweep();
        } catch (err) {
            console.error('Failed to run study notification sweep', err);
        }

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const weekStartStr = formatWeekStartDate(weekStart);

        const todayDateStr = formatWeekStartDate(new Date());

        const [
            { data: planData },
            { data: availabilityData },
            { data: topicsData },
            { data: eventsData },
        ] = await Promise.all([
            supabase
                .from('plans')
                .select('*, plan_tasks(*)')
                .eq('user_id', user.id)
                .eq('week_start_date', weekStartStr)
                .single(),
            supabase.from('availability').select('*').eq('user_id', user.id),
            supabase.from('topics').select('*').eq('user_id', user.id),
            supabase.from('calendar_events')
                .select('*')
                .eq('user_id', user.id)
                .gte('start_time', `${todayDateStr}T00:00:00`)
                .lte('end_time', `${todayDateStr}T23:59:59`)
                .order('start_time', { ascending: true })
        ]);

        if (planData) {
            setPlan(planData);
            setTasks(planData.plan_tasks || []);
        }
        if (availabilityData) setAvailability(availabilityData);
        if (topicsData) setTopics(topicsData);
        if (eventsData) setTodayEvents(eventsData);

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

        if (topics.length === 0) {
            toast({
                title: 'Add topics first',
                description: 'You need some topics to generate a study plan',
                variant: 'destructive',
            });
            return;
        }

        setGenerateOptionsModalOpen(true);
    };

    const handleExecuteAI = async () => {
        setGenerating(true);
        setGenerateOptionsModalOpen(false);

        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const payload = {
                user_id: user.id,
                planning_mode: genPlanningMode,
                number_of_weeks: genPlanningMode === 'number_of_weeks' ? genWeeks : null,
                until_date: genPlanningMode === 'until_date' ? genUntilDate : null,
                focus_mode: genFocusMode,
                preferred_time: genPreferredTime,
                target_hours_per_week: genTargetHours,
                preferred_session_length_minutes: genSessionLength === '0' ? null : parseInt(genSessionLength),
                max_sessions_per_day: genMaxSessions,
                intensity: genIntensity,
                subject_filter: genSubjectFilter.length > 0 ? genSubjectFilter : null,
                topic_filter: genTopicFilter.length > 0 ? genTopicFilter : null,
                preferred_days: genPreferredDays,
                avoid_back_to_back_sessions: genAvoidB2B,
            };

            const res = await fetch('/api/planner/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.error);

            // Shape standard AI sessions directly into preview calendar events
            const mappedPreview = data.generated_plan.map((s: any, i: number) => ({
                id: `preview-${Date.now()}-${i}`,
                user_id: user.id,
                title: s.topic ? `${s.subject}: ${s.topic}` : s.subject,
                event_type: 'generated_plan',
                start_time: `${s.date}T${s.start_time}:00+08:00`,
                end_time: `${s.date}T${s.end_time}:00+08:00`,
                subject: s.subject,
                color: '#c026d3',
                description: `📚 ${s.topic || 'General'}\n\n🤖 AI Reason: ${s.reason}`,
                is_locked: false,
                source: 'ai'
            }));

            setPreviewEvents(mappedPreview);

            if (data.reasoning) {
                setPreviewReasoning(data.reasoning);
                let text = `This plan focuses more on ${data.reasoning.main_focus_subject || 'your subjects evenly'}`;
                if (data.reasoning.main_focus_topic) {
                    text += `, especially ${data.reasoning.main_focus_topic},`;
                }
                if (data.reasoning.focus_reason) {
                    text += ` because of ${data.reasoning.focus_reason.toLowerCase()}.`;
                } else {
                    text += `.`;
                }
                text += ` Sessions are scheduled `;
                if (data.reasoning.time_preference_used) {
                    text += `mostly in the ${data.reasoning.time_preference_used} based on your preference and `;
                }
                text += `${data.reasoning.schedule_style.toLowerCase()}.`;
                setPreviewExplanation(text);
            } else {
                setPreviewReasoning(null);
                setPreviewExplanation('');
            }

            toast({
                title: 'Plan generated!',
                description: `Created ${mappedPreview.length} study sessions. Review and save them in the timetable.`,
            });
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to generate plan',
                variant: 'destructive',
            });
        } finally {
            setGenerating(false);
        }
    };

    const handleSavePreview = async () => {
        setSavingPreview(true);
        try {
            const { saveGeneratedPlan } = await import('@/app/actions/calendar');

            // Map preview back to generated session style
            const sessionsToSave = previewEvents.map(e => {
                const date = e.start_time.split('T')[0];
                const start_time = e.start_time.split('T')[1].substring(0, 5);
                const end_time = e.end_time.split('T')[1].substring(0, 5);
                const isComplexReason = e.description && e.description.includes('AI Reason:');
                const reason = isComplexReason ? e.description.split('AI Reason:')[1].trim() : e.description || '';

                return {
                    date,
                    start_time,
                    end_time,
                    subject: e.subject || '',
                    topic: e.title.includes(': ') ? e.title.split(': ')[1] : null,
                    reason
                };
            });

            if (sessionsToSave.length === 0) return;

            // Sort to find range dates
            sessionsToSave.sort((a, b) => a.date.localeCompare(b.date));
            const startDateStr = sessionsToSave[0].date;
            const endDateStr = sessionsToSave[sessionsToSave.length - 1].date;

            const result = await saveGeneratedPlan(sessionsToSave, startDateStr, endDateStr);
            if (!result.success) throw new Error(result.error);

            toast({ title: 'Success', description: 'AI study plan saved to timetable.' });
            setPreviewEvents([]);
            setPreviewReasoning(null);
            setPreviewExplanation('');
            setCalendarRefreshKey(prev => prev + 1);
        } catch (err: any) {
            toast({ title: 'Error saving plan', description: err.message, variant: 'destructive' });
        } finally {
            setSavingPreview(false);
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
        <div className="space-y-6 animate-fade-in relative">
            {/* AI Generating Full-Screen Overlay */}
            {generating && (
                <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <div className="flex flex-col items-center gap-4 max-w-sm text-center p-6 bg-card border shadow-xl rounded-2xl animate-in zoom-in-95">
                        <div className="p-4 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 mb-2">
                            <Sparkles className="h-10 w-10 text-indigo-500 animate-pulse" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight">Crafting Your Schedule</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Please hold on! AI is computing the perfect study times based on your availability and weaknesses. Don't click away or refresh the page.
                        </p>
                        <Loader2 className="w-6 h-6 animate-spin mt-2 text-primary" />
                    </div>
                </div>
            )}

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
                                previewEvents={previewEvents}
                                onClearPreview={() => {
                                    setPreviewEvents([]);
                                    setPreviewReasoning(null);
                                    setPreviewExplanation('');
                                }}
                                onSavePreview={handleSavePreview}
                                onRegeneratePreview={() => setGenerateOptionsModalOpen(true)}
                                savingPreview={savingPreview}
                                previewFocusMode={genFocusMode}
                                previewReasoning={previewReasoning}
                                previewExplanation={previewExplanation}
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
                                todayEvents={todayEvents}
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

            {/* AI Generate Options Dialog */}
            <Dialog open={generateOptionsModalOpen} onOpenChange={setGenerateOptionsModalOpen}>
                <DialogContent className="sm:max-w-4xl overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>Generate AI Study Plan</DialogTitle>
                        <DialogDescription>
                            Configure what the AI should focus on
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* General Settings */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold border-b pb-2">General Settings</h3>

                                <div className="space-y-2">
                                    <Label>Planning Mode</Label>
                                    <Select value={genPlanningMode} onValueChange={(v: any) => setGenPlanningMode(v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="number_of_weeks">By Number of Weeks</SelectItem>
                                            <SelectItem value="until_date">Until Specific Date</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {genPlanningMode === 'number_of_weeks' ? (
                                    <div className="space-y-2">
                                        <Label>Weeks to Generate</Label>
                                        <Input type="number" min="1" max="12" value={genWeeks} onChange={(e) => setGenWeeks(parseInt(e.target.value) || 1)} />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label>Generate Until Date</Label>
                                        <Input type="date" value={genUntilDate} onChange={(e) => setGenUntilDate(e.target.value)} />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>Focus Mode</Label>
                                    <Select value={genFocusMode} onValueChange={(v: any) => setGenFocusMode(v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="balanced">Balanced</SelectItem>
                                            <SelectItem value="weak_subjects">Prioritize Weak Subjects</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Intensity</Label>
                                    <Select value={genIntensity} onValueChange={(v: any) => setGenIntensity(v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="light">Light (Fewer, shorter sessions)</SelectItem>
                                            <SelectItem value="normal">Normal</SelectItem>
                                            <SelectItem value="intensive">Intensive (Maximizes target hours)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Constraints */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold border-b pb-2">Constraints</h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Target Hrs / Week</Label>
                                        <Input type="number" min="1" max="100" value={genTargetHours} onChange={(e) => setGenTargetHours(parseInt(e.target.value) || 10)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Max Sessions / Day</Label>
                                        <Input type="number" min="1" max="10" value={genMaxSessions} onChange={(e) => setGenMaxSessions(parseInt(e.target.value) || 2)} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Preferred Time of Day</Label>
                                    <Select value={genPreferredTime} onValueChange={(v: any) => setGenPreferredTime(v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="anytime">Anytime</SelectItem>
                                            <SelectItem value="morning">Morning</SelectItem>
                                            <SelectItem value="afternoon">Afternoon</SelectItem>
                                            <SelectItem value="night">Night</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Session Length</Label>
                                    <Select value={genSessionLength} onValueChange={setGenSessionLength}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">Flexible (AI Decides)</SelectItem>
                                            <SelectItem value="30">30 minutes</SelectItem>
                                            <SelectItem value="45">45 minutes</SelectItem>
                                            <SelectItem value="60">60 minutes</SelectItem>
                                            <SelectItem value="90">90 minutes</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Preferred Days</Label>
                                    <Select value={genPreferredDays} onValueChange={(v: any) => setGenPreferredDays(v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Everyday</SelectItem>
                                            <SelectItem value="weekdays">Weekdays Only</SelectItem>
                                            <SelectItem value="weekends">Weekends Only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center space-x-2 pt-2">
                                    <Checkbox id="avoid_b2b" checked={genAvoidB2B} onCheckedChange={(c) => setGenAvoidB2B(!!c)} />
                                    <Label htmlFor="avoid_b2b" className="cursor-pointer">Avoid back-to-back sessions</Label>
                                </div>
                            </div>
                        </div>



                        {/* Filters */}

                        <div className="space-y-3">
                            <Label>Subject Filter (Optional)</Label>
                            {uniqueSubjects.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3 p-3 border rounded-md bg-muted/20">
                                    {uniqueSubjects.map(subject => (
                                        <div key={subject} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`subject-${subject}`}
                                                checked={genSubjectFilter.includes(subject)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setGenSubjectFilter(prev => [...prev, subject]);
                                                    } else {
                                                        setGenSubjectFilter(prev => prev.filter(s => s !== subject));
                                                    }
                                                }}
                                            />
                                            <Label
                                                htmlFor={`subject-${subject}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                                {subject}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No subjects found in your topics. Generate quizzes or add topics to filter by subject.</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">Leave all unchecked to include all subjects.</p>
                        </div>

                        <div className="space-y-3">
                            <Label>Topic Filter (Optional)</Label>
                            {uniqueTopics.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 border rounded-md bg-muted/20">
                                    {uniqueTopics.map(topic => (
                                        <div key={topic} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`topic-${topic}`}
                                                checked={genTopicFilter.includes(topic)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setGenTopicFilter(prev => [...prev, topic]);
                                                    } else {
                                                        setGenTopicFilter(prev => prev.filter(t => t !== topic));
                                                    }
                                                }}
                                            />
                                            <Label
                                                htmlFor={`topic-${topic}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={topic}
                                            >
                                                {topic}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No topics found. Add topics first.</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">Leave all unchecked to include all topics.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGenerateOptionsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleExecuteAI} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                            <Sparkles className="h-4 w-4" />
                            Generate with AI
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
