'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { Upload, SupportedMimeType, QuizGenerationOptions } from '@/lib/uploads/types';
import {
    SUPPORTED_EXTENSIONS,
    MAX_FILE_SIZE_BYTES,
    MAX_FILE_SIZE_LABEL,
    DEFAULT_QUIZ_OPTIONS,
} from '@/lib/uploads/types';
import {
    createUpload,
    confirmUpload,
    getRecentUploads,
    getUploadStatus,
    retryUpload,
    deleteUpload,
} from '@/app/actions/uploads';
import { getTopics, createTopic, type Topic } from '@/app/actions/topics';
import { UploadItem } from './UploadItem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Upload as UploadIcon,
    FileUp,
    Loader2,
    FileText,
    FileType,
    Presentation,
    AlertCircle,
    Sparkles,
    Plus,
    BookOpen,
} from 'lucide-react';

interface UploadPanelProps {
    className?: string;
}

const ACCEPTED_TYPES = Object.values(SUPPORTED_EXTENSIONS).join(',');

export function UploadPanel({ className }: UploadPanelProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [uploads, setUploads] = useState<Upload[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Topics state
    const [topics, setTopics] = useState<Topic[]>([]);
    const [selectedTopicId, setSelectedTopicId] = useState<string>('');
    const [showNewTopic, setShowNewTopic] = useState(false);
    const [newSubject, setNewSubject] = useState('');
    const [newTopic, setNewTopic] = useState('');

    // Quiz options
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
    const [questionCount, setQuestionCount] = useState('10');

    // Fetch uploads and topics on mount
    useEffect(() => {
        fetchUploads();
        fetchTopics();
    }, []);

    // Poll for processing uploads
    useEffect(() => {
        const processingUploads = uploads.filter(
            (u) => u.status === 'uploading' || u.status === 'processing'
        );

        if (processingUploads.length === 0) return;

        const interval = setInterval(async () => {
            let updated = false;
            for (const upload of processingUploads) {
                const result = await getUploadStatus(upload.id);
                if (result.data && result.data.status !== upload.status) {
                    updated = true;
                }
            }
            if (updated) {
                fetchUploads();
            }
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(interval);
    }, [uploads]);

    const fetchUploads = async () => {
        const result = await getRecentUploads(5);
        if (result.data) {
            setUploads(result.data);
        }
        setLoading(false);
    };

    const fetchTopics = async () => {
        const result = await getTopics();
        if (result.data) {
            setTopics(result.data);
        }
    };

    const handleCreateTopic = async () => {
        if (!newSubject.trim() || !newTopic.trim()) {
            setError('Please enter both subject and topic');
            return;
        }

        const result = await createTopic({
            subject: newSubject.trim(),
            topic: newTopic.trim(),
            difficulty_pref: difficulty,
        });

        if (result.error) {
            setError(result.error);
            return;
        }

        if (result.data) {
            setTopics([...topics, result.data]);
            setSelectedTopicId(result.data.id);
            setShowNewTopic(false);
            setNewSubject('');
            setNewTopic('');
            toast({
                title: 'Topic created',
                description: `${result.data.subject} - ${result.data.topic}`,
            });
        }
    };

    // File validation
    const validateFile = (file: File): string | null => {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!SUPPORTED_EXTENSIONS[ext]) {
            return `Unsupported file type. Please upload PDF, DOCX, or PPTX.`;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            return `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}.`;
        }
        return null;
    };

    // Handle file selection
    const handleFileSelect = (file: File) => {
        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            setSelectedFile(null);
            return;
        }
        setError(null);
        setSelectedFile(file);
    };

    // Handle drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
    }, []);

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    // Handle upload
    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setError(null);

        try {
            const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
            const mimeType = SUPPORTED_EXTENSIONS[ext] as SupportedMimeType;

            // Get selected topic details
            const selectedTopic = topics.find(t => t.id === selectedTopicId);

            // Step 1: Create upload record and get signed URL
            const createResult = await createUpload({
                original_name: selectedFile.name,
                mime_type: mimeType,
                size_bytes: selectedFile.size,
                topic_id: selectedTopicId || undefined,
                subject: selectedTopic?.subject,
                topic: selectedTopic?.topic,
                options: {
                    difficulty,
                    question_count: parseInt(questionCount),
                    question_types: ['mcq'],
                },
            });

            if (createResult.error) {
                throw new Error(createResult.error);
            }

            // Step 2: Upload file to signed URL
            const uploadResponse = await fetch(createResult.signed_url, {
                method: 'PUT',
                body: selectedFile,
                headers: {
                    'Content-Type': mimeType,
                },
            });

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload file to storage');
            }

            // Step 3: Confirm upload and trigger processing
            const confirmResult = await confirmUpload(createResult.upload_id);

            if (confirmResult.error) {
                throw new Error(confirmResult.error);
            }

            // Success
            toast({
                title: 'Upload started',
                description: 'Your file is being processed. Quiz will be ready soon!',
            });

            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            // Refresh uploads list
            await fetchUploads();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Upload failed';
            setError(message);
            toast({
                title: 'Upload failed',
                description: message,
                variant: 'destructive',
            });
        } finally {
            setUploading(false);
        }
    };

    // Handle retry
    const handleRetry = async (uploadId: string) => {
        const result = await retryUpload(uploadId);
        if (result.error) {
            toast({
                title: 'Retry failed',
                description: result.error,
                variant: 'destructive',
            });
        } else {
            toast({ title: 'Processing restarted' });
            await fetchUploads();
        }
    };

    // Handle delete
    const handleDelete = async (uploadId: string) => {
        const result = await deleteUpload(uploadId);
        if (result.error) {
            toast({
                title: 'Delete failed',
                description: result.error,
                variant: 'destructive',
            });
        } else {
            toast({ title: 'Upload deleted' });
            await fetchUploads();
        }
    };

    return (
        <Card className={cn('overflow-hidden', className)}>
            <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-indigo-500" />
                    Upload & Generate Quiz
                </CardTitle>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
                {/* Drop Zone */}
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={cn(
                        'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
                        dragActive
                            ? 'border-primary bg-primary/5'
                            : 'border-muted-foreground/25 hover:border-primary/50',
                        uploading && 'pointer-events-none opacity-50'
                    )}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_TYPES}
                        onChange={handleInputChange}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        disabled={uploading}
                    />

                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                            <FileText className="h-6 w-6 text-red-500" />
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                            <FileType className="h-6 w-6 text-blue-500" />
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                            <Presentation className="h-6 w-6 text-orange-500" />
                        </div>
                    </div>

                    <p className="text-center font-medium">
                        {selectedFile ? selectedFile.name : 'Drop a file here or click to browse'}
                    </p>
                    <p className="mt-1 text-center text-sm text-muted-foreground">
                        PDF, DOCX, PPTX • Max {MAX_FILE_SIZE_LABEL}
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Topic Selection */}
                {selectedFile && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                Topic (Optional)
                            </Label>
                            {!showNewTopic && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowNewTopic(true)}
                                    className="h-8 gap-1 text-xs"
                                >
                                    <Plus className="h-3 w-3" />
                                    New Topic
                                </Button>
                            )}
                        </div>

                        {showNewTopic ? (
                            <div className="space-y-3 rounded-lg border p-3">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Subject</Label>
                                        <Input
                                            placeholder="e.g., Mathematics"
                                            value={newSubject}
                                            onChange={(e) => setNewSubject(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Topic</Label>
                                        <Input
                                            placeholder="e.g., Calculus"
                                            value={newTopic}
                                            onChange={(e) => setNewTopic(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleCreateTopic}
                                        className="flex-1"
                                    >
                                        Create Topic
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setShowNewTopic(false);
                                            setNewSubject('');
                                            setNewTopic('');
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a topic or skip" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">No topic (skip)</SelectItem>
                                    {topics.map((topic) => (
                                        <SelectItem key={topic.id} value={topic.id}>
                                            {topic.subject} - {topic.topic}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                )}

                {/* Quiz Options */}
                {selectedFile && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Difficulty</Label>
                            <Select value={difficulty} onValueChange={(v: 'easy' | 'medium' | 'hard') => setDifficulty(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="easy">Easy</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="hard">Hard</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Number of Questions</Label>
                            <Select value={questionCount} onValueChange={setQuestionCount}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">5 questions</SelectItem>
                                    <SelectItem value="10">10 questions</SelectItem>
                                    <SelectItem value="15">15 questions</SelectItem>
                                    <SelectItem value="20">20 questions</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {/* Upload Button */}
                {selectedFile && (
                    <Button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="w-full gap-2"
                        size="lg"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <FileUp className="h-5 w-5" />
                                Generate Quiz
                            </>
                        )}
                    </Button>
                )}

                {/* Recent Uploads */}
                {uploads.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground">Recent Uploads</h3>
                        <div className="space-y-2">
                            {uploads.map((upload) => (
                                <UploadItem
                                    key={upload.id}
                                    upload={upload}
                                    onRetry={handleRetry}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
