import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { EmptyState } from '@/components/app/empty-state';
import { LoadingSkeleton } from '@/components/app/loading-skeleton';
import { DashboardCalendar } from '@/components/app/dashboard-calendar';
import { DashboardUpload } from '@/components/app/dashboard-upload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Flame,
    Target,
    BookOpen,
    Calendar,
    ArrowRight,
    TrendingDown,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';
import { calculateStreak, formatDate } from '@/lib/streak-calculator';
import { getWeakestTopics } from '@/lib/weakness-calculator';

export default async function DashboardPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    // Fetch data in parallel
    const [
        { data: habits },
        { data: planTasks },
        { data: quizAttempts },
        { data: quizzes },
        { data: topics },
    ] = await Promise.all([
        supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .limit(30),
        supabase
            .from('plan_tasks')
            .select('*, plans!inner(*)')
            .eq('plans.user_id', user.id)
            .gte('start_datetime', new Date().toISOString().split('T')[0])
            .order('start_datetime', { ascending: true })
            .limit(5),
        supabase
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', user.id),
        supabase
            .from('quizzes')
            .select('*')
            .eq('user_id', user.id),
        supabase
            .from('topics')
            .select('*')
            .eq('user_id', user.id),
    ]);

    // Calculate streak
    const streakData = calculateStreak(habits || []);

    // Calculate weaknesses
    const weaknesses = getWeakestTopics(
        (quizAttempts || []).map(a => ({ ...a, quiz: quizzes?.find(q => q.id === a.quiz_id) })),
        quizzes || [],
        3
    );

    // Today's tasks
    const todayStr = formatDate(new Date());
    const todayTasks = (planTasks || []).filter(
        task => formatDate(new Date(task.start_datetime)) === todayStr
    );

    // Stats
    const totalQuizzes = quizzes?.length || 0;
    const totalCorrect = quizAttempts?.filter(a => a.is_correct).length || 0;
    const totalAttempts = quizAttempts?.length || 0;
    const overallAccuracy = totalAttempts > 0
        ? Math.round((totalCorrect / totalAttempts) * 100)
        : 0;

    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="Dashboard"
                description={`Welcome back! Here's your study overview.`}
            />

            {/* Upload & Generate Quiz Section */}
            <Suspense fallback={<LoadingSkeleton />}>
                <DashboardUpload />
            </Suspense>

            {/* Quick Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Current Streak"
                    value={`${streakData.currentStreak} days`}
                    subtitle={`Longest: ${streakData.longestStreak} days`}
                    icon={Flame}
                />
                <StatCard
                    title="Quiz Accuracy"
                    value={`${overallAccuracy}%`}
                    subtitle={`${totalCorrect}/${totalAttempts} correct`}
                    icon={Target}
                />
                <StatCard
                    title="Topics Studied"
                    value={topics?.length || 0}
                    subtitle="Across all subjects"
                    icon={BookOpen}
                />
                <StatCard
                    title="Quizzes Taken"
                    value={totalQuizzes}
                    subtitle="Keep practicing!"
                    icon={Calendar}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Calendar Widget */}
                <DashboardCalendar />

                {/* Weak Areas */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Weak Areas</CardTitle>
                        <Link href="/app/quiz">
                            <Button variant="ghost" size="sm">
                                Practice
                                <ArrowRight className="ml-1 h-4 w-4" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {weaknesses.length === 0 ? (
                            <EmptyState
                                icon={Target}
                                title="No data yet"
                                description="Take some quizzes to identify your weak areas"
                                action={{
                                    label: 'Take Quiz',
                                    href: '/app/quiz',
                                }}
                                className="py-8"
                            />
                        ) : (
                            <div className="space-y-4">
                                {weaknesses.map((weakness, index) => (
                                    <div key={`${weakness.subject}-${weakness.topic}`} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {weakness.accuracy < 50 ? (
                                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                                ) : (
                                                    <TrendingDown className="h-4 w-4 text-yellow-500" />
                                                )}
                                                <span className="font-medium">{weakness.topic}</span>
                                            </div>
                                            <span className={`text-sm font-medium ${weakness.accuracy < 50
                                                ? 'text-destructive'
                                                : weakness.accuracy < 70
                                                    ? 'text-yellow-600 dark:text-yellow-500'
                                                    : 'text-muted-foreground'
                                                }`}>
                                                {weakness.accuracy}%
                                            </span>
                                        </div>
                                        <Progress
                                            value={weakness.accuracy}
                                            className="h-2"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {weakness.subject} • {weakness.totalAttempts} attempts
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 7-Day Activity */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Last 7 Days</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between gap-2">
                        {streakData.last7Days.map((day) => {
                            const date = new Date(day.date);
                            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                            const isToday = day.date === formatDate(new Date());

                            return (
                                <div
                                    key={day.date}
                                    className="flex flex-1 flex-col items-center gap-2"
                                >
                                    <span className="text-xs text-muted-foreground">{dayName}</span>
                                    <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${day.checkin
                                            ? 'bg-primary text-primary-foreground'
                                            : isToday
                                                ? 'border-2 border-dashed border-primary/50 bg-muted'
                                                : 'bg-muted text-muted-foreground'
                                            }`}
                                    >
                                        {day.checkin ? (
                                            <CheckCircle2 className="h-5 w-5" />
                                        ) : (
                                            <span className="text-xs">{date.getDate()}</span>
                                        )}
                                    </div>
                                    {day.minutes > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            {day.minutes}m
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
