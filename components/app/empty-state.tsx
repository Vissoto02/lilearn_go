import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick?: () => void;
        href?: string;
        icon?: React.ReactNode;
    };
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center',
                className
            )}
        >
            {Icon && (
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
            )}
            <h3 className="text-lg font-semibold">{title}</h3>
            {description && (
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    {description}
                </p>
            )}
            {action && (
                action.href ? (
                    <Link href={action.href}>
                        <Button className="mt-4">
                            {action.icon}
                            {action.label}
                        </Button>
                    </Link>
                ) : (
                    <Button onClick={action.onClick} className="mt-4">
                        {action.icon}
                        {action.label}
                    </Button>
                )
            )}
        </div>
    );
}
