'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { Topic, Difficulty } from '@/lib/types';
import {
    Plus,
    Upload,
    FileText,
    Pencil,
    Trash2,
    Loader2,
    BookOpen,
} from 'lucide-react';

export default function UploadPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [topics, setTopics] = useState<Topic[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [bulkInput, setBulkInput] = useState('');
    const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

    // Form state
    const [subject, setSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [difficulty, setDifficulty] = useState<Difficulty>('medium');

    useEffect(() => {
        fetchTopics();
    }, []);

    const fetchTopics = async () => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('topics')
            .select('*')
            .order('subject', { ascending: true });

        if (!error && data) {
            setTopics(data);
        }
        setLoading(false);
    };

    const handleAddTopic = async () => {
        if (!subject.trim() || !topic.trim()) return;

        setSaving(true);
        const supabase = createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('topics').insert({
            user_id: user.id,
            subject: subject.trim(),
            topic: topic.trim(),
            difficulty_pref: difficulty,
        });

        if (error) {
            toast({
                title: 'Error',
                description: 'Failed to add topic',
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Success',
                description: 'Topic added successfully',
            });
            resetForm();
            setDialogOpen(false);
            fetchTopics();
        }
        setSaving(false);
    };

    const handleUpdateTopic = async () => {
        if (!editingTopic || !subject.trim() || !topic.trim()) return;

        setSaving(true);
        const supabase = createClient();

        const { error } = await supabase
            .from('topics')
            .update({
                subject: subject.trim(),
                topic: topic.trim(),
                difficulty_pref: difficulty,
            })
            .eq('id', editingTopic.id);

        if (error) {
            toast({
                title: 'Error',
                description: 'Failed to update topic',
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Success',
                description: 'Topic updated successfully',
            });
            resetForm();
            setDialogOpen(false);
            setEditingTopic(null);
            fetchTopics();
        }
        setSaving(false);
    };

    const handleDeleteTopic = async (id: string) => {
        const supabase = createClient();
        const { error } = await supabase.from('topics').delete().eq('id', id);

        if (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete topic',
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Deleted',
                description: 'Topic removed',
            });
            fetchTopics();
        }
    };

    const handleBulkImport = async () => {
        if (!bulkInput.trim()) return;

        setSaving(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Parse bulk input: expecting "Subject: Topic" or "Subject - Topic" per line
        const lines = bulkInput.split('\n').filter(line => line.trim());
        const newTopics: { user_id: string; subject: string; topic: string; difficulty_pref: Difficulty }[] = [];

        for (const line of lines) {
            const match = line.match(/^(.+?)[:|-](.+)$/);
            if (match) {
                newTopics.push({
                    user_id: user.id,
                    subject: match[1].trim(),
                    topic: match[2].trim(),
                    difficulty_pref: 'medium',
                });
            }
        }

        if (newTopics.length === 0) {
            toast({
                title: 'No topics found',
                description: 'Use format "Subject: Topic" or "Subject - Topic" per line',
                variant: 'destructive',
            });
            setSaving(false);
            return;
        }

        const { error } = await supabase.from('topics').insert(newTopics);

        if (error) {
            toast({
                title: 'Error',
                description: 'Failed to import topics',
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Success',
                description: `Imported ${newTopics.length} topics`,
            });
            setBulkInput('');
            fetchTopics();
        }
        setSaving(false);
    };

    const resetForm = () => {
        setSubject('');
        setTopic('');
        setDifficulty('medium');
    };

    const openEditDialog = (t: Topic) => {
        setEditingTopic(t);
        setSubject(t.subject);
        setTopic(t.topic);
        setDifficulty(t.difficulty_pref);
        setDialogOpen(true);
    };

    const openAddDialog = () => {
        setEditingTopic(null);
        resetForm();
        setDialogOpen(true);
    };

    // Group topics by subject
    const groupedTopics = topics.reduce((acc, t) => {
        if (!acc[t.subject]) acc[t.subject] = [];
        acc[t.subject].push(t);
        return acc;
    }, {} as Record<string, Topic[]>);

    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="Upload Topics"
                description="Add your syllabus topics to generate quizzes and study plans"
                action={{
                    label: 'Add Topic',
                    onClick: openAddDialog,
                    icon: <Plus className="mr-2 h-4 w-4" />,
                }}
            />

            {/* Bulk Import */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="h-5 w-5" />
                        Quick Import
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="bulk-input">Paste topics (one per line)</Label>
                        <Textarea
                            id="bulk-input"
                            placeholder={`Format: Subject: Topic\nExample:\nMathematics: Algebra\nMathematics: Calculus\nPhysics: Mechanics`}
                            value={bulkInput}
                            onChange={(e) => setBulkInput(e.target.value)}
                            rows={5}
                        />
                    </div>
                    <Button onClick={handleBulkImport} disabled={saving || !bulkInput.trim()}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Import Topics
                    </Button>
                </CardContent>
            </Card>

            {/* Topics List */}
            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardHeader>
                                <div className="h-5 w-32 rounded bg-muted" />
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="h-4 w-24 rounded bg-muted" />
                                    <div className="h-4 w-28 rounded bg-muted" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : topics.length === 0 ? (
                <EmptyState
                    icon={BookOpen}
                    title="No topics yet"
                    description="Add your first topic to start generating quizzes"
                    action={{
                        label: 'Add Topic',
                        onClick: openAddDialog,
                    }}
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {Object.entries(groupedTopics).map(([subjectName, subjectTopics]) => (
                        <Card key={subjectName}>
                            <CardHeader>
                                <CardTitle className="text-lg">{subjectName}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {subjectTopics.map((t) => (
                                        <div
                                            key={t.id}
                                            className="flex items-center justify-between rounded-lg border border-border p-3"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{t.topic}</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {t.difficulty_pref}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditDialog(t)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteTopic(t.id)}
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingTopic ? 'Edit Topic' : 'Add New Topic'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingTopic
                                ? 'Update the topic details'
                                : 'Add a new topic to your study list'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input
                                id="subject"
                                placeholder="e.g., Mathematics"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="topic">Topic</Label>
                            <Input
                                id="topic"
                                placeholder="e.g., Algebra"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="difficulty">Preferred Difficulty</Label>
                            <Select value={difficulty} onValueChange={(v: Difficulty) => setDifficulty(v)}>
                                <SelectTrigger id="difficulty">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="easy">Easy</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="hard">Hard</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={editingTopic ? handleUpdateTopic : handleAddTopic}
                            disabled={saving || !subject.trim() || !topic.trim()}
                        >
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingTopic ? 'Update' : 'Add Topic'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
