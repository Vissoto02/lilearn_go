'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { TopicPicker } from '@/components/app/topic-picker';
import { QuizPlayer, QuizResult } from '@/components/app/quiz-player';
import { EmptyState } from '@/components/app/empty-state';
import { LoadingSkeleton } from '@/components/app/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { Topic, Quiz, QuizQuestion, Difficulty } from '@/lib/types';
import { generateQuiz, hashAnswer } from '@/lib/quiz-generator';
import {
    Play,
    BookOpen,
    Loader2,
    History,
    ChevronRight,
} from 'lucide-react';

type QuizState = 'setup' | 'playing' | 'complete';

export default function QuizPage() {
    const { toast } = useToast();
    const [topics, setTopics] = useState<Topic[]>([]);
    const [pastQuizzes, setPastQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // Quiz setup state
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('');
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>('medium');

    // Quiz playing state
    const [quizState, setQuizState] = useState<QuizState>('setup');
    const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
    const [currentQuestions, setCurrentQuestions] = useState<QuizQuestion[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const supabase = createClient();

        const [{ data: topicsData }, { data: quizzesData }] = await Promise.all([
            supabase.from('topics').select('*').order('subject'),
            supabase.from('quizzes').select('*').order('created_at', { ascending: false }).limit(5),
        ]);

        if (topicsData) setTopics(topicsData);
        if (quizzesData) setPastQuizzes(quizzesData);
        setLoading(false);
    };

    const handleGenerateQuiz = async () => {
        if (!selectedSubject || !selectedTopic) {
            toast({
                title: 'Select topic',
                description: 'Please select a subject and topic first',
                variant: 'destructive',
            });
            return;
        }

        setGenerating(true);

        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Generate questions using mock generator
            const generatedQuestions = await generateQuiz(
                selectedSubject,
                selectedTopic,
                selectedDifficulty as Difficulty,
                5
            );

            // Create quiz record
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .insert({
                    user_id: user.id,
                    subject: selectedSubject,
                    topic: selectedTopic,
                    difficulty: selectedDifficulty,
                })
                .select()
                .single();

            if (quizError || !quiz) {
                throw new Error('Failed to create quiz');
            }

            // Create question records
            const questionsToInsert = generatedQuestions.map((q) => ({
                quiz_id: quiz.id,
                type: q.type,
                prompt: q.prompt,
                choices: q.choices,
                answer_hash: hashAnswer(q.correctAnswer),
                hint: q.hint,
            }));

            const { data: questions, error: questionsError } = await supabase
                .from('quiz_questions')
                .insert(questionsToInsert)
                .select();

            if (questionsError || !questions) {
                throw new Error('Failed to create questions');
            }

            setCurrentQuiz(quiz);
            setCurrentQuestions(questions);
            setQuizState('playing');

            toast({
                title: 'Quiz generated!',
                description: `${questions.length} questions ready`,
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to generate quiz',
                variant: 'destructive',
            });
        } finally {
            setGenerating(false);
        }
    };

    const handleQuizComplete = async (results: QuizResult[]) => {
        if (!currentQuiz) return;

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Record all attempts
        const attempts = results.map((r) => ({
            user_id: user.id,
            quiz_id: currentQuiz.id,
            question_id: r.questionId,
            is_correct: r.isCorrect,
            attempts_count: r.attempts,
            time_spent_sec: r.timeSpentSec,
        }));

        await supabase.from('quiz_attempts').insert(attempts);

        setQuizState('complete');
        fetchData(); // Refresh past quizzes
    };

    const handleAnswerSubmit = async (
        questionId: string,
        isCorrect: boolean,
        attempts: number
    ) => {
        // Individual answer tracking if needed
    };

    const resetQuiz = () => {
        setQuizState('setup');
        setCurrentQuiz(null);
        setCurrentQuestions([]);
    };

    if (loading) {
        return (
            <div className="space-y-8">
                <PageHeader title="Quiz" description="Generate practice quizzes" />
                <LoadingSkeleton variant="card" count={2} />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="Quiz"
                description="Test your knowledge with AI-generated quizzes"
            />

            {quizState === 'setup' && (
                <>
                    {topics.length === 0 ? (
                        <EmptyState
                            icon={BookOpen}
                            title="No topics yet"
                            description="Add some topics first to generate quizzes"
                            action={{
                                label: 'Add Topics',
                                onClick: () => window.location.href = '/app/upload',
                            }}
                        />
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>Generate New Quiz</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <TopicPicker
                                    topics={topics}
                                    selectedSubject={selectedSubject}
                                    selectedTopic={selectedTopic}
                                    onSubjectChange={setSelectedSubject}
                                    onTopicChange={setSelectedTopic}
                                    showDifficulty
                                    selectedDifficulty={selectedDifficulty}
                                    onDifficultyChange={setSelectedDifficulty}
                                />
                                <Button
                                    onClick={handleGenerateQuiz}
                                    disabled={generating || !selectedSubject || !selectedTopic}
                                    size="lg"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="mr-2 h-4 w-4" />
                                            Start Quiz
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Past Quizzes */}
                    {pastQuizzes.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <History className="h-5 w-5" />
                                    Recent Quizzes
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {pastQuizzes.map((quiz) => (
                                        <div
                                            key={quiz.id}
                                            className="flex items-center justify-between rounded-lg border border-border p-3"
                                        >
                                            <div>
                                                <p className="font-medium">{quiz.topic}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {quiz.subject} • {new Date(quiz.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <Badge variant="outline">{quiz.difficulty}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {quizState === 'playing' && currentQuestions.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">
                                {currentQuiz?.topic}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {currentQuiz?.subject} • {currentQuiz?.difficulty}
                            </p>
                        </div>
                        <Button variant="outline" onClick={resetQuiz}>
                            Exit Quiz
                        </Button>
                    </div>
                    <QuizPlayer
                        questions={currentQuestions}
                        onComplete={handleQuizComplete}
                        onAnswerSubmit={handleAnswerSubmit}
                    />
                </div>
            )}

            {quizState === 'complete' && (
                <div className="text-center space-y-4">
                    <Button onClick={resetQuiz} size="lg">
                        Take Another Quiz
                        <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
