import { describe, it, expect } from 'vitest';
import {
    calculateWeakness,
    getWeakestTopics,
    getOverallAccuracy,
} from '../weakness-calculator';
import { QuizAttempt, Quiz } from '../types';

// Helper to create a quiz
function createQuiz(subject: string, topic: string): Quiz {
    return {
        id: `quiz-${subject}-${topic}`,
        user_id: 'test-user',
        subject,
        topic,
        difficulty: 'medium',
        created_at: new Date().toISOString(),
    };
}

// Helper to create an attempt
function createAttempt(
    quizId: string,
    isCorrect: boolean
): QuizAttempt {
    return {
        id: `attempt-${Math.random()}`,
        user_id: 'test-user',
        quiz_id: quizId,
        question_id: 'q1',
        is_correct: isCorrect,
        attempts_count: 1,
        time_spent_sec: 30,
        created_at: new Date().toISOString(),
    };
}

describe('calculateWeakness', () => {
    it('returns empty array for no attempts', () => {
        const result = calculateWeakness([], []);
        expect(result).toEqual([]);
    });

    it('calculates accuracy correctly for single topic', () => {
        const quizzes = [createQuiz('Math', 'Algebra')];
        const attempts = [
            createAttempt(quizzes[0].id, true),
            createAttempt(quizzes[0].id, true),
            createAttempt(quizzes[0].id, false),
            createAttempt(quizzes[0].id, true),
        ];

        const result = calculateWeakness(attempts, quizzes);

        expect(result).toHaveLength(1);
        expect(result[0].subject).toBe('Math');
        expect(result[0].topic).toBe('Algebra');
        expect(result[0].accuracy).toBe(75); // 3 out of 4
        expect(result[0].totalAttempts).toBe(4);
        expect(result[0].correctAttempts).toBe(3);
    });

    it('sorts topics by weakness (lowest accuracy first)', () => {
        const quizzes = [
            createQuiz('Math', 'Algebra'),
            createQuiz('Math', 'Calculus'),
            createQuiz('Physics', 'Mechanics'),
        ];

        const attempts = [
            // Algebra: 1/4 = 25%
            createAttempt(quizzes[0].id, false),
            createAttempt(quizzes[0].id, false),
            createAttempt(quizzes[0].id, false),
            createAttempt(quizzes[0].id, true),
            // Calculus: 3/4 = 75%
            createAttempt(quizzes[1].id, true),
            createAttempt(quizzes[1].id, true),
            createAttempt(quizzes[1].id, true),
            createAttempt(quizzes[1].id, false),
            // Mechanics: 2/4 = 50%
            createAttempt(quizzes[2].id, true),
            createAttempt(quizzes[2].id, true),
            createAttempt(quizzes[2].id, false),
            createAttempt(quizzes[2].id, false),
        ];

        const result = calculateWeakness(attempts, quizzes);

        expect(result).toHaveLength(3);
        expect(result[0].topic).toBe('Algebra');
        expect(result[0].accuracy).toBe(25);
        expect(result[1].topic).toBe('Mechanics');
        expect(result[1].accuracy).toBe(50);
        expect(result[2].topic).toBe('Calculus');
        expect(result[2].accuracy).toBe(75);
    });
});

describe('getWeakestTopics', () => {
    it('returns top N weakest topics', () => {
        const quizzes = [
            createQuiz('Math', 'Algebra'),
            createQuiz('Math', 'Calculus'),
            createQuiz('Physics', 'Mechanics'),
            createQuiz('CS', 'Algorithms'),
        ];

        const attempts = [
            createAttempt(quizzes[0].id, false), // Algebra: 0%
            createAttempt(quizzes[1].id, true),  // Calculus: 100%
            createAttempt(quizzes[2].id, true),  // Mechanics: 50%
            createAttempt(quizzes[2].id, false),
            createAttempt(quizzes[3].id, false), // Algorithms: 33%
            createAttempt(quizzes[3].id, false),
            createAttempt(quizzes[3].id, true),
        ];

        const result = getWeakestTopics(attempts, quizzes, 2);

        expect(result).toHaveLength(2);
        expect(result[0].topic).toBe('Algebra');
        expect(result[1].topic).toBe('Algorithms');
    });
});

describe('getOverallAccuracy', () => {
    it('returns 0 for empty attempts', () => {
        expect(getOverallAccuracy([])).toBe(0);
    });

    it('calculates overall accuracy correctly', () => {
        const attempts: QuizAttempt[] = [
            createAttempt('q1', true),
            createAttempt('q1', true),
            createAttempt('q1', false),
            createAttempt('q1', true),
            createAttempt('q1', false),
        ];

        expect(getOverallAccuracy(attempts)).toBe(60); // 3 out of 5
    });

    it('returns 100 when all correct', () => {
        const attempts: QuizAttempt[] = [
            createAttempt('q1', true),
            createAttempt('q1', true),
            createAttempt('q1', true),
        ];

        expect(getOverallAccuracy(attempts)).toBe(100);
    });

    it('returns 0 when all incorrect', () => {
        const attempts: QuizAttempt[] = [
            createAttempt('q1', false),
            createAttempt('q1', false),
        ];

        expect(getOverallAccuracy(attempts)).toBe(0);
    });
});
