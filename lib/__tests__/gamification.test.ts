import { describe, it, expect } from 'vitest';
import {
    calculateTitle,
    calculateQuizPoints,
    calculateUploadPoints,
    isWeakSubject,
    checkPersonalBest,
    getSubjectAverageScore,
    POINTS,
    THRESHOLDS,
} from '../gamification';

// ============================================================================
// calculateTitle
// ============================================================================
describe('calculateTitle', () => {
    it('returns Amateur for 0 points', () => {
        expect(calculateTitle(0)).toBe('Amateur');
    });

    it('returns Amateur for 499 points', () => {
        expect(calculateTitle(499)).toBe('Amateur');
    });

    it('returns Scholar for exactly 500 points', () => {
        expect(calculateTitle(500)).toBe('Scholar');
    });

    it('returns Scholar for 1499 points', () => {
        expect(calculateTitle(1499)).toBe('Scholar');
    });

    it('returns Study Master for exactly 1500 points', () => {
        expect(calculateTitle(1500)).toBe('Study Master');
    });

    it('returns Study Master for very high points', () => {
        expect(calculateTitle(99999)).toBe('Study Master');
    });
});

// ============================================================================
// calculateQuizPoints
// ============================================================================
describe('calculateQuizPoints', () => {
    describe('standard subjects', () => {
        it('awards 50 points for passing (≥60%)', () => {
            const result = calculateQuizPoints(75, false, null);
            expect(result.points).toBe(POINTS.QUIZ_STANDARD_PASS);
            expect(result.passed).toBe(true);
        });

        it('awards 50 points for exactly 60%', () => {
            const result = calculateQuizPoints(60, false, null);
            expect(result.points).toBe(POINTS.QUIZ_STANDARD_PASS);
            expect(result.passed).toBe(true);
        });

        it('awards 0 points for failing (<60%)', () => {
            const result = calculateQuizPoints(59, false, null);
            expect(result.points).toBe(0);
            expect(result.passed).toBe(false);
        });
    });

    describe('weak subjects', () => {
        it('awards 100 points for mastery (≥80%)', () => {
            const result = calculateQuizPoints(85, true, null);
            expect(result.points).toBe(POINTS.QUIZ_WEAK_MASTERY);
            expect(result.passed).toBe(true);
        });

        it('awards 25 points for partial pass (60-79%)', () => {
            const result = calculateQuizPoints(70, true, null);
            expect(result.points).toBe(POINTS.QUIZ_WEAK_PARTIAL);
            expect(result.passed).toBe(false);
        });

        it('awards 0 points for failing weak subject (<60%)', () => {
            const result = calculateQuizPoints(40, true, null);
            expect(result.points).toBe(0);
            expect(result.passed).toBe(false);
        });
    });

    describe('personal best bonus', () => {
        it('awards +20 bonus for ≥10% improvement', () => {
            const result = calculateQuizPoints(80, false, 65);
            expect(result.bonusPoints).toBe(POINTS.PERSONAL_BEST_BONUS);
            expect(result.isPersonalBest).toBe(true);
            expect(result.points).toBe(POINTS.QUIZ_STANDARD_PASS + POINTS.PERSONAL_BEST_BONUS);
        });

        it('does not award bonus for <10% improvement', () => {
            const result = calculateQuizPoints(74, false, 70);
            expect(result.bonusPoints).toBe(0);
            expect(result.isPersonalBest).toBe(false);
        });

        it('treats first pass as personal best', () => {
            const result = calculateQuizPoints(80, false, null);
            expect(result.isPersonalBest).toBe(true);
        });
    });
});

// ============================================================================
// calculateUploadPoints
// ============================================================================
describe('calculateUploadPoints', () => {
    it('always returns 30', () => {
        expect(calculateUploadPoints()).toBe(30);
    });
});

// ============================================================================
// isWeakSubject
// ============================================================================
describe('isWeakSubject', () => {
    const quizzes = [
        { id: 'q1', subject: 'Math' },
        { id: 'q2', subject: 'Math' },
        { id: 'q3', subject: 'Science' },
    ];

    it('returns true when average score < 60%', () => {
        const attempts = [
            { quiz_id: 'q1', is_correct: true },
            { quiz_id: 'q1', is_correct: false },
            { quiz_id: 'q2', is_correct: false },
            { quiz_id: 'q2', is_correct: false },
            { quiz_id: 'q2', is_correct: false },
        ];
        // 1 correct out of 5 = 20%
        expect(isWeakSubject(attempts, quizzes, 'Math')).toBe(true);
    });

    it('returns false when average score ≥ 60%', () => {
        const attempts = [
            { quiz_id: 'q1', is_correct: true },
            { quiz_id: 'q1', is_correct: true },
            { quiz_id: 'q2', is_correct: true },
            { quiz_id: 'q2', is_correct: false },
            { quiz_id: 'q2', is_correct: true },
        ];
        // 4 correct out of 5 = 80%
        expect(isWeakSubject(attempts, quizzes, 'Math')).toBe(false);
    });

    it('returns false for a subject with no attempts', () => {
        expect(isWeakSubject([], quizzes, 'Math')).toBe(false);
    });

    it('only considers attempts for the target subject', () => {
        const attempts = [
            { quiz_id: 'q3', is_correct: false }, // Science
            { quiz_id: 'q3', is_correct: false }, // Science
        ];
        // No Math attempts → not weak
        expect(isWeakSubject(attempts, quizzes, 'Math')).toBe(false);
        // Science has 0% → weak
        expect(isWeakSubject(attempts, quizzes, 'Science')).toBe(true);
    });
});

// ============================================================================
// checkPersonalBest
// ============================================================================
describe('checkPersonalBest', () => {
    it('returns true if improvement ≥ 10%', () => {
        expect(checkPersonalBest(80, 65)).toBe(true);
    });

    it('returns false if improvement < 10%', () => {
        expect(checkPersonalBest(74, 70)).toBe(false);
    });

    it('returns true for first attempt (null previous)', () => {
        expect(checkPersonalBest(50, null)).toBe(true);
    });

    it('returns false for same score', () => {
        expect(checkPersonalBest(70, 70)).toBe(false);
    });
});

// ============================================================================
// getSubjectAverageScore
// ============================================================================
describe('getSubjectAverageScore', () => {
    const quizzes = [
        { id: 'q1', subject: 'Math' },
        { id: 'q2', subject: 'Math' },
    ];

    it('returns correct average', () => {
        const attempts = [
            { quiz_id: 'q1', is_correct: true },
            { quiz_id: 'q1', is_correct: true },
            { quiz_id: 'q2', is_correct: false },
            { quiz_id: 'q2', is_correct: true },
        ];
        // 3/4 = 75%
        expect(getSubjectAverageScore(attempts, quizzes, 'Math')).toBe(75);
    });

    it('returns 0 for no attempts', () => {
        expect(getSubjectAverageScore([], quizzes, 'Math')).toBe(0);
    });
});
