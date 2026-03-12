// Gamification Logic
// Pure utility functions for points, titles, and weak subject detection

import { UserTitle } from './types';

// ============================================================================
// Title Thresholds
// ============================================================================

const TITLE_THRESHOLDS: { min: number; title: UserTitle }[] = [
    { min: 1500, title: 'Study Master' },
    { min: 500, title: 'Scholar' },
    { min: 0, title: 'Amateur' },
];

/**
 * Determine the user's title based on total points
 */
export function calculateTitle(totalPoints: number): UserTitle {
    for (const threshold of TITLE_THRESHOLDS) {
        if (totalPoints >= threshold.min) {
            return threshold.title;
        }
    }
    return 'Amateur';
}

// ============================================================================
// Point Constants
// ============================================================================

export const POINTS = {
    QUIZ_STANDARD_PASS: 50,      // Standard quiz pass (≥ 60%)
    QUIZ_WEAK_MASTERY: 100,      // Weak subject mastery (≥ 80%)
    QUIZ_WEAK_PARTIAL: 25,       // Weak subject partial (< 80% but ≥ 60%) → 50% of standard
    QUIZ_FAIL: 0,                // Below threshold
    FILE_UPLOAD: 30,             // Valid file upload
    PERSONAL_BEST_BONUS: 20,    // Beat previous best by ≥ 10%
} as const;

export const THRESHOLDS = {
    STANDARD_PASS: 60,           // % needed to pass standard quiz
    WEAK_SUBJECT_PASS: 80,       // % needed for weak subject mastery
    WEAK_SUBJECT_FLAG: 60,       // Average score below this = weak subject
    PERSONAL_BEST_DELTA: 10,     // % improvement needed for personal best bonus
    MIN_NOTE_LENGTH: 50,         // Minimum characters for file upload note
} as const;

// ============================================================================
// Point Calculation
// ============================================================================

export interface QuizPointResult {
    points: number;
    passed: boolean;
    isPersonalBest: boolean;
    bonusPoints: number;
    message: string;
}

/**
 * Calculate points earned from a quiz validation
 */
export function calculateQuizPoints(
    scorePercent: number,
    isWeakSubject: boolean,
    previousBestScore: number | null
): QuizPointResult {
    let points = 0;
    let passed = false;
    let message = '';

    if (isWeakSubject) {
        if (scorePercent >= THRESHOLDS.WEAK_SUBJECT_PASS) {
            points = POINTS.QUIZ_WEAK_MASTERY;
            passed = true;
            message = `Excellent! You mastered a weak subject with ${scorePercent}%! 🎉`;
        } else if (scorePercent >= THRESHOLDS.STANDARD_PASS) {
            points = POINTS.QUIZ_WEAK_PARTIAL;
            passed = false;
            message = `You scored ${scorePercent}%, but weak subjects need ≥${THRESHOLDS.WEAK_SUBJECT_PASS}% to fully pass. Keep improving!`;
        } else {
            points = POINTS.QUIZ_FAIL;
            passed = false;
            message = `You need to focus more on this topic to improve your understanding.`;
        }
    } else {
        if (scorePercent >= THRESHOLDS.STANDARD_PASS) {
            points = POINTS.QUIZ_STANDARD_PASS;
            passed = true;
            message = `Great work! You passed with ${scorePercent}%! 🎯`;
        } else {
            points = POINTS.QUIZ_FAIL;
            passed = false;
            message = `You scored ${scorePercent}%. You need ≥${THRESHOLDS.STANDARD_PASS}% to earn points.`;
        }
    }

    // Check for personal best bonus
    let bonusPoints = 0;
    let isPersonalBest = false;

    if (previousBestScore !== null && scorePercent > previousBestScore) {
        const improvement = scorePercent - previousBestScore;
        if (improvement >= THRESHOLDS.PERSONAL_BEST_DELTA) {
            bonusPoints = POINTS.PERSONAL_BEST_BONUS;
            isPersonalBest = true;
            message += ` Personal Best! +${bonusPoints} bonus points! 🏆`;
        }
    } else if (previousBestScore === null && passed) {
        // First time taking this quiz and passed — that's a personal best
        isPersonalBest = true;
    }

    return {
        points: points + bonusPoints,
        passed,
        isPersonalBest,
        bonusPoints,
        message,
    };
}

/**
 * Calculate points for a file upload validation
 */
export function calculateUploadPoints(): number {
    return POINTS.FILE_UPLOAD;
}

// ============================================================================
// Weak Subject Detection
// ============================================================================

interface AttemptData {
    quiz_id: string;
    is_correct: boolean;
}

interface QuizData {
    id: string;
    subject: string;
}

/**
 * Check if a subject is "weak" based on average quiz performance
 * A subject is weak if the user's average score across all quizzes
 * for that subject is below 60%
 */
export function isWeakSubject(
    attempts: AttemptData[],
    quizzes: QuizData[],
    targetSubject: string
): boolean {
    // Build a set of quiz IDs that belong to this subject
    const subjectQuizIds = new Set(
        quizzes
            .filter(q => q.subject === targetSubject)
            .map(q => q.id)
    );

    // Filter attempts to only those for this subject's quizzes
    const subjectAttempts = attempts.filter(a => subjectQuizIds.has(a.quiz_id));

    if (subjectAttempts.length === 0) {
        // No data = not flagged as weak (give benefit of the doubt)
        return false;
    }

    const correctCount = subjectAttempts.filter(a => a.is_correct).length;
    const avgScore = (correctCount / subjectAttempts.length) * 100;

    return avgScore < THRESHOLDS.WEAK_SUBJECT_FLAG;
}

/**
 * Get the average score for a subject
 */
export function getSubjectAverageScore(
    attempts: AttemptData[],
    quizzes: QuizData[],
    targetSubject: string
): number {
    const subjectQuizIds = new Set(
        quizzes
            .filter(q => q.subject === targetSubject)
            .map(q => q.id)
    );

    const subjectAttempts = attempts.filter(a => subjectQuizIds.has(a.quiz_id));

    if (subjectAttempts.length === 0) return 0;

    const correctCount = subjectAttempts.filter(a => a.is_correct).length;
    return Math.round((correctCount / subjectAttempts.length) * 100);
}

/**
 * Check if a score is a personal best compared to previous best
 */
export function checkPersonalBest(
    currentScore: number,
    previousBest: number | null
): boolean {
    if (previousBest === null) return true; // First attempt is always a personal best
    return currentScore - previousBest >= THRESHOLDS.PERSONAL_BEST_DELTA;
}
