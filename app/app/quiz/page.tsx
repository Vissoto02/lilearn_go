'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { QuizPlayer, QuizResult } from '@/components/app/quiz-player';
import { EmptyState } from '@/components/app/empty-state';
import { LoadingSkeleton } from '@/components/app/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { Quiz, QuizQuestion, QuizAttempt } from '@/lib/types';
import {
    Play,
    BookOpen,
    Loader2,
    History,
    ChevronRight,
    ChevronLeft,
    Search,
    Sparkles,
    FileText,
    Clock,
    Trophy,
    Target,
    RotateCcw,
    CheckCircle2,
    XCircle,
    ArrowRight,
    BarChart3,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface QuizWithMeta extends Quiz {
    question_count: number;
    attempt_count: number;
    best_score: number | null;
    is_new: boolean;
}

interface AttemptGroup {
    attempt_number: number;
    date: string;
    results: QuizAttempt[];
    score: number;
    total: number;
}

type PageView = 'list' | 'detail' | 'playing' | 'complete';

// ============================================================================
// Helpers
// ============================================================================

function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
}

function getDifficultyColor(difficulty: string): string {
    switch (difficulty) {
        case 'easy': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
        case 'hard': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
        default: return 'bg-muted text-muted-foreground';
    }
}

function getQuestionTypeLabel(type?: string): string {
    switch (type) {
        case 'mcq': return 'MCQ';
        case 'tf': return 'T/F';
        case 'fill': return 'Fill';
        default: return 'MCQ';
    }
}

