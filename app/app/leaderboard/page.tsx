'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { LoadingSkeleton } from '@/components/app/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getLeaderboard, getUserStats } from '@/app/actions/revision';
import type { LeaderboardEntry, UserStats } from '@/lib/types';
import {
    Trophy,
    Medal,
    Crown,
    Star,
    Zap,
    Users,
    Calendar,
    TrendingUp,
    Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Period = 'daily' | 'weekly' | 'all_time';

const PERIOD_LABELS: Record<Period, { label: string; icon: typeof Calendar }> = {
    daily: { label: 'Today', icon: Flame },
    weekly: { label: 'This Week', icon: Calendar },
    all_time: { label: 'All Time', icon: TrendingUp },
};

function getRankIcon(rank: number) {
    switch (rank) {
        case 1: return <Crown className="h-5 w-5 text-amber-400" />;
        case 2: return <Medal className="h-5 w-5 text-slate-400" />;
        case 3: return <Medal className="h-5 w-5 text-amber-600" />;
        default: return <span className="w-5 text-center text-sm font-bold text-muted-foreground">#{rank}</span>;
    }
}

function getRankBg(rank: number) {
    switch (rank) {
        case 1: return 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/20';
        case 2: return 'bg-gradient-to-r from-slate-500/10 to-gray-500/10 border-slate-400/20';
        case 3: return 'bg-gradient-to-r from-amber-700/10 to-orange-600/10 border-amber-600/20';
        default: return '';
    }
}

function getTitleColor(title: string) {
    switch (title) {
        case 'Study Master': return 'bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0';
        case 'Scholar': return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0';
        default: return 'bg-muted text-muted-foreground';
    }
}

export default function LeaderboardPage() {
    const { toast } = useToast();
    const toastRef = useRef(toast);
    toastRef.current = toast;

    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('all_time');
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string>('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [leaderboard, stats] = await Promise.all([
                getLeaderboard(period),
                getUserStats(),
            ]);

            if (leaderboard.error) {
                toastRef.current({ title: 'Error', description: leaderboard.error, variant: 'destructive' });
            }

            setEntries(leaderboard.entries);
            if (stats.stats) {
                setUserStats(stats.stats);
                setCurrentUserId(stats.stats.user_id);
            }
        } catch (err: any) {
            toastRef.current({ title: 'Error loading leaderboard', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [period]); // ← toast removed from deps — uses ref instead

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Find current user's rank
    const currentUserEntry = entries.find(e => e.user_id === currentUserId);

    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="Leaderboard"
                description="See how you stack up against other learners"
            />

            {/* User Stats Banner */}
            {userStats && (
                <Card className="bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 border-primary/20">
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-primary/10">
                                    <Trophy className="h-7 w-7 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Your Profile</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-2xl font-bold">{userStats.total_points} pts</span>
                                        <Badge className={getTitleColor(userStats.title)}>
                                            {userStats.title === 'Study Master' && <Star className="h-3 w-3 mr-1" />}
                                            {userStats.title}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                            {currentUserEntry && (
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground">Your Rank</p>
                                    <p className="text-3xl font-bold text-primary">#{currentUserEntry.rank}</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Period Tabs */}
            <div className="flex gap-2">
                {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => {
                    const { label, icon: Icon } = PERIOD_LABELS[p];
                    return (
                        <Button
                            key={p}
                            variant={period === p ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPeriod(p)}
                            className="gap-1.5"
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </Button>
                    );
                })}
            </div>

            {/* Leaderboard Table */}
            {loading ? (
                <LoadingSkeleton variant="list" count={5} />
            ) : entries.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="p-8 text-center">
                        <div className="p-4 bg-muted rounded-full inline-block mb-4">
                            <Users className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-lg">No Rankings Yet</h3>
                        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                            {period === 'daily'
                                ? "No one has earned points today yet. Be the first!"
                                : period === 'weekly'
                                    ? "No points earned this week yet. Start a revision session!"
                                    : "Complete revision sessions to appear on the leaderboard."
                            }
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {/* Top 3 Podium */}
                    {entries.length >= 3 && period === 'all_time' && (
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {/* 2nd place */}
                            <Card className={cn("text-center pt-8", getRankBg(2))}>
                                <CardContent className="p-4 space-y-2">
                                    <Medal className="h-8 w-8 mx-auto text-slate-400" />
                                    <p className="font-semibold truncate text-sm">{entries[1]?.display_name}</p>
                                    <p className="text-lg font-bold">{entries[1]?.total_points} pts</p>
                                    <Badge variant="outline" className="text-[10px]">{entries[1]?.title}</Badge>
                                </CardContent>
                            </Card>
                            {/* 1st place */}
                            <Card className={cn("text-center pt-4 -mt-4 relative", getRankBg(1))}>
                                <CardContent className="p-4 space-y-2">
                                    <Crown className="h-10 w-10 mx-auto text-amber-400" />
                                    <p className="font-semibold truncate">{entries[0]?.display_name}</p>
                                    <p className="text-2xl font-bold">{entries[0]?.total_points} pts</p>
                                    <Badge className={getTitleColor(entries[0]?.title || 'Amateur')}>
                                        {entries[0]?.title}
                                    </Badge>
                                </CardContent>
                            </Card>
                            {/* 3rd place */}
                            <Card className={cn("text-center pt-10", getRankBg(3))}>
                                <CardContent className="p-4 space-y-2">
                                    <Medal className="h-7 w-7 mx-auto text-amber-600" />
                                    <p className="font-semibold truncate text-sm">{entries[2]?.display_name}</p>
                                    <p className="text-lg font-bold">{entries[2]?.total_points} pts</p>
                                    <Badge variant="outline" className="text-[10px]">{entries[2]?.title}</Badge>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Full List */}
                    {entries.map((entry) => {
                        const isCurrentUser = entry.user_id === currentUserId;

                        return (
                            <div
                                key={entry.user_id}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                    isCurrentUser && "bg-primary/5 border-primary/30 ring-1 ring-primary/10",
                                    !isCurrentUser && getRankBg(entry.rank)
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    {getRankIcon(entry.rank)}
                                    <div className="min-w-0">
                                        <p className={cn(
                                            "font-medium truncate",
                                            isCurrentUser && "text-primary"
                                        )}>
                                            {entry.display_name}
                                            {isCurrentUser && <span className="text-xs ml-1.5 text-muted-foreground">(You)</span>}
                                        </p>
                                        <Badge variant="outline" className={cn("text-[10px]", getTitleColor(entry.title))}>
                                            {entry.title}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-lg font-bold">{entry.total_points}</p>
                                    <p className="text-xs text-muted-foreground">points</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* How Points Work */}
            <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-6">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        How Points Work
                    </h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div className="p-3 rounded-lg bg-background border">
                            <p className="font-medium text-emerald-500">+50 pts</p>
                            <p className="text-muted-foreground">Standard quiz pass (≥60%)</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background border">
                            <p className="font-medium text-amber-500">+100 pts</p>
                            <p className="text-muted-foreground">Weak subject mastery (≥80%)</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background border">
                            <p className="font-medium text-blue-500">+30 pts</p>
                            <p className="text-muted-foreground">File upload validation</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background border">
                            <p className="font-medium text-purple-500">+20 pts</p>
                            <p className="text-muted-foreground">Personal best bonus</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium text-sm mb-2">Title Progression</h4>
                        <div className="flex gap-3 flex-wrap">
                            <Badge className="bg-muted text-muted-foreground">Amateur (0-499)</Badge>
                            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0">Scholar (500-1499)</Badge>
                            <Badge className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0">
                                <Star className="h-3 w-3 mr-1" />
                                Study Master (1500+)
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
