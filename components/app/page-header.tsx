import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: React.ReactNode;
    };
    className?: string;
}

export function PageHeader({
    title,
    description,
    action,
    className,
}: PageHeaderProps) {
    return (
        <div
            className={cn(
                'flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between',
                className
            )}
        >
            <div className="space-y-1">
                <h1 className="text-h1">{title}</h1>
                {description && (
                    <p className="text-body text-muted-foreground">{description}</p>
                )}
            </div>
            {action && (
                <Button onClick={action.onClick} className="shrink-0">
                    {action.icon}
                    {action.label}
                </Button>
            )}
        </div>
    );
}
