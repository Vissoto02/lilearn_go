'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { QuizQuestion, QuizChoice } from '@/lib/types';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    CheckCircle2,
    XCircle,
    HelpCircle,
    ArrowRight,
    RotateCcw,
    Trophy,
} from 'lucide-react';

interface QuizPlayerProps {
    questions: QuizQuestion[];
    onComplete: (results: QuizResult[]) => void;
    onAnswerSubmit?: (questionId: string, isCorrect: boolean, attempts: number) => void;
    className?: string;
}

export interface QuizResult {
    questionId: string;
    isCorrect: boolean;
    attempts: number;
    timeSpentSec: number;
}

type AnswerState = 'idle' | 'correct' | 'incorrect';

export function QuizPlayer({
    questions,
    onComplete,
    onAnswerSubmit,
    className,
}: QuizPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string>('');
    const [answerState, setAnswerState] = useState<AnswerState>('idle');
    const [showHint, setShowHint] = useState(false);
    const [attempts, setAttempts] = useState(1);
    const [results, setResults] = useState<QuizResult[]>([]);
    const [startTime, setStartTime] = useState(Date.now());
    const [quizComplete, setQuizComplete] = useState(false);

    const currentQuestion = questions[currentIndex];
    const progress = ((currentIndex + 1) / questions.length) * 100;
    const isMCQ = currentQuestion?.type === 'mcq';

    // Helper: Normalize choices to standard format
    // Supports both new format: ["text A", "text B", ...] and legacy: [{label: "A", text: "..."}, ...]
    const getNormalizedChoices = (choices: string[] | QuizChoice[] | null): QuizChoice[] => {
        if (!choices || choices.length === 0) return [];

        // Check if it's already in QuizChoice format
        if (typeof choices[0] === 'object' && 'label' in choices[0]) {
            return choices as QuizChoice[];
        }

        // Convert string[] to QuizChoice[]
        return (choices as string[]).map((text, idx) => ({
            label: ['A', 'B', 'C', 'D'][idx] || String.fromCharCode(65 + idx),
            text: text
        }));
    };


    // Reset state when moving to next question
    useEffect(() => {
        setSelectedAnswer('');
        setAnswerState('idle');
        setShowHint(false);
        setAttempts(1);
        setStartTime(Date.now());
    }, [currentIndex]);

    const handleAnswerSelect = (answer: string) => {
        if (answerState !== 'idle') return;
        setSelectedAnswer(answer);
    };

    const handleSubmit = () => {
        if (!selectedAnswer.trim() || !currentQuestion) return;

        // Compare answer: support both plain label ("a"/"b"/"c"/"d") and correct_label ("A"/"B"/"C"/"D")
        const userAnswer = selectedAnswer.toLowerCase().trim();
        const correctHash = (currentQuestion.answer_hash || '').toLowerCase().trim();
        const correctLabel = (currentQuestion.correct_label || '').toLowerCase().trim();
        const isCorrect = userAnswer === correctHash || userAnswer === correctLabel;

        if (isCorrect) {
            setAnswerState('correct');

            // Record result
            const timeSpent = Math.round((Date.now() - startTime) / 1000);
            const result: QuizResult = {
                questionId: currentQuestion.id,
                isCorrect: true,
                attempts,
                timeSpentSec: timeSpent,
            };
            setResults((prev) => [...prev, result]);

            onAnswerSubmit?.(currentQuestion.id, true, attempts);
        } else {
            setAnswerState('incorrect');
            setAttempts((prev) => prev + 1);

            // After 2 incorrect attempts, move on
            if (attempts >= 2) {
                const timeSpent = Math.round((Date.now() - startTime) / 1000);
                const result: QuizResult = {
                    questionId: currentQuestion.id,
                    isCorrect: false,
                    attempts,
                    timeSpentSec: timeSpent,
                };
                setResults((prev) => [...prev, result]);

                onAnswerSubmit?.(currentQuestion.id, false, attempts);
            }
        }
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
        } else {
            // Quiz complete
            setQuizComplete(true);
            onComplete(results);
        }
    };

    const handleTryAgain = () => {
        setSelectedAnswer('');
        setAnswerState('idle');
        setShowHint(true); // Show hint on retry
    };

    // Quiz complete screen
    if (quizComplete) {
        const correctCount = results.filter((r) => r.isCorrect).length;
        const accuracy = Math.round((correctCount / questions.length) * 100);

        return (
            <Card className={cn('text-center', className)}>
                <CardHeader>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <Trophy className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-h2">Quiz Complete!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-4xl font-bold text-primary">{accuracy}%</div>
                    <p className="text-muted-foreground">
                        You got {correctCount} out of {questions.length} questions correct
                    </p>
                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="rounded-lg bg-muted p-4">
                            <div className="text-2xl font-bold text-green-600">{correctCount}</div>
                            <div className="text-sm text-muted-foreground">Correct</div>
                        </div>
                        <div className="rounded-lg bg-muted p-4">
                            <div className="text-2xl font-bold text-red-600">
                                {questions.length - correctCount}
                            </div>
                            <div className="text-sm text-muted-foreground">Incorrect</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!currentQuestion) return null;

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <Badge variant="outline">
                        Question {currentIndex + 1} of {questions.length}
                    </Badge>
                    <Badge variant="secondary">
                        {currentQuestion.type === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
                    </Badge>
                </div>
                <Progress value={progress} className="mt-2" />
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Question */}
                <div className="text-lg font-medium">{currentQuestion.prompt}</div>

                {/* MCQ Options */}
                {isMCQ && currentQuestion.choices && (
                    <div className="space-y-2">
                        {getNormalizedChoices(currentQuestion.choices).map((choice: QuizChoice) => (
                            <button
                                key={choice.label}
                                onClick={() => handleAnswerSelect(choice.label.toLowerCase())}
                                disabled={answerState !== 'idle'}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors',
                                    'hover:border-primary/50 hover:bg-accent',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    selectedAnswer === choice.label.toLowerCase() &&
                                    answerState === 'idle' &&
                                    'border-primary bg-primary/5',
                                    selectedAnswer === choice.label.toLowerCase() &&
                                    answerState === 'correct' &&
                                    'border-green-500 bg-green-50 dark:bg-green-950',
                                    selectedAnswer === choice.label.toLowerCase() &&
                                    answerState === 'incorrect' &&
                                    'border-red-500 bg-red-50 dark:bg-red-950',
                                    answerState !== 'idle' &&
                                    selectedAnswer !== choice.label.toLowerCase() &&
                                    'opacity-50'
                                )}
                            >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current font-medium">
                                    {choice.label}
                                </span>
                                <span>{choice.text}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Short Answer Input */}
                {!isMCQ && (
                    <div className="space-y-2">
                        <Input
                            value={selectedAnswer}
                            onChange={(e) => setSelectedAnswer(e.target.value)}
                            placeholder="Type your answer..."
                            disabled={answerState !== 'idle'}
                            className={cn(
                                'text-lg',
                                answerState === 'correct' && 'border-green-500',
                                answerState === 'incorrect' && 'border-red-500'
                            )}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSubmit();
                                }
                            }}
                        />
                    </div>
                )}

                {/* Feedback */}
                {answerState === 'correct' && (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-700 dark:bg-green-950 dark:text-green-300">
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <span>Correct! Well done.</span>
                    </div>
                )}

                {answerState === 'incorrect' && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-950 dark:text-red-300">
                            <XCircle className="h-5 w-5 shrink-0" />
                            <span>
                                {attempts >= 2
                                    ? "That's not quite right. Let's move on."
                                    : 'Not quite. Try again!'}
                            </span>
                        </div>
                        {showHint && currentQuestion.hint && (
                            <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-4 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                <HelpCircle className="mt-0.5 h-5 w-5 shrink-0" />
                                <span>Hint: {currentQuestion.hint}</span>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            <CardFooter className="flex justify-between">
                {/* Hint button */}
                {answerState === 'idle' && currentQuestion.hint && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHint(!showHint)}
                    >
                        <HelpCircle className="mr-2 h-4 w-4" />
                        {showHint ? 'Hide Hint' : 'Show Hint'}
                    </Button>
                )}

                {/* Show hint when requested */}
                {showHint && answerState === 'idle' && currentQuestion.hint && (
                    <div className="flex-1 text-sm text-muted-foreground italic px-4">
                        {currentQuestion.hint}
                    </div>
                )}

                <div className="ml-auto flex gap-2">
                    {/* Submit button */}
                    {answerState === 'idle' && (
                        <Button onClick={handleSubmit} disabled={!selectedAnswer.trim()}>
                            Submit Answer
                        </Button>
                    )}

                    {/* Try Again button */}
                    {answerState === 'incorrect' && attempts < 2 && (
                        <Button variant="outline" onClick={handleTryAgain}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Try Again
                        </Button>
                    )}

                    {/* Next button */}
                    {(answerState === 'correct' || (answerState === 'incorrect' && attempts >= 2)) && (
                        <Button onClick={handleNext}>
                            {currentIndex < questions.length - 1 ? (
                                <>
                                    Next Question
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            ) : (
                                'Finish Quiz'
                            )}
                        </Button>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
}
