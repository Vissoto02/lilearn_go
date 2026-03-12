'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { LoadingSkeleton } from '@/components/app/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
    getCurrentStudyBlock,
    getTodayStudyBlocks,
    startRevisionSession,
    getActiveSession,
    getUserStats,
    skipSession,
} from '@/app/actions/revision';
import type { RevisionSession, UserStats } from '@/lib/types';
import {
    Play,
    Clock,
    BookOpen,
    AlertTriangle,
    Timer,
    Trophy,
    Zap,
    CheckCircle2,
    XCircle,
    Calendar,
    ArrowRight,
    Loader2,
    FileUp,
    Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Countdown Timer Component
// ============================================================================

function CountdownTimer({
    endTime,
    onComplete,
}: {
    endTime: Date;
    onComplete: () => void;
}) {
    const [timeLeft, setTimeLeft] = useState(() => {
        const diff = endTime.getTime() - Date.now();
        return Math.max(0, Math.floor(diff / 1000));
    });

    useEffect(() => {
        const interval = setInterval(() => {
            const diff = endTime.getTime() - Date.now();
            const seconds = Math.max(0, Math.floor(diff / 1000));
            setTimeLeft(seconds);

            if (seconds <= 0) {
                clearInterval(interval);
                onComplete();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [endTime, onComplete]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const totalDuration = Math.max(1, Math.floor((endTime.getTime() - Date.now()) / 1000) + timeLeft);
    const progressPercent = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 100;

    const isUrgent = timeLeft < 300; // Less than 5 minutes
    const isCritical = timeLeft < 60; // Less than 1 minute

    return (
        <div className="flex flex-col items-center gap-6">
            <div className={cn(
                "relative w-48 h-48 rounded-full flex items-center justify-center border-4 transition-colors duration-500",
                isCritical
                    ? "border-red-500 bg-red-500/5"
                    : isUrgent
                        ? "border-amber-500 bg-amber-500/5"
                        : "border-primary bg-primary/5"
            )}>
                <div className="text-center">
                    <div className={cn(
                        "text-5xl font-mono font-bold tabular-nums transition-colors",
                        isCritical ? "text-red-500" : isUrgent ? "text-amber-500" : "text-foreground"
                    )}>
                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">remaining</p>
                </div>
            </div>
            <Progress
                value={Math.min(progressPercent, 100)}
                className="w-full max-w-xs h-2"
            />
        </div>
    );
}

// ============================================================================
// Study Block Card (for today's schedule)
// ============================================================================

function StudyBlockCard({
    event,
    isActive,
    onStart,
    starting,
}: {
    event: any;
    isActive: boolean;
    onStart: (eventId: string) => void;
    starting: boolean;
}) {
    const startTime = new Date(event.start_time);
    const endTime = new Date(event.end_time);
    const now = new Date();
    const isPast = now > endTime;
    const isFuture = now < startTime;

    const formatTime = (d: Date) =>
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    return (
        <Card className={cn(
            "transition-all duration-300",
            isActive && "border-primary/50 shadow-lg shadow-primary/10 ring-1 ring-primary/20",
            isPast && "opacity-50",
            isFuture && "opacity-75"
        )}>
            <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                            "p-2 rounded-lg shrink-0",
                            isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                            <BookOpen className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold truncate">{event.title}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{formatTime(startTime)} – {formatTime(endTime)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {event.has_quiz ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                Quiz Available
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                                Upload Only
                            </Badge>
                        )}

                        {isActive ? (
                            <Button
                                size="sm"
                                onClick={() => onStart(event.id)}
                                disabled={starting}
                                className="gap-1.5"
                            >
                                {starting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Play className="h-4 w-4" />
                                )}
                                Start
                            </Button>
                        ) : isPast ? (
                            <Badge variant="secondary" className="text-[10px]">Ended</Badge>
                        ) : (
                            <Badge variant="outline" className="text-[10px]">Upcoming</Badge>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Main Revision Page
// ============================================================================

export default function RevisionPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);

    // Data state
    const [todayBlocks, setTodayBlocks] = useState<any[]>([]);
    const [activeBlock, setActiveBlock] = useState<any | null>(null);
    const [activeSession, setActiveSession] = useState<RevisionSession | null>(null);
    const [userStats, setUserStats] = useState<UserStats | null>(null);

    // Timer state
    const [timerComplete, setTimerComplete] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [blocksResult, currentResult, sessionResult, statsResult] = await Promise.all([
                getTodayStudyBlocks(),
                getCurrentStudyBlock(),
                getActiveSession(),
                getUserStats(),
            ]);

            if (blocksResult.events) setTodayBlocks(blocksResult.events);
            if (currentResult.event) setActiveBlock(currentResult.event);
            if (sessionResult.session) setActiveSession(sessionResult.session);
            if (statsResult.stats) setUserStats(statsResult.stats);
        } catch (err) {
            console.error('Error fetching revision data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        // Refresh every 30 seconds to catch slot transitions
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Handle starting a revision session
    const handleStart = async (calendarEventId: string) => {
        setStarting(true);
        try {
            const result = await startRevisionSession(calendarEventId);

            if (result.error) {
                toast({
                    title: 'Cannot start session',
                    description: result.error,
                    variant: 'destructive',
                });
                return;
            }

            if (result.session) {
                setActiveSession(result.session);
                toast({
                    title: 'Session started! 🎯',
                    description: result.session.is_weak_subject
                        ? `⚠️ "${result.session.subject}" is a weak subject — you'll need ≥80% to fully pass!`
                        : `Studying "${result.session.subject}". Focus and do your best!`,
                });
            }
        } catch (err: any) {
            toast({
                title: 'Error',
                description: err.message,
                variant: 'destructive',
            });
        } finally {
            setStarting(false);
        }
    };

    // Handle timer completion -> redirect to validation
    const handleTimerComplete = useCallback(() => {
        setTimerComplete(true);
    }, []);

    const handleGoToValidation = () => {
        if (activeSession) {
            router.push(`/app/revision/validate?sessionId=${activeSession.id}`);
        }
    };

    const handleSkip = async () => {
        if (!activeSession) return;
        await skipSession(activeSession.id);
        setActiveSession(null);
        setTimerComplete(false);
        toast({ title: 'Session skipped', description: 'No points were awarded.' });
        fetchData();
    };

    // ========================================================================
    // RENDER
    // ========================================================================

    if (loading) {
        return (
            <div className="space-y-8">
                <PageHeader title="Revision" description="Study sessions & validation" />
                <LoadingSkeleton variant="page" />
            </div>
        );
    }

    // ---- ACTIVE SESSION: Show timer ----
    if (activeSession && activeSession.status === 'active') {
        const event = activeBlock || todayBlocks.find(b => b.id === activeSession.calendar_event_id);
        const endTime = event
            ? new Date(event.end_time)
            : new Date(new Date(activeSession.started_at).getTime() + (activeSession.duration_minutes || 30) * 60000);

        return (
            <div className="space-y-8 animate-fade-in">
                <PageHeader title="Revision" description="Focus mode — session in progress" />

                <div className="max-w-lg mx-auto space-y-8">
                    {/* Session Info */}
                    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                        <CardContent className="p-6 text-center space-y-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                Session Active
                            </div>

                            <h2 className="text-2xl font-bold">{activeSession.subject}</h2>
                            {activeSession.topic && (
                                <p className="text-muted-foreground">{activeSession.topic}</p>
                            )}

                            {activeSession.is_weak_subject && (
                                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Weak Subject — Need ≥80%
                                </Badge>
                            )}
                        </CardContent>
                    </Card>

                    {/* Countdown Timer */}
                    {!timerComplete ? (
                        <div className="flex flex-col items-center gap-6">
                            <CountdownTimer
                                endTime={endTime}
                                onComplete={handleTimerComplete}
                            />
                            <p className="text-sm text-muted-foreground text-center max-w-xs">
                                Stay focused! When the timer ends, you'll be directed to validate your session.
                            </p>
                        </div>
                    ) : (
                        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
                            <CardContent className="p-6 text-center space-y-4">
                                <div className="p-4 rounded-full bg-emerald-500/10 inline-block">
                                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                                </div>
                                <h3 className="text-xl font-bold">Time's Up!</h3>
                                <p className="text-muted-foreground">
                                    Great work! Now validate your session to earn points.
                                </p>
                                <div className="flex flex-col gap-2">
                                    <Button size="lg" onClick={handleGoToValidation} className="gap-2">
                                        <ArrowRight className="h-5 w-5" />
                                        Go to Validation Hub
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={handleSkip}>
                                        Skip — I don't want points
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        );
    }

    // ---- NO ACTIVE SESSION: Show schedule ----
    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="Revision"
                description="Start a revision session when your study block is active"
            />

            {/* User Stats Bar */}
            {userStats && (
                <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10">
                                <Trophy className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{userStats.total_points}</p>
                                <p className="text-xs text-muted-foreground">Total Points</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-500/10">
                                <Zap className="h-5 w-5 text-indigo-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{userStats.title}</p>
                                <p className="text-xs text-muted-foreground">Current Title</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                <Target className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{userStats.best_improvement_pct || 0}%</p>
                                <p className="text-xs text-muted-foreground">Best Score</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Today's Study Blocks */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Today's Study Schedule
                </h2>

                {todayBlocks.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="p-8 text-center">
                            <div className="p-4 bg-muted rounded-full inline-block mb-4">
                                <Calendar className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold text-lg">No Study Blocks Today</h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                                No active slots available for today. Generate a study plan in the Planner or check your schedule for tomorrow.
                            </p>
                            <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => router.push('/app/planner')}
                            >
                                Go to Planner
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {todayBlocks.map((block) => {
                            const now = new Date();
                            const isActive = new Date(block.start_time) <= now && now <= new Date(block.end_time);

                            return (
                                <StudyBlockCard
                                    key={block.id}
                                    event={block}
                                    isActive={isActive}
                                    onStart={handleStart}
                                    starting={starting}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* How It Works */}
            <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-6">
                    <h3 className="font-semibold mb-3">How Revision Works</h3>
                    <div className="grid sm:grid-cols-3 gap-4 text-sm">
                        <div className="flex gap-3">
                            <div className="p-1.5 rounded bg-primary/10 text-primary h-fit">
                                <Play className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="font-medium">1. Start Session</p>
                                <p className="text-muted-foreground">Press Start when your study block is active</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="p-1.5 rounded bg-amber-500/10 text-amber-500 h-fit">
                                <Timer className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="font-medium">2. Study & Focus</p>
                                <p className="text-muted-foreground">Timer counts down until the block ends</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-500 h-fit">
                                <Trophy className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="font-medium">3. Earn Points</p>
                                <p className="text-muted-foreground">Pass a quiz (50pts) or upload study notes (30pts)</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