function getQuestionTypeColor(type?: string): string {
    switch (type) {
        case 'tf': return 'bg-teal-500/10 text-teal-500 border-teal-500/20';
        case 'fill': return 'bg-violet-500/10 text-violet-500 border-violet-500/20';
        default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
}

// ============================================================================
// Page Wrapper (Suspense for useSearchParams)
// ============================================================================

export default function QuizPage() {
    return (
        <Suspense fallback={
            <div className="space-y-8">
                <PageHeader title="Quiz" description="Test your knowledge with AI-generated quizzes" />
                <LoadingSkeleton variant="card" count={3} />
            </div>
        }>
            <QuizPageContent />
        </Suspense>
    );
}

// ============================================================================
// Main Component
// ============================================================================

function QuizPageContent() {
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const quizIdParam = searchParams.get('id');

    // Data state
    const [quizzes, setQuizzes] = useState<QuizWithMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // View state
    const [pageView, setPageView] = useState<PageView>('list');
    const [selectedQuiz, setSelectedQuiz] = useState<QuizWithMeta | null>(null);
    const [currentQuestions, setCurrentQuestions] = useState<QuizQuestion[]>([]);
    const [attemptHistory, setAttemptHistory] = useState<AttemptGroup[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // ========================================================================
    // Data Fetching
    // ========================================================================

    useEffect(() => {
        fetchQuizzes();
    }, []);

    // Handle ?id= query param for direct quiz access
    useEffect(() => {
        if (quizIdParam && quizzes.length > 0) {
            const quiz = quizzes.find(q => q.id === quizIdParam);
            if (quiz) {
                handleQuizSelect(quiz);
            } else {
                // Quiz not in our list — try to load directly
                loadQuizById(quizIdParam);
            }
        }
    }, [quizIdParam, quizzes]);

    const fetchQuizzes = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        // Fetch all quizzes for the user
        const { data: quizzesData, error } = await supabase
            .from('quizzes')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error || !quizzesData) {
            setLoading(false);
            return;
        }

        // Fetch question counts in parallel
        const quizIds = quizzesData.map(q => q.id);

        // Get question counts
        const { data: questionCounts } = await supabase
            .from('quiz_questions')
            .select('quiz_id')
            .in('quiz_id', quizIds.length > 0 ? quizIds : ['__none__']);

        // Get attempts
        const { data: attempts } = await supabase
            .from('quiz_attempts')
            .select('quiz_id, is_correct')
            .eq('user_id', user.id)
            .in('quiz_id', quizIds.length > 0 ? quizIds : ['__none__']);

        // Build metadata
        const questionCountMap: Record<string, number> = {};
        (questionCounts || []).forEach(qc => {
            questionCountMap[qc.quiz_id] = (questionCountMap[qc.quiz_id] || 0) + 1;
        });

        const attemptCountMap: Record<string, number> = {};
        const bestScoreMap: Record<string, number> = {};
        (attempts || []).forEach(a => {
            attemptCountMap[a.quiz_id] = (attemptCountMap[a.quiz_id] || 0) + 1;
        });

        // Calculate best scores per quiz (group by quiz, find highest correct ratio)
        const attemptsByQuiz: Record<string, { correct: number; total: number }> = {};
        (attempts || []).forEach(a => {
            if (!attemptsByQuiz[a.quiz_id]) {
                attemptsByQuiz[a.quiz_id] = { correct: 0, total: 0 };
            }
            attemptsByQuiz[a.quiz_id].total++;
            if (a.is_correct) attemptsByQuiz[a.quiz_id].correct++;
        });
        Object.entries(attemptsByQuiz).forEach(([quizId, data]) => {
            if (data.total > 0) {
                bestScoreMap[quizId] = Math.round((data.correct / data.total) * 100);
            }
        });

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const enrichedQuizzes: QuizWithMeta[] = quizzesData.map(q => ({
            ...q,
            question_count: questionCountMap[q.id] || 0,
            attempt_count: attemptCountMap[q.id] || 0,
            best_score: bestScoreMap[q.id] ?? null,
            is_new: new Date(q.created_at) > oneDayAgo,
        }));

        setQuizzes(enrichedQuizzes);
        setLoading(false);
    };

    const loadQuizById = async (quizId: string) => {
        const supabase = createClient();
        const { data: quiz } = await supabase
            .from('quizzes')
            .select('*')
            .eq('id', quizId)
            .single();

        if (quiz) {
            const enriched: QuizWithMeta = {
                ...quiz,
                question_count: 0,
                attempt_count: 0,
                best_score: null,
                is_new: true,
            };
            await handleQuizSelect(enriched);
        }
    };

    // ========================================================================
    // Quiz Selection & Detail
    // ========================================================================

    const handleQuizSelect = async (quiz: QuizWithMeta) => {
        setSelectedQuiz(quiz);
        setLoadingDetail(true);
        setPageView('detail');

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch questions and attempt history in parallel
        const [{ data: questions }, { data: attempts }] = await Promise.all([
            supabase
                .from('quiz_questions')
                .select('*')
                .eq('quiz_id', quiz.id)
                .order('created_at', { ascending: true }),
            supabase
                .from('quiz_attempts')
                .select('*')
                .eq('quiz_id', quiz.id)
                .eq('user_id', user.id)
                .order('created_at', { ascending: true }),
        ]);

        setCurrentQuestions(questions || []);

        // Group attempts into sessions by time gap
        // Records from one quiz completion are inserted as a batch (same timestamp),
        // so a 30-second gap cleanly separates different retakes
        if (attempts && attempts.length > 0 && questions) {
            const SESSION_GAP_MS = 30 * 1000; // 30 seconds
            const groups: AttemptGroup[] = [];
            let currentGroup: QuizAttempt[] = [attempts[0]];
            let groupIndex = 1;

            for (let i = 1; i < attempts.length; i++) {
                const prevTime = new Date(attempts[i - 1].created_at).getTime();
                const currTime = new Date(attempts[i].created_at).getTime();

                if (currTime - prevTime > SESSION_GAP_MS) {
                    // Time gap detected — close current group, start a new one
                    const correct = currentGroup.filter(a => a.is_correct).length;
                    groups.push({
                        attempt_number: groupIndex,
                        date: currentGroup[0].created_at,
                        results: [...currentGroup],
                        score: correct,
                        total: currentGroup.length,
                    });
                    currentGroup = [];
                    groupIndex++;
                }
                currentGroup.push(attempts[i]);
            }

            // Push the last group
            if (currentGroup.length > 0) {
                const correct = currentGroup.filter(a => a.is_correct).length;
                groups.push({
                    attempt_number: groupIndex,
                    date: currentGroup[0].created_at,
                    results: [...currentGroup],
                    score: correct,
                    total: currentGroup.length,
                });
            }

            setAttemptHistory(groups);
        } else {
            setAttemptHistory([]);
        }

        setLoadingDetail(false);
    };

    // ========================================================================
    // Quiz Playing
    // ========================================================================

    const handleStartQuiz = () => {
        if (currentQuestions.length === 0) {
            toast({
                title: 'No questions',
                description: 'This quiz has no questions yet. It may still be processing.',
                variant: 'destructive',
            });
            return;
        }
        setPageView('playing');
    };

    const handleQuizComplete = async (results: QuizResult[]) => {
        if (!selectedQuiz) return;

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Record all attempts
        const attemptsToInsert = results.map((r) => ({
            user_id: user.id,
            quiz_id: selectedQuiz.id,
            question_id: r.questionId,
            is_correct: r.isCorrect,
            attempts_count: r.attempts,
            time_spent_sec: r.timeSpentSec,
        }));

        const { error: insertError } = await supabase.from('quiz_attempts').insert(attemptsToInsert);
        if (insertError) {
            console.error('Failed to save quiz attempts:', insertError);
            toast({
                title: 'Warning',
                description: 'Quiz results could not be saved. ' + insertError.message,
                variant: 'destructive',
            });
        }

        setPageView('complete');

        // Refresh quiz list to update attempt counts/scores
        fetchQuizzes();

        toast({
            title: 'Quiz completed!',
            description: `You scored ${results.filter(r => r.isCorrect).length}/${results.length}`,
        });
    };

    const handleRetakeQuiz = () => {
        setPageView('playing');
    };

    const handleBackToList = () => {
        setPageView('list');
        setSelectedQuiz(null);
        setCurrentQuestions([]);
        setAttemptHistory([]);
        // Clear query param
        router.replace('/app/quiz', { scroll: false });
    };

    const handleBackToDetail = () => {
        if (selectedQuiz) {
            handleQuizSelect(selectedQuiz);
        }
    };

    // ========================================================================
    // Filtering
    // ========================================================================

    const filteredQuizzes = useMemo(() => {
        if (!searchQuery.trim()) return quizzes;
        const q = searchQuery.toLowerCase();
        return quizzes.filter(
            quiz =>
                quiz.topic.toLowerCase().includes(q) ||
                quiz.subject.toLowerCase().includes(q)
        );
    }, [quizzes, searchQuery]);

    // ========================================================================
    // Render: Loading
    // ========================================================================

    if (loading) {
        return (
            <div className="space-y-8">
                <PageHeader title="Quiz" description="Test your knowledge with AI-generated quizzes" />
                <LoadingSkeleton variant="card" count={3} />
            </div>
        );
    }

    // ========================================================================
    // Render: Quiz Playing
    // ========================================================================

    if (pageView === 'playing' && selectedQuiz && currentQuestions.length > 0) {
        return (
            <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">{selectedQuiz.topic}</h2>
                        <p className="text-sm text-muted-foreground">
                            {selectedQuiz.subject} • {selectedQuiz.difficulty}
                        </p>
                    </div>
                    <Button variant="outline" onClick={handleBackToDetail}>
                        Exit Quiz
                    </Button>
                </div>
                <QuizPlayer
                    questions={currentQuestions}
                    onComplete={handleQuizComplete}
                />
            </div>
        );
    }

    // ========================================================================
    // Render: Quiz Complete
    // ========================================================================

    if (pageView === 'complete' && selectedQuiz) {
        return (
            <div className="max-w-lg mx-auto text-center space-y-6 animate-fade-in py-12">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                    <Trophy className="h-10 w-10 text-indigo-500" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Quiz Complete!</h2>
                    <p className="text-muted-foreground mt-1">{selectedQuiz.topic}</p>
                </div>
                <div className="flex gap-3 justify-center">
                    <Button onClick={handleRetakeQuiz} variant="outline" className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Retake Quiz
                    </Button>
                    <Button onClick={handleBackToDetail} className="gap-2">
                        <BarChart3 className="h-4 w-4" />
                        View History
                    </Button>
                </div>
                <Button variant="ghost" onClick={handleBackToList} className="gap-2 text-muted-foreground">
                    <ChevronLeft className="h-4 w-4" />
                    Back to All Quizzes
                </Button>
            </div>
        );
    }

    // ========================================================================
    // Render: Quiz Detail (with history)
    // ========================================================================

    if (pageView === 'detail' && selectedQuiz) {
        return (
            <div className="space-y-6 animate-fade-in">
                {/* Back button */}
                <Button variant="ghost" onClick={handleBackToList} className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4" />
                    Back to Quizzes
                </Button>

                {/* Quiz Header Card */}
                <Card className="overflow-hidden border-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5">
                    <CardContent className="p-6 sm:p-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl sm:text-2xl font-bold">{selectedQuiz.topic}</h1>
                                    {selectedQuiz.is_new && (
                                        <Badge className="gap-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0">
                                            <Sparkles className="h-3 w-3" />
                                            NEW
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <span className="font-medium">{selectedQuiz.subject}</span>
                                    <span>•</span>
                                    <Badge variant="outline" className={getDifficultyColor(selectedQuiz.difficulty)}>
                                        {selectedQuiz.difficulty}
                                    </Badge>
                                    <span>•</span>
                                    <Badge variant="outline" className={getQuestionTypeColor(selectedQuiz.question_type)}>
                                        {getQuestionTypeLabel(selectedQuiz.question_type)}
                                    </Badge>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <FileText className="h-3.5 w-3.5" />
                                        {currentQuestions.length} questions
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Created {timeAgo(selectedQuiz.created_at)}
                                </p>
                            </div>
                            <Button
                                size="lg"
                                onClick={handleStartQuiz}
                                disabled={loadingDetail || currentQuestions.length === 0}
                                className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 shrink-0"
                            >
                                {loadingDetail ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : attemptHistory.length > 0 ? (
                                    <>
                                        <RotateCcw className="h-5 w-5" />
                                        Retake Quiz
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-5 w-5" />
                                        Start Quiz
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Attempt History */}
                {loadingDetail ? (
                    <LoadingSkeleton variant="card" count={2} />
                ) : attemptHistory.length > 0 ? (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <History className="h-5 w-5 text-muted-foreground" />
                            Attempt History
                        </h2>
                        <div className="grid gap-3">
                            {attemptHistory.map((group) => {
                                const pct = group.total > 0 ? Math.round((group.score / group.total) * 100) : 0;
                                return (
                                    <Card key={group.attempt_number} className="overflow-hidden transition-all hover:shadow-md">
                                        <CardContent className="p-4 sm:p-5">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${pct >= 80
                                                        ? 'bg-emerald-500/10 text-emerald-500'
                                                        : pct >= 50
                                                            ? 'bg-amber-500/10 text-amber-500'
                                                            : 'bg-rose-500/10 text-rose-500'
                                                        }`}>
                                                        {pct}%
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium">Attempt #{group.attempt_number}</p>
                                                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                            <span className="flex items-center gap-1">
                                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                                {group.score} correct
                                                            </span>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-1">
                                                                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                                                {group.total - group.score} wrong
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-xs text-muted-foreground">
                                                        {timeAgo(group.date)}
                                                    </p>
                                                </div>
                                            </div>
                                            <Progress
                                                value={pct}
                                                className="h-1.5 mt-3"
                                            />
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <Card className="border-dashed">
                        <CardContent className="py-10 text-center text-muted-foreground">
                            <Target className="h-8 w-8 mx-auto mb-3 opacity-50" />
                            <p className="font-medium">No attempts yet</p>
                            <p className="text-sm mt-1">Start the quiz to see your results here</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    // ========================================================================
    // Render: Quiz List (main view)
    // ========================================================================

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title="Quiz"
                description="Test your knowledge with AI-generated quizzes"
            />

            {quizzes.length === 0 ? (
                <EmptyState
                    icon={BookOpen}
                    title="No quizzes yet"
                    description="Upload a file on the Dashboard to generate your first quiz with AI"
                    action={{
                        label: 'Go to Dashboard',
                        href: '/app',
                    }}
                />
            ) : (
                <>
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search quizzes by topic or subject..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-muted/50 border-muted-foreground/10"
                        />
                    </div>

                    {/* Quiz Grid */}
                    {filteredQuizzes.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                            <p className="font-medium">No quizzes match your search</p>
                            <p className="text-sm mt-1">Try a different keyword</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredQuizzes.map((quiz) => (
                                <QuizCard
                                    key={quiz.id}
                                    quiz={quiz}
                                    onClick={() => handleQuizSelect(quiz)}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ============================================================================
// Quiz Card Component
// ============================================================================

function QuizCard({ quiz, onClick }: { quiz: QuizWithMeta; onClick: () => void }) {
    return (
        <Card
            className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 border-border/50 hover:border-indigo-500/30"
            onClick={onClick}
        >
            {/* Gradient accent top bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />

            <CardContent className="p-5">
                <div className="space-y-3">
                    {/* Title row with NEW badge */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                                <FileText className="h-4.5 w-4.5 text-indigo-500" />
                            </div>
                            <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                                {quiz.topic}
                            </h3>
                        </div>
                        {quiz.is_new && (
                            <Badge className="shrink-0 gap-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 text-[10px] px-2 py-0.5">
                                <Sparkles className="h-2.5 w-2.5" />
                                NEW
                            </Badge>
                        )}
                    </div>

                    {/* Subject, Difficulty, and Question Type */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-muted-foreground">{quiz.subject}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getDifficultyColor(quiz.difficulty)}`}>
                            {quiz.difficulty}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getQuestionTypeColor(quiz.question_type)}`}>
                            {getQuestionTypeLabel(quiz.question_type)}
                        </Badge>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {quiz.question_count} Q
                            </span>
                            {quiz.attempt_count > 0 && (
                                <span className="flex items-center gap-1">
                                    <History className="h-3 w-3" />
                                    {quiz.attempt_count} attempts
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {quiz.best_score !== null && (
                                <span className={`text-xs font-semibold ${quiz.best_score >= 80 ? 'text-emerald-500' :
                                    quiz.best_score >= 50 ? 'text-amber-500' : 'text-rose-500'
                                    }`}>
                                    {quiz.best_score}%
                                </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                                {timeAgo(quiz.created_at)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Hover play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 transform scale-75 group-hover:scale-100 transition-transform duration-300">
                        <Play className="h-5 w-5 ml-0.5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
