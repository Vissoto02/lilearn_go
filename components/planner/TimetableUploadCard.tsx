'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    CalendarDays,
    Upload,
    FileUp,
    Loader2,
    FileText,
    ImageIcon,
    AlertCircle,
    CheckCircle2,
    RotateCcw,
    Trash2,
    X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
    createTimetableUpload,
    processTimetableUpload,
    deleteTimetableUpload,
} from '@/app/actions/timetable';
import { useToast } from '@/hooks/use-toast';
import type { TimetableUpload, TimetableUploadStatus } from '@/lib/timetable/types';
import {
    TIMETABLE_ACCEPTED_EXTENSIONS,
    TIMETABLE_MAX_FILE_SIZE,
} from '@/lib/timetable/types';

const ACCEPTED_TYPES = Object.values(TIMETABLE_ACCEPTED_EXTENSIONS).join(',');

const STATUS_CONFIG: Record<TimetableUploadStatus, {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: typeof Loader2;
}> = {
    uploaded: { label: 'Uploaded', variant: 'secondary', icon: Upload },
    processing: { label: 'Processing...', variant: 'default', icon: Loader2 },
    needs_review: { label: 'Ready for Review', variant: 'outline', icon: CheckCircle2 },
    confirmed: { label: 'Confirmed', variant: 'default', icon: CheckCircle2 },
    failed: { label: 'Failed', variant: 'destructive', icon: AlertCircle },
};

interface TimetableUploadCardProps {
    className?: string;
    currentUpload: TimetableUpload | null;
    onUploadComplete: (upload: TimetableUpload) => void;
    onDiscard: () => void;
}

