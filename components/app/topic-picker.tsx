'use client';

import { useState, useMemo } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Topic } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TopicPickerProps {
    topics: Topic[];
    selectedSubject?: string;
    selectedTopic?: string;
    onSubjectChange: (subject: string) => void;
    onTopicChange: (topic: string) => void;
    showDifficulty?: boolean;
    selectedDifficulty?: string;
    onDifficultyChange?: (difficulty: string) => void;
    className?: string;
}

export function TopicPicker({
    topics,
    selectedSubject,
    selectedTopic,
    onSubjectChange,
    onTopicChange,
    showDifficulty = false,
    selectedDifficulty,
    onDifficultyChange,
    className,
}: TopicPickerProps) {
    // Get unique subjects
    const subjects = useMemo(() => {
        const uniqueSubjects = new Set(topics.map((t) => t.subject));
        return Array.from(uniqueSubjects).sort();
    }, [topics]);

    // Get topics for selected subject
    const filteredTopics = useMemo(() => {
        if (!selectedSubject) return [];
        return topics
            .filter((t) => t.subject === selectedSubject)
            .map((t) => t.topic)
            .sort();
    }, [topics, selectedSubject]);

    const handleSubjectChange = (value: string) => {
        onSubjectChange(value);
        // Reset topic when subject changes
        onTopicChange('');
    };

    return (
        <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end', className)}>
            {/* Subject selector */}
            <div className="flex-1 space-y-2">
                <Label htmlFor="subject-select">Subject</Label>
                <Select value={selectedSubject} onValueChange={handleSubjectChange}>
                    <SelectTrigger id="subject-select" className="w-full">
                        <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                        {subjects.map((subject) => (
                            <SelectItem key={subject} value={subject}>
                                {subject}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Topic selector */}
            <div className="flex-1 space-y-2">
                <Label htmlFor="topic-select">Topic</Label>
                <Select
                    value={selectedTopic}
                    onValueChange={onTopicChange}
                    disabled={!selectedSubject}
                >
                    <SelectTrigger id="topic-select" className="w-full">
                        <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                        {filteredTopics.map((topic) => (
                            <SelectItem key={topic} value={topic}>
                                {topic}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Difficulty selector (optional) */}
            {showDifficulty && onDifficultyChange && (
                <div className="w-full space-y-2 sm:w-40">
                    <Label htmlFor="difficulty-select">Difficulty</Label>
                    <Select value={selectedDifficulty} onValueChange={onDifficultyChange}>
                        <SelectTrigger id="difficulty-select">
                            <SelectValue placeholder="Difficulty" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}
