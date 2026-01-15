// Weakness Calculator
// Compute topic weakness scores from quiz attempts

import { QuizAttempt, TopicWeakness, Quiz } from './types';

interface AttemptWithQuiz extends QuizAttempt {
    quiz?: Quiz;
}

/**
 * Calculate weakness scores for each topic based on quiz attempts
 * Returns topics sorted by weakness (lowest accuracy first)
 */
export function calculateWeakness(
    attempts: AttemptWithQuiz[],
    quizzes: Quiz[]
): TopicWeakness[] {
    // Create quiz lookup map
    const quizMap = new Map<string, Quiz>();
    for (const quiz of quizzes) {
        quizMap.set(quiz.id, quiz);
    }

    // Group attempts by subject+topic
    const topicStats = new Map<string, { correct: number; total: number }>();

    for (const attempt of attempts) {
        const quiz = attempt.quiz || quizMap.get(attempt.quiz_id);
        if (!quiz) continue;

        const key = `${quiz.subject}::${quiz.topic}`;
        const stats = topicStats.get(key) || { correct: 0, total: 0 };

        stats.total++;
        if (attempt.is_correct) {
            stats.correct++;
        }

        topicStats.set(key, stats);
    }

    // Convert to TopicWeakness array
    const weaknesses: TopicWeakness[] = [];

    for (const [key, stats] of topicStats) {
        const [subject, topic] = key.split('::');
        const accuracy = stats.total > 0
            ? Math.round((stats.correct / stats.total) * 100)
            : 0;

        weaknesses.push({
            subject,
            topic,
            accuracy,
            totalAttempts: stats.total,
            correctAttempts: stats.correct,
        });
    }

    // Sort by accuracy (lowest first = weakest)
    return weaknesses.sort((a, b) => a.accuracy - b.accuracy);
}

/**
 * Get the top N weakest topics
 */
export function getWeakestTopics(
    attempts: AttemptWithQuiz[],
    quizzes: Quiz[],
    limit: number = 3
): TopicWeakness[] {
    return calculateWeakness(attempts, quizzes).slice(0, limit);
}

/**
 * Get overall accuracy across all topics
 */
export function getOverallAccuracy(attempts: QuizAttempt[]): number {
    if (attempts.length === 0) return 0;

    const correct = attempts.filter(a => a.is_correct).length;
    return Math.round((correct / attempts.length) * 100);
}

/**
 * Get accuracy for a specific topic
 */
export function getTopicAccuracy(
    attempts: AttemptWithQuiz[],
    quizzes: Quiz[],
    subject: string,
    topic: string
): number {
    const quizMap = new Map<string, Quiz>();
    for (const quiz of quizzes) {
        quizMap.set(quiz.id, quiz);
    }

    const topicAttempts = attempts.filter(a => {
        const quiz = a.quiz || quizMap.get(a.quiz_id);
        return quiz?.subject === subject && quiz?.topic === topic;
    });

    return getOverallAccuracy(topicAttempts);
}

/**
 * Calculate study priority score for a topic
 * Higher score = should study more
 * Factors: low accuracy, recency of attempts, number of attempts
 */
export function calculateStudyPriority(
    weakness: TopicWeakness,
    lastAttemptDate?: string
): number {
    // Base score from weakness (inverted accuracy)
    let score = 100 - weakness.accuracy;

    // Boost for topics with fewer attempts (need more practice)
    if (weakness.totalAttempts < 5) {
        score += 20;
    } else if (weakness.totalAttempts < 10) {
        score += 10;
    }

    // Boost for topics not practiced recently
    if (lastAttemptDate) {
        const daysSince = Math.floor(
            (Date.now() - new Date(lastAttemptDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince > 7) {
            score += 15;
        } else if (daysSince > 3) {
            score += 8;
        }
    }

    return Math.min(score, 100);
}