export function TimetableUploadCard({
    className,
    currentUpload,
    onUploadComplete,
    onDiscard,
}: TimetableUploadCardProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processing, setProcessing] = useState(false);

    // Validate file
    const validateFile = (file: File): string | null => {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!TIMETABLE_ACCEPTED_EXTENSIONS[ext]) {
            return 'Unsupported file type. Please upload PDF, PNG, or JPG.';
        }
        if (file.size > TIMETABLE_MAX_FILE_SIZE) {
            return 'File is too large. Maximum size is 10MB.';
        }
        return null;
    };

    const handleFileSelect = (file: File) => {
        const error = validateFile(file);
        if (error) {
            toast({ title: 'Invalid file', description: error, variant: 'destructive' });
            return;
        }
        setSelectedFile(file);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(true);
    }, []);

    const handleDragLeave = useCallback(() => setDragActive(false), []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
    };

    // Upload + process
    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setUploadProgress(10);

        try {
            // Step 1: Create timetable upload record + get signed URL
            const result = await createTimetableUpload({
                original_name: selectedFile.name,
                mime_type: selectedFile.type,
                size_bytes: selectedFile.size,
            });

            if (result.error) {
                throw new Error(result.error);
            }

            setUploadProgress(30);

            // Step 2: Upload file to Supabase storage using signed URL
            const supabase = createClient();
            const { error: storageError } = await supabase.storage
                .from('uploads')
                .uploadToSignedUrl(result.file_path, result.signed_url.split('token=')[1] || result.signed_url, selectedFile, {
                    contentType: selectedFile.type,
                });

            if (storageError) {
                throw new Error(`Upload failed: ${storageError.message}`);
            }

            setUploadProgress(60);
            setUploading(false);
            setProcessing(true);

            // Step 3: Process (calls n8n webhook)
            const processResult = await processTimetableUpload(result.upload_id);

            setUploadProgress(100);

            if (processResult.error) {
                throw new Error(processResult.error);
            }

            if (processResult.data) {
                onUploadComplete(processResult.data);
                toast({
                    title: 'Timetable parsed!',
                    description: `Found ${processResult.data.parsed_json?.length || 0} class sessions. Please review below.`,
                });
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Upload failed';
            toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
        } finally {
            setUploading(false);
            setProcessing(false);
            setUploadProgress(0);
            setSelectedFile(null);
        }
    };

    const handleRetry = async () => {
        if (!currentUpload) return;
        setProcessing(true);
        try {
            const result = await processTimetableUpload(currentUpload.id);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else if (result.data) {
                onUploadComplete(result.data);
                toast({ title: 'Timetable re-processed!', description: 'Please review the extracted data.' });
            }
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async () => {
        if (!currentUpload) return;
        const result = await deleteTimetableUpload(currentUpload.id);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            onDiscard();
            toast({ title: 'Discarded', description: 'Timetable upload removed.' });
        }
    };

    const isProcessing = uploading || processing;
    const statusConfig = currentUpload ? STATUS_CONFIG[currentUpload.status] : null;

    return (
        <Card className={cn('overflow-hidden', className)}>
            {/* Gradient header - teal/cyan to differentiate from quiz upload */}
            <CardHeader className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <CalendarDays className="h-5 w-5" />
                        Upload Your Timetable
                    </CardTitle>
                    <Badge className="bg-white/20 text-white border-0">
                        Step 1 of 3
                    </Badge>
                </div>
                <p className="text-sm text-teal-100 mt-1">
                    Upload your semester timetable and our AI will extract your class schedule
                </p>
            </CardHeader>

            <CardContent className="pt-5 space-y-4">
                {/* Current upload status */}
                {currentUpload && statusConfig && (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium truncate max-w-[200px]">
                                {currentUpload.original_name}
                            </span>
                            <Badge variant={statusConfig.variant} className="text-xs">
                                {currentUpload.status === 'processing' && (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                )}
                                {statusConfig.label}
                            </Badge>
                        </div>
                        <div className="flex gap-1">
                            {currentUpload.status === 'failed' && (
                                <Button size="sm" variant="ghost" onClick={handleRetry} disabled={processing}>
                                    <RotateCcw className="h-3 w-3" />
                                </Button>
                            )}
                            {currentUpload.status !== 'confirmed' && (
                                <Button size="sm" variant="ghost" onClick={handleDelete}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Error message */}
                {currentUpload?.error_message && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{currentUpload.error_message}</span>
                    </div>
                )}

                {/* Upload area - only show when no active upload or when failed */}
                {(!currentUpload || currentUpload.status === 'confirmed' || currentUpload.status === 'failed') && (
                    <>
                        {/* Drop zone */}
                        <div
                            className={cn(
                                'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                                dragActive
                                    ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/10'
                                    : 'border-muted-foreground/25 hover:border-teal-400',
                                isProcessing && 'pointer-events-none opacity-50'
                            )}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ACCEPTED_TYPES}
                                onChange={handleInputChange}
                                className="hidden"
                            />

                            {selectedFile ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-center gap-2">
                                        {selectedFile.type === 'application/pdf' ? (
                                            <FileText className="h-8 w-8 text-teal-600" />
                                        ) : (
                                            <ImageIcon className="h-8 w-8 text-teal-600" />
                                        )}
                                        <div className="text-left">
                                            <p className="font-medium text-sm">{selectedFile.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedFile(null);
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Button
                                        onClick={handleUpload}
                                        disabled={isProcessing}
                                        className="bg-teal-600 hover:bg-teal-700"
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Upload className="mr-2 h-4 w-4" />
                                        )}
                                        {uploading ? 'Uploading...' : processing ? 'Parsing timetable...' : 'Upload & Parse'}
                                    </Button>
                                </div>
                            ) : (
                                <div
                                    className="space-y-3 cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="mx-auto h-12 w-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                                        <FileUp className="h-6 w-6 text-teal-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">
                                            Drop your timetable here or{' '}
                                            <span className="text-teal-600 underline">browse</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            PDF (recommended) • PNG • JPG — up to 10MB
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Upload progress */}
                        {isProcessing && uploadProgress > 0 && (
                            <div className="space-y-1">
                                <Progress value={uploadProgress} className="h-2" />
                                <p className="text-xs text-muted-foreground text-center">
                                    {uploading ? 'Uploading file...' : 'Extracting timetable data via AI...'}
                                </p>
                            </div>
                        )}

                        {/* Info note */}
                        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 mt-0.5 shrink-0 text-teal-600" />
                            We&apos;ll extract your classes and you can review &amp; edit before saving to your calendar.
                        </p>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
