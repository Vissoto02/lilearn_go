'use server';

import { createClient } from '@/lib/supabase/server';

export interface Topic {
    id: string;
    user_id: string;
    subject: string;
    topic: string;
    difficulty_pref: 'easy' | 'medium' | 'hard';
    created_at: string;
}

export interface CreateTopicInput {
    subject: string;
    topic: string;
    difficulty_pref?: 'easy' | 'medium' | 'hard';
}

export interface TopicActionResult {
    data?: Topic;
    error?: string;
}

export interface TopicsListResult {
    data?: Topic[];
    error?: string;
}

// ============================================================================
// getTopics: Fetch all user topics
// ============================================================================

export async function getTopics(): Promise<TopicsListResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('user_id', user.id)
        .order('subject', { ascending: true })
        .order('topic', { ascending: true });

    if (error) {
        return { error: error.message };
    }

    return { data: data || [] };
}

// ============================================================================
// getTopicsBySubject: Fetch topics grouped by subject
// ============================================================================

export async function getTopicsBySubject(): Promise<{ data?: Record<string, Topic[]>; error?: string }> {
    const result = await getTopics();

    if (result.error || !result.data) {
        return { error: result.error };
    }

    const grouped = result.data.reduce((acc, topic) => {
        if (!acc[topic.subject]) {
            acc[topic.subject] = [];
        }
        acc[topic.subject].push(topic);
        return acc;
    }, {} as Record<string, Topic[]>);

    return { data: grouped };
}

// ============================================================================
// createTopic: Create a new topic
// ============================================================================

export async function createTopic(input: CreateTopicInput): Promise<TopicActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    // Check if topic already exists
    const { data: existing } = await supabase
        .from('topics')
        .select('*')
        .eq('user_id', user.id)
        .eq('subject', input.subject)
        .eq('topic', input.topic)
        .single();

    if (existing) {
        return { data: existing };
    }

    // Create new topic
    const { data, error } = await supabase
        .from('topics')
        .insert({
            user_id: user.id,
            subject: input.subject,
            topic: input.topic,
            difficulty_pref: input.difficulty_pref || 'medium',
        })
        .select()
        .single();

    if (error) {
        return { error: error.message };
    }

    return { data };
}

// ============================================================================
// getOrCreateTopic: Get existing topic or create new one
// ============================================================================

export async function getOrCreateTopic(input: CreateTopicInput): Promise<TopicActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    // Try to find existing topic
    const { data: existing } = await supabase
        .from('topics')
        .select('*')
        .eq('user_id', user.id)
        .eq('subject', input.subject)
        .eq('topic', input.topic)
        .single();

    if (existing) {
        return { data: existing };
    }

    // Create new topic
    return createTopic(input);
}
