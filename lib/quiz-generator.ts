// Mock Quiz Generator
// Generates quiz questions for a given topic
// This is a mock implementation that can be swapped with real AI (e.g., OpenAI) later

import { QuizQuestion, QuizChoice, Difficulty, QuestionType } from './types';
import crypto from 'crypto';

export interface GeneratedQuestion {
    type: QuestionType;
    prompt: string;
    choices: QuizChoice[] | null;
    correctAnswer: string; // Will be hashed before storing
    hint: string;
}

/**
 * Hash the correct answer for secure storage
 */
export function hashAnswer(answer: string): string {
    return crypto.createHash('sha256')
        .update(answer.toLowerCase().trim())
        .digest('hex')
        .substring(0, 16);
}

/**
 * Verify if a user's answer matches the hashed correct answer
 */
export function verifyAnswer(userAnswer: string, answerHash: string): boolean {
    return hashAnswer(userAnswer) === answerHash;
}

/**
 * Generate quiz questions for a topic
 * This is a MOCK implementation - replace with real AI API later
 */
export async function generateQuiz(
    subject: string,
    topic: string,
    difficulty: Difficulty,
    questionCount: number = 5
): Promise<GeneratedQuestion[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get mock questions for common topics
    const questions = getMockQuestions(subject, topic, difficulty);

    // Shuffle and return requested count
    const shuffled = questions.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(questionCount, shuffled.length));
}

/**
 * Mock question bank - replace with AI generation
 */
