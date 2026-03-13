'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { LoadingSkeleton } from '@/components/app/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import {
    completeQuizValidation,
    completeFileValidation,
    skipSession,
} from '@/app/actions/revision';
import type { RevisionSession, Quiz, QuizQuestion } from '@/lib/types';
import { QuizPlayer, QuizResult } from '@/components/app/quiz-player';
import {
    Trophy,
    FileUp,
    BookOpen,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ArrowLeft,
    Loader2,
    Upload,
    Star,
    Zap,
    Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { THRESHOLDS } from '@/lib/gamification';

// ============================================================================
// Validation Page Content (wrapped in Suspense)
// ============================================================================

function ValidationContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();

    const sessionId = searchParams.get('sessionId');

    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<RevisionSession | null>(null);
    const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
    const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [quizRunKey, setQuizRunKey] = useState(0);
    const [usedRetry, setUsedRetry] = useState(false);
    const [firstAttemptScore, setFirstAttemptScore] = useState<number | null>(null);
    const [showRetryPrompt, setShowRetryPrompt] = useState(false);
    const [validating, setValidating] = useState(false);

    // File upload state
    const [uploading, setUploading] = useState(false);
    const [uploadNote, setUploadNote] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Result state
    const [result, setResult] = useState<{
        points: number;
        passed: boolean;
        isPersonalBest?: boolean;
        message: string;
        type: 'quiz' | 'upload';
    } | null>(null);

    useEffect(() => {
        if (!sessionId) {
            router.push('/app/revision');
            return;
        }

        fetchSessionData();
    }, [sessionId]);

    const fetchSessionData = async () => {
        if (!sessionId) return;

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get session
        const { data: sessionData } = await supabase
            .from('revision_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('user_id', user.id)
            .single();

        if (!sessionData) {
            toast({ title: 'Session not found', variant: 'destructive' });
            router.push('/app/revision');
            return;
        }

        setSession(sessionData as RevisionSession);

        // Get available quizzes for this subject/topic
        let quizQuery = supabase
            .from('quizzes')
            .select('*')
            .eq('user_id', user.id)
            .eq('subject', sessionData.subject);

        if (sessionData.topic) {
            quizQuery = quizQuery.eq('topic', sessionData.topic);
        }

        const { data: quizzes } = await quizQuery.order('created_at', { ascending: false });

        const quizList = (quizzes || []) as Quiz[];

        if (quizList.length > 0) {
            // Compute simple accuracy per quiz from all attempts and pick one with latest score < 80
            const quizIds = quizList.map((q) => q.id);
            const { data: attempts } = await supabase
                .from('quiz_attempts')
                .select('quiz_id,is_correct')
                .eq('user_id', user.id)
                .in('quiz_id', quizIds.length ? quizIds : ['__none__']);

            const statsByQuiz: Record<string, { correct: number; total: number }> = {};
            (attempts || []).forEach((a) => {
                if (!statsByQuiz[a.quiz_id]) {
                    statsByQuiz[a.quiz_id] = { correct: 0, total: 0 };
                }
                statsByQuiz[a.quiz_id].total += 1;
                if (a.is_correct) {
                    statsByQuiz[a.quiz_id].correct += 1;
                }
            });

            const candidates = quizList
                .map((q) => {
                    const stats = statsByQuiz[q.id];
                    const score =
                        stats && stats.total > 0
                            ? Math.round((stats.correct / stats.total) * 100)
                            : null;
                    return { quiz: q, score };
                })
                .filter((item) => item.score === null || item.score < 80);

            if (candidates.length > 0) {
                // Pick the most recently created candidate
                candidates.sort(
                    (a, b) =>
                        new Date(b.quiz.created_at).getTime() -
                        new Date(a.quiz.created_at).getTime()
                );
                setAvailableQuizzes([candidates[0].quiz]);
            } else {
                // No quiz below 80% – hide Path A
                setAvailableQuizzes([]);
            }
        } else {
            setAvailableQuizzes([]);
        }

        setLoading(false);
    };

    // Handle quiz start — play quiz inline inside Validation Hub
    const handleStartQuiz = async (quizId: string) => {
        if (!sessionId) return;
        const supabase = createClient();
        const { data: questions, error } = await supabase
            .from('quiz_questions')
            .select('*')
            .eq('quiz_id', quizId)
            .order('created_at', { ascending: true });

        if (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
            return;
        }

        if (!questions || questions.length === 0) {
            toast({
                title: 'No questions',
                description: 'This quiz has no questions yet.',
                variant: 'destructive',
            });
            return;
        }

        setActiveQuizId(quizId);
        setQuizQuestions(questions as QuizQuestion[]);
        setUsedRetry(false);
        setFirstAttemptScore(null);
        setShowRetryPrompt(false);
        setQuizRunKey((prev) => prev + 1);
    };

    const finalizeQuizValidation = async (quizId: string, scorePercent: number, retryUsed: boolean) => {
        if (!sessionId) return;
        setValidating(true);

        try {
            const res = await completeQuizValidation(sessionId, quizId, scorePercent, {
                usedRetry: retryUsed,
            });

            if (res.error) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
                return;
            }

            setResult({
                points: res.points,
                passed: res.passed,
                isPersonalBest: res.isPersonalBest,
                message: res.message,
                type: 'quiz',
            });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setValidating(false);
        }
    };

    const handleQuizComplete = async (results: QuizResult[]) => {
        if (!activeQuizId) return;

        const correctCount = results.filter((r) => r.isCorrect).length;
        const total = results.length || 1;
        const scorePercent = Math.round((correctCount / total) * 100);

        // First attempt below 80% → show retry prompt
        if (!usedRetry && scorePercent < 80) {
            setFirstAttemptScore(scorePercent);
            setShowRetryPrompt(true);
            return;
        }

        // Either first-attempt pass or retry attempt (with or without 80%)
        await finalizeQuizValidation(activeQuizId, scorePercent, usedRetry);
        setActiveQuizId(null);
        setQuizQuestions([]);
        setShowRetryPrompt(false);
    };

    // Handle file upload
    const handleFileUpload = async () => {
        if (!sessionId || !selectedFile) return;

        if (uploadNote.trim().length < THRESHOLDS.MIN_NOTE_LENGTH) {
            toast({
                title: 'Note too short',
                description: `Your study note must be at least ${THRESHOLDS.MIN_NOTE_LENGTH} characters.`,
                variant: 'destructive',
            });
            return;
        }

        setUploading(true);

        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Upload file to storage
            const fileExt = selectedFile.name.split('.').pop();
            const filePath = `${user.id}/revision/${sessionId}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(filePath, selectedFile, { upsert: true });

            if (uploadError) {
                toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
                return;
            }

            const res = await completeFileValidation(
                sessionId,
                filePath,
                selectedFile.name,
                selectedFile.size,
                uploadNote
            );

            if (res.error) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
                return;
            }

            setResult({
                points: res.points,
                passed: true,
                message: res.message,
                type: 'upload',
            });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setUploading(false);
        }
    };

    // Handle skip
    const handleSkip = async () => {
        if (!sessionId) return;
        await skipSession(sessionId);
        toast({ title: 'Session skipped', description: 'No points were awarded.' });
        router.push('/app/revision');
    };

    if (loading) {
        return <LoadingSkeleton variant="page" />;
    }

    if (!session) {
        return null;
    }

    // ---- SHOW RESULT ----
    if (result) {
        return (
            <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
                <Card className={cn(
                    "border-2 text-center",
                    result.passed
                        ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent"
                        : "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent"
                )}>
                    <CardContent className="p-8 space-y-6">
                        <div className={cn(
                            "p-4 rounded-full inline-block",
                            result.passed ? "bg-emerald-500/10" : "bg-amber-500/10"
                        )}>
                            {result.passed ? (
                                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                            ) : (
                                <XCircle className="h-12 w-12 text-amber-500" />
                            )}
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold">
                                {result.passed ? 'Session Complete!' : 'Keep Improving!'}
                            </h2>
                            <p className="text-muted-foreground mt-2">{result.message}</p>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-3xl font-bold">
                            <Trophy className="h-8 w-8 text-amber-500" />
                            <span>+{result.points}</span>
                            <span className="text-lg text-muted-foreground">pts</span>
                        </div>

                        {result.isPersonalBest && (
                            <Badge className="bg-gradient-to-r from-amber-500 to-rose-500 text-white border-0 px-4 py-1.5 text-sm">
                                <Star className="h-4 w-4 mr-1" />
                                Personal Best!
                            </Badge>
                        )}

                        <Button
                            size="lg"
                            onClick={() => router.push('/app/revision')}
                            className="w-full"
                        >
                            Back to Revision
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ---- SHOW VALIDATION OPTIONS ----
    const hasQuizzes = availableQuizzes.length > 0;

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            {/* Session Summary */}
            <Card className="bg-muted/30">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="font-semibold">{session.subject}</p>
                        {session.topic && <p className="text-sm text-muted-foreground">{session.topic}</p>}
                    </div>
                    {session.is_weak_subject && (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Weak Subject
                        </Badge>
                    )}
                </CardContent>
            </Card>

            {/* Path A: Quiz */}
            {hasQuizzes && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            Path A: Take a Quiz
                        </CardTitle>
                        <CardDescription>
                            Score ≥80% on this quiz to complete validation and earn full points. If you fail once, you'll get one retry with 5 extra minutes of study time; failing again rewards half points.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {availableQuizzes.map(quiz => (
                            <div
                                key={quiz.id}
                                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                            >
                                <div>
                                    <p className="font-medium">{quiz.topic}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-[10px]">{quiz.difficulty}</Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(quiz.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => handleStartQuiz(quiz.id)} className="gap-1.5">
                                    <Target className="h-4 w-4" />
                                    Take Quiz
                                </Button>
                            </div>
                        ))}

                        {activeQuizId && quizQuestions.length > 0 && (
                            <div className="pt-4">
                                <QuizPlayer
                                    key={quizRunKey}
                                    questions={quizQuestions}
                                    onComplete={handleQuizComplete}
                                />
                            </div>
                        )}

                        {showRetryPrompt && firstAttemptScore !== null && (
                            <div className="mt-4 space-y-3 rounded-lg border border-dashed p-4 bg-muted/40">
                                <p className="text-sm font-medium">
                                    You scored {firstAttemptScore}% on your first try.
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    You have unlocked one retry for this validation. We'll treat it as 5 extra minutes of study time.
                                    If you score at least 80% on the retry, you get full points. If not, the session will complete with half points.
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setUsedRetry(true);
                                            setShowRetryPrompt(false);
                                            setQuizRunKey((prev) => prev + 1);
                                        }}
                                    >
                                        Retry Quiz
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Path B: File Upload */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileUp className="h-5 w-5 text-emerald-500" />
                        {hasQuizzes ? 'Path B: Upload Study Material' : 'Upload Study Material'}
                    </CardTitle>
                    <CardDescription>
                        {hasQuizzes
                            ? 'Alternatively, upload your study notes or materials for 30 points.'
                            : 'No quiz available for this topic. Upload study materials to earn 30 points.'
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="file">Study Material (max 10MB)</Label>
                        <Input
                            id="file"
                            type="file"
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.pptx,.txt"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="note">Study Note (min {THRESHOLDS.MIN_NOTE_LENGTH} characters)</Label>
                        <Textarea
                            id="note"
                            placeholder="Describe what you studied, key takeaways, or summarize your notes..."
                            value={uploadNote}
                            onChange={(e) => setUploadNote(e.target.value)}
                            rows={4}
                        />
                        <p className={cn(
                            "text-xs",
                            uploadNote.trim().length >= THRESHOLDS.MIN_NOTE_LENGTH
                                ? "text-emerald-500"
                                : "text-muted-foreground"
                        )}>
                            {uploadNote.trim().length}/{THRESHOLDS.MIN_NOTE_LENGTH} characters
                        </p>
                    </div>
                    <Button
                        onClick={handleFileUpload}
                        disabled={!selectedFile || uploadNote.trim().length < THRESHOLDS.MIN_NOTE_LENGTH || uploading}
                        className="w-full gap-2"
                    >
                        {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="h-4 w-4" />
                        )}
                        {uploading ? 'Uploading...' : 'Upload & Earn 30 Points'}
                    </Button>
                </CardContent>
            </Card>

            {/* Skip */}
            <div className="text-center">
                <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
                    Skip validation — no points
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// Main Page (with Suspense for useSearchParams)
// ============================================================================

export default function ValidationPage() {
    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="Validation Hub"
                description="Validate your revision session to earn points"
            />
            <Suspense fallback={<LoadingSkeleton variant="page" />}>
                <ValidationContent />
            </Suspense>
        </div>
    );
}
