'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { LoadingSkeleton } from '@/components/app/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { Habit } from '@/lib/types';
import { calculateStreak, formatDate } from '@/lib/streak-calculator';
import {
    Flame,
    Target,
    Calendar,
    CheckCircle2,
    Trophy,
    Loader2,
    TrendingUp,
} from 'lucide-react';

export default function HabitsPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [habits, setHabits] = useState<Habit[]>([]);
    const [studyMinutes, setStudyMinutes] = useState('30');

    const today = formatDate(new Date());

    useEffect(() => {
        fetchHabits();
    }, []);

    const fetchHabits = async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from('habits')
            .select('*')
            .order('date', { ascending: false })
            .limit(60);

        if (data) setHabits(data);
        setLoading(false);
    };

    const handleCheckin = async () => {
        setSaving(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const minutes = parseInt(studyMinutes) || 0;

        const { error } = await supabase
            .from('habits')
            .upsert({
                user_id: user.id,
                date: today,
                studied_minutes: minutes,
                checkin: true,
            }, {
                onConflict: 'user_id,date',
            });

        if (error) {
            toast({
                title: 'Error',
                description: 'Failed to check in',
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Checked in! 🎉',
                description: `Logged ${minutes} minutes of study`,
            });
            fetchHabits();
        }
        setSaving(false);
    };

    const streakData = calculateStreak(habits);
    const todayHabit = habits.find((h) => h.date === today);
    const hasCheckedInToday = todayHabit?.checkin ?? false;
    const totalMinutesThisWeek = streakData.last7Days.reduce(
        (sum, d) => sum + d.minutes,
        0
    );
    const averageMinutesPerDay = Math.round(totalMinutesThisWeek / 7);

    // Streak badges
    const badges = [];
    if (streakData.currentStreak >= 7) badges.push({ name: 'Week Warrior', level: 1 });
    if (streakData.currentStreak >= 30) badges.push({ name: 'Monthly Master', level: 2 });
    if (streakData.longestStreak >= 100) badges.push({ name: 'Century Club', level: 3 });
    if (streakData.totalDays >= 50) badges.push({ name: 'Dedicated Learner', level: 2 });

    if (loading) {
        return (
            <div className="space-y-8">
                <PageHeader title="Habits" description="Track your study streak" />
                <LoadingSkeleton variant="stats" count={4} />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="Habits"
                description="Build consistent study habits and track your progress"
            />

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Current Streak"
                    value={`${streakData.currentStreak} days`}
                    subtitle={streakData.currentStreak > 0 ? 'Keep it going!' : 'Start today!'}
                    icon={Flame}
                />
                <StatCard
                    title="Longest Streak"
                    value={`${streakData.longestStreak} days`}
                    subtitle="Personal best"
                    icon={Trophy}
                />
                <StatCard
                    title="This Week"
                    value={`${totalMinutesThisWeek}m`}
                    subtitle={`~${averageMinutesPerDay}m per day`}
                    icon={TrendingUp}
                />
                <StatCard
                    title="Total Check-ins"
                    value={streakData.totalDays}
                    subtitle="Days studied"
                    icon={Target}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Daily Check-in */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Daily Check-in
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {hasCheckedInToday ? (
                            <div className="flex flex-col items-center gap-4 py-6 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-semibold">All checked in!</p>
                                    <p className="text-muted-foreground">
                                        You studied {todayHabit?.studied_minutes} minutes today
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="minutes">How many minutes did you study today?</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="minutes"
                                            type="number"
                                            value={studyMinutes}
                                            onChange={(e) => setStudyMinutes(e.target.value)}
                                            min="1"
                                            max="480"
                                            className="w-24"
                                        />
                                        <span className="flex items-center text-muted-foreground">minutes</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {[15, 30, 45, 60, 90].map((m) => (
                                        <Button
                                            key={m}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setStudyMinutes(String(m))}
                                        >
                                            {m}m
                                        </Button>
                                    ))}
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
                                    Check In
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Streak Visualization */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Flame className="h-5 w-5" />
                            Last 7 Days
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-7 gap-2">
                            {streakData.last7Days.map((day) => {
                                const date = new Date(day.date);
                                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                const isToday = day.date === today;

                                return (
                                    <div
                                        key={day.date}
                                        className="flex flex-col items-center gap-2"
                                    >
                                        <span className="text-xs text-muted-foreground">{dayName}</span>
                                        <div
                                            className={`flex h-12 w-12 flex-col items-center justify-center rounded-lg transition-colors ${day.checkin
                                                    ? 'bg-primary text-primary-foreground'
                                                    : isToday
                                                        ? 'border-2 border-dashed border-primary/50'
                                                        : 'bg-muted'
                                                }`}
                                        >
                                            {day.checkin ? (
                                                <CheckCircle2 className="h-5 w-5" />
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    {date.getDate()}
                                                </span>
                                            )}
                                        </div>
                                        {day.minutes > 0 && (
                                            <span className="text-xs font-medium">{day.minutes}m</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Progress bar for streak */}
                        <div className="mt-6 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>Progress to 7-day streak</span>
                                <span className="font-medium">
                                    {Math.min(streakData.currentStreak, 7)}/7
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

            {/* Badges */}
            {badges.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5" />
                            Earned Badges
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-3">
                            {badges.map((badge) => (
                                <Badge
                                    key={badge.name}
                                    variant="secondary"
                                    className="px-4 py-2 text-sm"
                                >
                                    {badge.name}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
