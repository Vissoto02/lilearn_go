import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
    variant?: 'card' | 'list' | 'page' | 'stats';
    count?: number;
    className?: string;
}

export function LoadingSkeleton({
    variant = 'card',
    count = 1,
    className,
}: LoadingSkeletonProps) {
    const items = Array.from({ length: count }, (_, i) => i);

    if (variant === 'stats') {
        return (
            <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
                {items.map((i) => (
                    <div key={i} className="rounded-2xl border border-border bg-card p-6">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-8 w-16 mb-1" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                ))}
            </div>
        );
    }

    if (variant === 'list') {
        return (
            <div className={cn('space-y-3', className)}>
                {items.map((i) => (
                    <div
                        key={i}
                        className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
                    >
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                    </div>
                ))}
            </div>
        );
    }

    if (variant === 'page') {
        return (
            <div className={cn('space-y-6', className)}>
                {/* Header skeleton */}
                <div className="space-y-2">
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-5 w-72" />
                </div>

                {/* Stats skeleton */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="rounded-2xl border border-border bg-card p-6">
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-8 w-16" />
                        </div>
                    ))}
                </div>

                {/* Content skeleton */}
                <div className="rounded-2xl border border-border bg-card p-6">
                    <Skeleton className="h-6 w-32 mb-4" />
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4">
                                <Skeleton className="h-10 w-10 rounded" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Default: card variant
    return (
        <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
            {items.map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-start justify-between mb-4">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                    <div className="mt-4 flex gap-2">
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}
