'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { LoadingSkeleton } from '@/components/app/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { Habit, RevisionSession, StudyType, TopicWeakness } from '@/lib/types';
import { calculateStreak, formatDate } from '@/lib/streak-calculator';
import { calculateWeakness } from '@/lib/weakness-calculator';
import {
    Flame,
    Target,
    CheckCircle2,
    Trophy,
    Loader2,
    TrendingUp,
    Calendar,
    ClipboardCheck,
    ShieldCheck,
    AlertCircle,
    BookOpen,
    PenLine,
    FileText,
    Sparkles,
    Award,
    BarChart3,
    ArrowUpRight,
    Clock,
    Zap,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface TodayStudyStatus {
    planned: number;
    started: number;
    validated: number;
    missed: number;
}

interface WeeklySessionData {
    planned: number;
    completed: number;
    validated: number;
    completionRate: number;
}

interface StudyEvidenceBreakdown {
    manualCheckins: number;
    startedSessions: number;
    validatedSessions: number;
    proofUploads: number;
}

interface WeeklyPointsSummary {
    quizValidation: number;
    sessionCompletion: number;
    manualCheckins: number;
    proofUploads: number;
    total: number;
}

interface WeakSubjectProgress {
    subject: string;
    topic: string;
    currentAccuracy: number;
    previousAccuracy: number | null;
    totalAttempts: number;
}

// Activity levels for heatmap
type ActivityLevel = 0 | 1 | 2 | 3;

interface DayActivity {
    date: string;
    level: ActivityLevel;
    label: string;
    details: string;
}

// ============================================================================
// Constants
// ============================================================================

const STUDY_TYPES: { value: StudyType; label: string; icon: React.ReactNode }[] = [
    { value: 'revision', label: 'Revision', icon: <BookOpen className="h-4 w-4" /> },
    { value: 'practice_quiz', label: 'Practice Quiz', icon: <ClipboardCheck className="h-4 w-4" /> },
    { value: 'notes_review', label: 'Notes Review', icon: <FileText className="h-4 w-4" /> },
    { value: 'assignment', label: 'Assignment', icon: <PenLine className="h-4 w-4" /> },
];

const ACTIVITY_COLORS = [
    'bg-muted',                                          // Level 0: no activity
    'bg-amber-200 dark:bg-amber-900/60',                 // Level 1: manual check-in only
    'bg-blue-300 dark:bg-blue-800/70',                   // Level 2: session started / proof upload
    'bg-emerald-400 dark:bg-emerald-700',                // Level 3: validated session / quiz done
];

const ACTIVITY_LABELS = [
    'No activity',
    'Manual check-in',
    'Session started',
    'Validated study',
];

// ============================================================================
// Component
// ============================================================================

export default function HabitsPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Core data
    const [habits, setHabits] = useState<Habit[]>([]);
    const [revisionSessions, setRevisionSessions] = useState<RevisionSession[]>([]);
    const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
    const [quizAttempts, setQuizAttempts] = useState<any[]>([]);
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
    const [userStats, setUserStats] = useState<{ total_points: number } | null>(null);

    // Quick Study Log form state
    const [studyMinutes, setStudyMinutes] = useState('30');
    const [studyType, setStudyType] = useState<StudyType | ''>('');
    const [studySubject, setStudySubject] = useState('');
    const [studyTopic, setStudyTopic] = useState('');
    const [studyNote, setStudyNote] = useState('');

    const today = formatDate(new Date());

    // ========================================================================
    // Data Fetching
    // ========================================================================

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            return;
        }

        // Calculate time boundaries
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
        if (startOfWeek > startOfToday) startOfWeek.setDate(startOfWeek.getDate() - 7);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 7);

        // 28 days back for heatmap
        const heatmapStart = new Date(startOfToday);
        heatmapStart.setDate(heatmapStart.getDate() - 27);

        const [
            habitsRes,
            sessionsRes,
            calendarRes,
            attemptsRes,
            quizzesRes,
            subjectsRes,
            statsRes,
        ] = await Promise.all([
            supabase
                .from('habits')
                .select('*')
                .order('date', { ascending: false })
                .limit(90),
            supabase
                .from('revision_sessions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200),
            supabase
                .from('calendar_events')
                .select('*')
                .eq('event_type', 'study_block')
                .gte('start_time', heatmapStart.toISOString())
                .order('start_time', { ascending: true }),
            supabase
                .from('quiz_attempts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500),
            supabase
                .from('quizzes')
                .select('*')
                .limit(200),
            supabase
                .from('subjects')
                .select('id, name')
                .order('name'),
            supabase
                .from('user_stats')
                .select('total_points')
                .eq('user_id', user.id)
                .single(),
        ]);

        if (habitsRes.data) setHabits(habitsRes.data);
        if (sessionsRes.data) setRevisionSessions(sessionsRes.data);
        if (calendarRes.data) setCalendarEvents(calendarRes.data);
        if (attemptsRes.data) setQuizAttempts(attemptsRes.data);
        if (quizzesRes.data) setQuizzes(quizzesRes.data);
        if (subjectsRes.data) setSubjects(subjectsRes.data);
        if (statsRes.data) setUserStats(statsRes.data);

        setLoading(false);
    };

    // ========================================================================
    // Check-In Handler
    // ========================================================================

    const handleCheckin = async () => {
        setSaving(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setSaving(false);
            return;
        }

        const minutes = parseInt(studyMinutes) || 0;

        const { error } = await supabase
            .from('habits')
            .upsert({
                user_id: user.id,
                date: today,
                studied_minutes: minutes,
                checkin: true,
                study_type: studyType || null,
                subject: studySubject || null,
                topic: studyTopic || null,
                note: studyNote || null,
            }, {
                onConflict: 'user_id,date',
            });

        if (error) {
            toast({
                title: 'Error',
                description: 'Failed to log study session',
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Study logged! 🎉',
                description: `Logged ${minutes} minutes${studyType ? ` of ${STUDY_TYPES.find(t => t.value === studyType)?.label?.toLowerCase()}` : ''}.`,
            });
            // Reset form
            setStudyType('');
            setStudySubject('');
            setStudyTopic('');
            setStudyNote('');
            fetchAllData();
        }
        setSaving(false);
    };

    // ========================================================================
    // Computed Data
    // ========================================================================

    const streakData = useMemo(() => calculateStreak(habits), [habits]);
    const todayHabit = habits.find((h) => h.date === today);
    const hasCheckedInToday = todayHabit?.checkin ?? false;

    // Weekly study minutes from habits
    const weeklyStudyMinutes = useMemo(() => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
        if (startOfWeek > now) startOfWeek.setDate(startOfWeek.getDate() - 7);
        const weekStart = formatDate(startOfWeek);

        return habits
            .filter(h => h.date >= weekStart && h.date <= today)
            .reduce((sum, h) => sum + h.studied_minutes, 0);
    }, [habits, today]);

    // Today's Study Status
    const todayStatus: TodayStudyStatus = useMemo(() => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        // Planned study_block events for today
        const todayEvents = calendarEvents.filter(e => {
            const start = new Date(e.start_time);
            return start >= startOfToday && start <= endOfToday;
        });

        // Revision sessions for today
        const todaySessions = revisionSessions.filter(s => {
            const started = new Date(s.started_at);
            return started >= startOfToday && started <= endOfToday;
        });

        const planned = todayEvents.length;
        const started = todaySessions.length;
        const validated = todaySessions.filter(s => s.status === 'completed').length;

        // Missed = planned events that have already passed but have no corresponding session
        const now = new Date();
        const missedEvents = todayEvents.filter(e => {
            const end = new Date(e.end_time);
            if (end > now) return false; // not yet past
            // Check if there's a session linked to this event
            return !todaySessions.some(s => s.calendar_event_id === e.id);
        });

        return { planned, started, validated, missed: missedEvents.length };
    }, [calendarEvents, revisionSessions]);

    // Weekly Session Completion
    const weeklySessionData: WeeklySessionData = useMemo(() => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
        if (startOfWeek > now) startOfWeek.setDate(startOfWeek.getDate() - 7);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // All study_block events this week
        const weekEvents = calendarEvents.filter(e => {
            const start = new Date(e.start_time);
            return start >= startOfWeek && start <= endOfWeek;
        });

        // All sessions this week
        const weekSessions = revisionSessions.filter(s => {
            const started = new Date(s.started_at);
            return started >= startOfWeek && started <= endOfWeek;
        });

        const planned = weekEvents.length;
        const completed = weekSessions.filter(s => 
            s.status === 'completed' || s.status === 'validating'
        ).length;
        const validated = weekSessions.filter(s => s.status === 'completed').length;
        const completionRate = planned > 0 ? Math.round((completed / planned) * 100) : 0;

        return { planned, completed, validated, completionRate };
    }, [calendarEvents, revisionSessions]);

    // Total validated sessions (all time)
    const totalValidatedSessions = useMemo(() => {
        return revisionSessions.filter(s => s.status === 'completed').length;
    }, [revisionSessions]);

    // Study Evidence Breakdown
    const evidenceBreakdown: StudyEvidenceBreakdown = useMemo(() => {
        return {
            manualCheckins: habits.filter(h => h.checkin).length,
            startedSessions: revisionSessions.filter(s =>
                s.status === 'active' || s.status === 'validating'
            ).length,
            validatedSessions: revisionSessions.filter(s => s.status === 'completed').length,
            proofUploads: revisionSessions.filter(s => s.validation_type === 'file_upload').length,
        };
    }, [habits, revisionSessions]);

    // Weekly Points Summary
    const weeklyPoints: WeeklyPointsSummary = useMemo(() => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
        if (startOfWeek > now) startOfWeek.setDate(startOfWeek.getDate() - 7);

        const weekSessions = revisionSessions.filter(s => {
            const ended = s.ended_at ? new Date(s.ended_at) : null;
            return ended && ended >= startOfWeek && s.status === 'completed';
        });

        const quizValidation = weekSessions
            .filter(s => s.validation_type === 'quiz')
            .reduce((sum, s) => sum + (s.points_earned || 0), 0);

        const sessionCompletion = weekSessions
            .filter(s => !s.validation_type || s.validation_type === 'quiz')
            .reduce((sum, s) => sum + (s.points_earned || 0), 0) - quizValidation > 0
            ? weekSessions.filter(s => !s.validation_type)
                .reduce((sum, s) => sum + (s.points_earned || 0), 0)
            : 0;

        const proofUploads = weekSessions
            .filter(s => s.validation_type === 'file_upload')
            .reduce((sum, s) => sum + (s.points_earned || 0), 0);

        // Manual check-ins don't earn real points in the current system
        const manualCheckins = 0;

        const total = quizValidation + sessionCompletion + proofUploads + manualCheckins;

        return { quizValidation, sessionCompletion, manualCheckins, proofUploads, total };
    }, [revisionSessions]);

    // Weak Subject Progress
    const weakSubjectProgress: WeakSubjectProgress[] = useMemo(() => {
        if (quizAttempts.length === 0 || quizzes.length === 0) return [];

        const weaknesses = calculateWeakness(quizAttempts, quizzes);

        // Filter to only weak subjects (accuracy < 70%) with enough attempts
        return weaknesses
            .filter(w => w.accuracy < 70 && w.totalAttempts >= 3)
            .slice(0, 5)
            .map(w => ({
                subject: w.subject,
                topic: w.topic,
                currentAccuracy: w.accuracy,
                previousAccuracy: null, // Would require historical tracking
                totalAttempts: w.totalAttempts,
            }));
    }, [quizAttempts, quizzes]);

    // 28-Day Activity Heatmap data
    const heatmapData: DayActivity[] = useMemo(() => {
        const days: DayActivity[] = [];

        for (let i = 27; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = formatDate(date);

            const habit = habits.find(h => h.date === dateStr);

            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const daySessions = revisionSessions.filter(s => {
                const started = new Date(s.started_at);
                return started >= startOfDay && started <= endOfDay;
            });

            const hasValidated = daySessions.some(s => s.status === 'completed');
            const hasStarted = daySessions.length > 0;
            const hasCheckin = habit?.checkin ?? false;

            let level: ActivityLevel = 0;
            let label = ACTIVITY_LABELS[0];

            if (hasValidated) {
                level = 3;
                label = ACTIVITY_LABELS[3];
            } else if (hasStarted) {
                level = 2;
                label = ACTIVITY_LABELS[2];
            } else if (hasCheckin) {
                level = 1;
                label = ACTIVITY_LABELS[1];
            }

            const detailParts: string[] = [];
            if (habit && habit.studied_minutes > 0) {
                detailParts.push(`${habit.studied_minutes}min studied`);
            }
            if (daySessions.length > 0) {
                detailParts.push(`${daySessions.length} session(s)`);
            }
            if (hasValidated) {
                detailParts.push('validated');
            }

            days.push({
                date: dateStr,
                level,
                label,
                details: detailParts.length > 0 ? detailParts.join(' · ') : 'No activity',
            });
        }

        return days;
    }, [habits, revisionSessions]);

    // ========================================================================
    // Render
    // ========================================================================

    if (loading) {
        return (
            <div className="space-y-8">
                <PageHeader
                    title="Study Consistency"
                    description="Track your study progress and habits"
                />
                <LoadingSkeleton variant="stats" count={4} />
                <div className="grid gap-6 lg:grid-cols-2">
                    <LoadingSkeleton variant="card" count={2} />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="Study Consistency"
                description="Track your real study progress, planner adherence, and learning improvement"
            />

            {/* ============================================================ */}
            {/* TOP SUMMARY CARDS                                            */}
            {/* ============================================================ */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Current Streak"
                    value={`${streakData.currentStreak} days`}
                    subtitle={
                        streakData.currentStreak > 0
                            ? `Best: ${streakData.longestStreak} days`
                            : 'Start today!'
                    }
                    icon={Flame}
                />
                <StatCard
                    title="Validated Sessions"
                    value={totalValidatedSessions}
                    subtitle="Quiz or proof verified"
                    icon={ShieldCheck}
                />
                <StatCard
                    title="Weekly Study"
                    value={`${weeklyStudyMinutes}m`}
                    subtitle={`~${Math.round(weeklyStudyMinutes / 7)}m per day`}
                    icon={Clock}
                />
                <StatCard
                    title="Completion Rate"
                    value={
                        weeklySessionData.planned > 0
                            ? `${weeklySessionData.completionRate}%`
                            : '—'
                    }
                    subtitle={
                        weeklySessionData.planned > 0
                            ? `${weeklySessionData.completed}/${weeklySessionData.planned} sessions`
                            : 'No sessions planned'
                    }
                    icon={Target}
                />
            </div>

            {/* ============================================================ */}
            {/* TODAY'S STATUS + ACTIVITY HEATMAP                             */}
            {/* ============================================================ */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Today's Study Status */}
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            Today&apos;s Study Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {todayStatus.planned === 0 && todayStatus.started === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-6 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                    <Calendar className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">No planned sessions today</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Use the planner to schedule study sessions
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <StatusTile
                                    label="Planned"
                                    value={todayStatus.planned}
                                    color="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                                    icon={<Calendar className="h-4 w-4" />}
                                />
                                <StatusTile
                                    label="Started"
                                    value={todayStatus.started}
                                    color="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                                    icon={<BookOpen className="h-4 w-4" />}
                                />
                                <StatusTile
                                    label="Validated"
                                    value={todayStatus.validated}
                                    color="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                    icon={<ShieldCheck className="h-4 w-4" />}
                                />
                                <StatusTile
                                    label="Missed"
                                    value={todayStatus.missed}
                                    color={
                                        todayStatus.missed > 0
                                            ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                            : 'bg-muted text-muted-foreground'
                                    }
                                    icon={<AlertCircle className="h-4 w-4" />}
                                />
                            </div>
                        )}

                        {/* Session Completion Rate Bar */}
                        {weeklySessionData.planned > 0 && (
                            <div className="mt-5 space-y-2 border-t pt-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                        Week completion
                                    </span>
                                    <span className="font-semibold">
                                        {weeklySessionData.completed}/{weeklySessionData.planned}
                                        <span className="ml-1 text-xs text-muted-foreground">
                                            ({weeklySessionData.completionRate}%)
                                        </span>
                                    </span>
                                </div>
                                <Progress
                                    value={weeklySessionData.completionRate}
                                    className="h-2"
                                />
                                {weeklySessionData.validated > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        {weeklySessionData.validated} validated with quiz/proof
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 28-Day Activity Heatmap */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            Study Activity (28 Days)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-7 gap-1.5">
                            {/* Day labels */}
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="text-center text-[10px] text-muted-foreground mb-1 font-medium">
                                    {day}
                                </div>
                            ))}

                            {/* Heatmap cells */}
                            {heatmapData.map((day) => {
                                const date = new Date(day.date);
                                const dayOfMonth = date.getDate();
                                const isToday = day.date === today;

                                return (
                                    <Tooltip key={day.date}>
                                        <TooltipTrigger asChild>
                                            <div
                                                className={`
                                                    aspect-square rounded-md flex items-center justify-center
                                                    text-[10px] font-medium cursor-default transition-all
                                                    hover:scale-110 hover:shadow-md
                                                    ${ACTIVITY_COLORS[day.level]}
                                                    ${isToday ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
                                                    ${day.level === 0 ? 'text-muted-foreground' : day.level === 3 ? 'text-white dark:text-emerald-100' : ''}
                                                `}
                                            >
                                                {dayOfMonth}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <div className="text-xs">
                                                <p className="font-semibold">
                                                    {date.toLocaleDateString('en-US', {
                                                        weekday: 'short',
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </p>
                                                <p className="mt-0.5">{day.label}</p>
                                                {day.details !== 'No activity' && (
                                                    <p className="text-muted-foreground">{day.details}</p>
                                                )}
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="mt-4 flex items-center gap-3 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">Less</span>
                            {ACTIVITY_COLORS.map((color, i) => (
                                <Tooltip key={i}>
                                    <TooltipTrigger asChild>
                                        <div className={`h-3 w-3 rounded-sm ${color} cursor-default`} />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <span className="text-xs">{ACTIVITY_LABELS[i]}</span>
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                            <span className="text-[10px] text-muted-foreground">More</span>
                        </div>

                        {/* Streak progress */}
                        <div className="mt-4 space-y-2 border-t pt-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1.5">
                                    <Flame className="h-4 w-4 text-orange-500" />
                                    Streak progress
                                </span>
                                <span className="font-medium">
                                    {Math.min(streakData.currentStreak, 7)}/7 days
                                </span>
                            </div>
                            <Progress
                                value={(Math.min(streakData.currentStreak, 7) / 7) * 100}
                                className="h-2"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ============================================================ */}
            {/* QUICK STUDY LOG + STUDY EVIDENCE / WEAK SUBJECTS             */}
            {/* ============================================================ */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Quick Study Log */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <PenLine className="h-5 w-5 text-primary" />
                                Quick Study Log
                            </CardTitle>
                            <Badge variant="secondary" className="text-[10px]">
                                Manual Evidence
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {hasCheckedInToday ? (
                            <div className="flex flex-col items-center gap-4 py-6 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-semibold">Logged for today!</p>
                                    <p className="text-sm text-muted-foreground">
                                        You studied {todayHabit?.studied_minutes} minutes
                                        {todayHabit?.study_type && (
                                            <> ({STUDY_TYPES.find(t => t.value === todayHabit.study_type)?.label})</>
                                        )}
                                    </p>
                                    {todayHabit?.subject && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Subject: {todayHabit.subject}
                                            {todayHabit.topic ? ` · ${todayHabit.topic}` : ''}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Minutes */}
                                <div className="space-y-2">
                                    <Label htmlFor="study-minutes">Minutes studied</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="study-minutes"
                                            type="number"
                                            value={studyMinutes}
                                            onChange={(e) => setStudyMinutes(e.target.value)}
                                            min="1"
                                            max="480"
                                            className="w-24"
                                        />
                                        <div className="flex gap-1.5 flex-wrap">
                                            {[15, 30, 60, 90].map((m) => (
                                                <Button
                                                    key={m}
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 px-2.5"
                                                    onClick={() => setStudyMinutes(String(m))}
                                                >
                                                    {m}m
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Study Type */}
                                <div className="space-y-2">
                                    <Label>Study type (optional)</Label>
                                    <div className="flex gap-2 flex-wrap">
                                        {STUDY_TYPES.map((type) => (
                                            <Button
                                                key={type.value}
                                                variant={studyType === type.value ? 'default' : 'outline'}
                                                size="sm"
                                                className="gap-1.5"
                                                onClick={() =>
                                                    setStudyType(
                                                        studyType === type.value ? '' : type.value
                                                    )
                                                }
                                            >
                                                {type.icon}
                                                {type.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Subject */}
                                {subjects.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>Subject (optional)</Label>
                                        <Select
                                            value={studySubject}
                                            onValueChange={setStudySubject}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select a subject" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {subjects.map((s) => (
                                                    <SelectItem key={s.id} value={s.name}>
                                                        {s.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Topic */}
                                <div className="space-y-2">
                                    <Label htmlFor="study-topic">Topic (optional)</Label>
                                    <Input
                                        id="study-topic"
                                        value={studyTopic}
                                        onChange={(e) => setStudyTopic(e.target.value)}
                                        placeholder="e.g. Network Security, Firewall Config"
                                    />
                                </div>

                                {/* Note / Reflection */}
                                <div className="space-y-2">
                                    <Label htmlFor="study-note">Reflection / Note (optional)</Label>
                                    <Textarea
                                        id="study-note"
                                        value={studyNote}
                                        onChange={(e) => setStudyNote(e.target.value)}
                                        placeholder="What did you focus on? What was challenging?"
                                        className="min-h-[60px] resize-none"
                                    />
                                </div>

                                <Button
                                    onClick={handleCheckin}
                                    disabled={saving}
                                    className="w-full"
                                    size="lg"
                                >
                                    {saving ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                    )}
                                    Log Study Session
                                </Button>

                                <p className="text-[11px] text-muted-foreground text-center mt-1">
                                    💡 Manual check-ins count as basic study evidence.
                                    Complete revision sessions + quizzes for stronger proof.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Right column: Evidence Breakdown + Weak Subject Progress */}
                <div className="space-y-6">
                    {/* Study Evidence Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                                Study Evidence Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {evidenceBreakdown.manualCheckins + evidenceBreakdown.startedSessions + evidenceBreakdown.validatedSessions === 0 ? (
                                <div className="flex flex-col items-center gap-3 py-4 text-center">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Complete a revision session to start building your study evidence profile.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <EvidenceBar
                                        label="Validated Sessions"
                                        value={evidenceBreakdown.validatedSessions}
                                        color="bg-emerald-500"
                                        strength="Strong"
                                        icon={<ShieldCheck className="h-3.5 w-3.5" />}
                                    />
                                    <EvidenceBar
                                        label="Started Sessions"
                                        value={evidenceBreakdown.startedSessions}
                                        color="bg-blue-500"
                                        strength="Medium"
                                        icon={<BookOpen className="h-3.5 w-3.5" />}
                                    />
                                    {evidenceBreakdown.proofUploads > 0 && (
                                        <EvidenceBar
                                            label="Proof Uploads"
                                            value={evidenceBreakdown.proofUploads}
                                            color="bg-violet-500"
                                            strength="Medium"
                                            icon={<FileText className="h-3.5 w-3.5" />}
                                        />
                                    )}
                                    <EvidenceBar
                                        label="Manual Check-ins"
                                        value={evidenceBreakdown.manualCheckins}
                                        color="bg-amber-500"
                                        strength="Basic"
                                        icon={<PenLine className="h-3.5 w-3.5" />}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Weak Subject Progress */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                Weak Subject Progress
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {weakSubjectProgress.length === 0 ? (
                                <div className="flex flex-col items-center gap-3 py-4 text-center">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Take more quizzes to see weak subject progress and improvement tracking.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {weakSubjectProgress.map((item, i) => (
                                        <div key={i} className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-sm font-medium truncate">
                                                        {item.topic || item.subject}
                                                    </span>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-[10px] shrink-0"
                                                    >
                                                        {item.totalAttempts} attempts
                                                    </Badge>
                                                </div>
                                                <span className={`text-sm font-semibold ${
                                                    item.currentAccuracy >= 60
                                                        ? 'text-amber-600 dark:text-amber-400'
                                                        : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                    {item.currentAccuracy}%
                                                </span>
                                            </div>
                                            <Progress
                                                value={item.currentAccuracy}
                                                className="h-1.5"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ============================================================ */}
            {/* WEEKLY STUDY POINTS                                          */}
            {/* ============================================================ */}
            <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-chart-2/5 pointer-events-none" />
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                        This Week&apos;s Study Points
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {weeklyPoints.total === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                <Sparkles className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">No points earned this week yet</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Complete validation quizzes and revision sessions to earn points.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <PointCard
                                label="Quiz Validation"
                                points={weeklyPoints.quizValidation}
                                icon={<ClipboardCheck className="h-4 w-4 text-emerald-500" />}
                            />
                            <PointCard
                                label="Session Completion"
                                points={weeklyPoints.sessionCompletion}
                                icon={<BookOpen className="h-4 w-4 text-blue-500" />}
                            />
                            <PointCard
                                label="Proof Uploads"
                                points={weeklyPoints.proofUploads}
                                icon={<FileText className="h-4 w-4 text-violet-500" />}
                            />
                            <div className="flex flex-col items-center justify-center rounded-xl bg-primary/10 p-4">
                                <span className="text-xs text-muted-foreground mb-1">Total</span>
                                <span className="text-2xl font-bold text-primary">
                                    +{weeklyPoints.total}
                                </span>
                                <span className="text-[10px] text-muted-foreground">points</span>
                            </div>
                        </div>
                    )}

                    {/* All-time stats */}
                    {userStats && userStats.total_points > 0 && (
                        <div className="mt-4 flex items-center justify-between border-t pt-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Award className="h-4 w-4" />
                                All-time points
                            </div>
                            <span className="font-semibold">
                                {userStats.total_points.toLocaleString()} pts
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ============================================================ */}
            {/* BADGES                                                       */}
            {/* ============================================================ */}
            {(() => {
                const badges = [];
                if (streakData.currentStreak >= 7) badges.push({ name: 'Week Warrior', emoji: '⚔️' });
                if (streakData.currentStreak >= 30) badges.push({ name: 'Monthly Master', emoji: '🏅' });
                if (streakData.longestStreak >= 100) badges.push({ name: 'Century Club', emoji: '💯' });
                if (streakData.totalDays >= 50) badges.push({ name: 'Dedicated Learner', emoji: '📚' });
                if (totalValidatedSessions >= 10) badges.push({ name: 'Validation Pro', emoji: '✅' });
                if (weeklySessionData.completionRate >= 100 && weeklySessionData.planned > 0)
                    badges.push({ name: 'Perfect Week', emoji: '⭐' });

                if (badges.length === 0) return null;

                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-primary" />
                                Earned Badges
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-3">
                                {badges.map((badge) => (
                                    <Badge
                                        key={badge.name}
                                        variant="secondary"
                                        className="px-4 py-2 text-sm gap-1.5"
                                    >
                                        <span>{badge.emoji}</span>
                                        {badge.name}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                );
            })()}
        </div>
    );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusTile({
    label,
    value,
    color,
    icon,
}: {
    label: string;
    value: number;
    color: string;
    icon: React.ReactNode;
}) {
    return (
        <div className={`rounded-xl p-3.5 ${color} transition-transform hover:scale-[1.02]`}>
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-xs font-medium opacity-80">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    );
}

function EvidenceBar({
    label,
    value,
    color,
    strength,
    icon,
}: {
    label: string;
    value: number;
    color: string;
    strength: 'Strong' | 'Medium' | 'Basic';
    icon: React.ReactNode;
}) {
    const strengthColors = {
        Strong: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40',
        Medium: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40',
        Basic: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40',
    };

    return (
        <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${strengthColors[strength]}`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] h-5">
                            {strength}
                        </Badge>
                        <span className="text-sm font-semibold w-8 text-right">{value}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PointCard({
    label,
    points,
    icon,
}: {
    label: string;
    points: number;
    icon: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center rounded-xl border p-4 text-center transition-shadow hover:shadow-md">
            <div className="mb-2">{icon}</div>
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-lg font-bold mt-0.5">
                +{points}
            </span>
        </div>
    );
}
