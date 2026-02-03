'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { Upload, UploadStatus } from '@/lib/uploads/types';
import { MIME_TYPE_LABELS } from '@/lib/uploads/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    FileText,
    FileType,
    Presentation,
    CheckCircle2,
    XCircle,
    Loader2,
    RefreshCw,
    Trash2,
    ExternalLink,
    Clock,
} from 'lucide-react';
import Link from 'next/link';

interface UploadItemProps {
    upload: Upload;
    onRetry: (uploadId: string) => Promise<void>;
    onDelete: (uploadId: string) => Promise<void>;
}

function getFileIcon(mimeType: string) {
    if (mimeType === 'application/pdf') {
        return <FileText className="h-5 w-5 text-red-500" />;
    }
    if (mimeType.includes('wordprocessingml')) {
        return <FileType className="h-5 w-5 text-blue-500" />;
    }
    if (mimeType.includes('presentationml')) {
        return <Presentation className="h-5 w-5 text-orange-500" />;
    }
    return <FileText className="h-5 w-5" />;
}

function getStatusBadge(status: UploadStatus) {
    switch (status) {
        case 'pending':
            return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
        case 'uploading':
            return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading</Badge>;
        case 'processing':
            return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
        case 'completed':
            return <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>;
        case 'failed':
            return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function UploadItem({ upload, onRetry, onDelete }: UploadItemProps) {
    const [loading, setLoading] = useState(false);

    const handleRetry = async () => {
        setLoading(true);
        try {
            await onRetry(upload.id);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            await onDelete(upload.id);
        } finally {
            setLoading(false);
        }
    };

    const isProcessing = upload.status === 'uploading' || upload.status === 'processing';

    return (
        <div
            className={cn(
                'flex items-center gap-4 rounded-lg border border-border p-4 transition-colors',
                upload.status === 'failed' && 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20',
                upload.status === 'completed' && 'border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/20'
            )}
        >
            {/* File Icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                {getFileIcon(upload.mime_type)}
            </div>

            {/* File Info */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{upload.original_name}</p>
                    {getStatusBadge(upload.status)}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{MIME_TYPE_LABELS[upload.mime_type] || 'File'}</span>
                    <span>•</span>
                    <span>{formatFileSize(upload.size_bytes)}</span>
                    <span>•</span>
                    <span>{formatDate(upload.created_at)}</span>
                </div>
                {upload.error_message && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {upload.error_message}
                    </p>
                )}
                {isProcessing && (
                    <div className="mt-2">
                        <Progress value={upload.status === 'processing' ? 50 : 25} className="h-1" />
                        <p className="mt-1 text-xs text-muted-foreground">
                            {upload.status === 'uploading' ? 'Uploading file...' : 'Generating quiz...'}
                        </p>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
                {upload.status === 'completed' && upload.quiz_id && (
                    <Link href={`/app/quiz?id=${upload.quiz_id}`}>
                        <Button size="sm" variant="outline" className="gap-1">
                            <ExternalLink className="h-4 w-4" />
                            View Quiz
                        </Button>
                    </Link>
                )}
                {upload.status === 'failed' && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRetry}
                        disabled={loading}
                        className="gap-1"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        Retry
                    </Button>
                )}
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={loading}
                    className="text-muted-foreground hover:text-destructive"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