function getMockQuestions(
    subject: string,
    topic: string,
    difficulty: Difficulty
): GeneratedQuestion[] {
    const questionBanks: Record<string, GeneratedQuestion[]> = {
        'Mathematics::Algebra': [
            {
                type: 'mcq',
                prompt: 'Solve for x: 2x + 6 = 14',
                choices: [
                    { label: 'A', text: '4' },
                    { label: 'B', text: '5' },
                    { label: 'C', text: '6' },
                    { label: 'D', text: '8' },
                ],
                correctAnswer: 'a',
                hint: 'Subtract 6 from both sides, then divide by 2',
            },
            {
                type: 'mcq',
                prompt: 'What is the value of 3x - 5 when x = 7?',
                choices: [
                    { label: 'A', text: '14' },
                    { label: 'B', text: '16' },
                    { label: 'C', text: '18' },
                    { label: 'D', text: '21' },
                ],
                correctAnswer: 'b',
                hint: 'Substitute x = 7 into the expression',
            },
            {
                type: 'mcq',
                prompt: 'Simplify: 5(2x - 3) + 4x',
                choices: [
                    { label: 'A', text: '14x - 15' },
                    { label: 'B', text: '14x - 3' },
                    { label: 'C', text: '10x - 15' },
                    { label: 'D', text: '6x - 15' },
                ],
                correctAnswer: 'a',
                hint: 'First distribute the 5, then combine like terms',
            },
            {
                type: 'short_answer',
                prompt: 'If 4x = 24, what is x?',
                choices: null,
                correctAnswer: '6',
                hint: 'Divide both sides by 4',
            },
            {
                type: 'short_answer',
                prompt: 'What is the slope of the line y = 3x + 2?',
                choices: null,
                correctAnswer: '3',
                hint: 'In y = mx + b form, m is the slope',
            },
        ],
        'Mathematics::Calculus': [
            {
                type: 'mcq',
                prompt: 'What is the derivative of x²?',
                choices: [
                    { label: 'A', text: 'x' },
                    { label: 'B', text: '2x' },
                    { label: 'C', text: '2x²' },
                    { label: 'D', text: 'x²' },
                ],
                correctAnswer: 'b',
                hint: 'Use the power rule: d/dx(xⁿ) = nxⁿ⁻¹',
            },
            {
                type: 'mcq',
                prompt: 'What is ∫2x dx?',
                choices: [
                    { label: 'A', text: 'x² + C' },
                    { label: 'B', text: '2x² + C' },
                    { label: 'C', text: 'x + C' },
                    { label: 'D', text: '2 + C' },
                ],
                correctAnswer: 'a',
                hint: 'The integral of xⁿ is xⁿ⁺¹/(n+1) + C',
            },
            {
                type: 'short_answer',
                prompt: 'What is the derivative of 5x³?',
                choices: null,
                correctAnswer: '15x²',
                hint: 'Apply the power rule and multiply by the coefficient',
            },
        ],
        'Physics::Mechanics': [
            {
                type: 'mcq',
                prompt: "According to Newton's second law, F = ?",
                choices: [
                    { label: 'A', text: 'mv' },
                    { label: 'B', text: 'ma' },
                    { label: 'C', text: 'mg' },
                    { label: 'D', text: 'mv²' },
                ],
                correctAnswer: 'b',
                hint: 'Force equals mass times acceleration',
            },
            {
                type: 'mcq',
                prompt: 'What is the unit of force in SI?',
                choices: [
                    { label: 'A', text: 'Joule' },
                    { label: 'B', text: 'Watt' },
                    { label: 'C', text: 'Newton' },
                    { label: 'D', text: 'Pascal' },
                ],
                correctAnswer: 'c',
                hint: 'Named after Sir Isaac Newton',
            },
            {
                type: 'short_answer',
                prompt: 'What is the acceleration due to gravity on Earth (in m/s²)?',
                choices: null,
                correctAnswer: '9.8',
                hint: 'Approximately 10 m/s²',
            },
        ],
        'Computer Science::Data Structures': [
            {
                type: 'mcq',
                prompt: 'What is the time complexity of binary search?',
                choices: [
                    { label: 'A', text: 'O(1)' },
                    { label: 'B', text: 'O(n)' },
                    { label: 'C', text: 'O(log n)' },
                    { label: 'D', text: 'O(n²)' },
                ],
                correctAnswer: 'c',
                hint: 'The search space is halved with each comparison',
            },
            {
                type: 'mcq',
                prompt: 'Which data structure uses LIFO (Last In First Out)?',
                choices: [
                    { label: 'A', text: 'Queue' },
                    { label: 'B', text: 'Stack' },
                    { label: 'C', text: 'Array' },
                    { label: 'D', text: 'Linked List' },
                ],
                correctAnswer: 'b',
                hint: 'Think of a stack of plates',
            },
            {
                type: 'short_answer',
                prompt: 'What data structure uses FIFO (First In First Out)?',
                choices: null,
                correctAnswer: 'queue',
                hint: 'Like a line of people waiting',
            },
        ],
        'Computer Science::Algorithms': [
            {
                type: 'mcq',
                prompt: 'What is the worst-case time complexity of quicksort?',
                choices: [
                    { label: 'A', text: 'O(n log n)' },
                    { label: 'B', text: 'O(n²)' },
                    { label: 'C', text: 'O(n)' },
                    { label: 'D', text: 'O(log n)' },
                ],
                correctAnswer: 'b',
                hint: 'Occurs when the pivot is always the smallest or largest element',
            },
            {
                type: 'mcq',
                prompt: 'Which sorting algorithm is stable and has O(n log n) complexity?',
                choices: [
                    { label: 'A', text: 'Quicksort' },
                    { label: 'B', text: 'Heapsort' },
                    { label: 'C', text: 'Mergesort' },
                    { label: 'D', text: 'Selection sort' },
                ],
                correctAnswer: 'c',
                hint: 'Uses divide and conquer with merging',
            },
        ],
    };

    const key = `${subject}::${topic}`;
    let questions = questionBanks[key] || [];

    // If no specific questions, generate generic ones
    if (questions.length === 0) {
        questions = generateGenericQuestions(subject, topic, difficulty);
    }

    // Adjust difficulty by modifying hints
    return questions.map(q => ({
        ...q,
        hint: difficulty === 'easy' ? q.hint :
            difficulty === 'hard' ? 'Think carefully about this one!' :
                q.hint,
    }));
}

/**
 * Generate generic questions for topics without specific question banks
 */
function generateGenericQuestions(
    subject: string,
    topic: string,
    difficulty: Difficulty
): GeneratedQuestion[] {
    return [
        {
            type: 'mcq',
            prompt: `What is a key concept in ${topic}?`,
            choices: [
                { label: 'A', text: 'Understanding fundamentals' },
                { label: 'B', text: 'Memorizing without context' },
                { label: 'C', text: 'Skipping basics' },
                { label: 'D', text: 'None of the above' },
            ],
            correctAnswer: 'a',
            hint: `Focus on the core principles of ${topic}`,
        },
        {
            type: 'mcq',
            prompt: `Which approach is best for learning ${topic}?`,
            choices: [
                { label: 'A', text: 'Practice regularly' },
                { label: 'B', text: 'Cram before exams' },
                { label: 'C', text: 'Skip difficult parts' },
                { label: 'D', text: 'Only read theory' },
            ],
            correctAnswer: 'a',
            hint: 'Consistent practice leads to mastery',
        },
        {
            type: 'short_answer',
            prompt: `Name one important topic within ${subject} related to ${topic}.`,
            choices: null,
            correctAnswer: topic.toLowerCase(),
            hint: `Think about what you're currently studying`,
        },
    ];
}
