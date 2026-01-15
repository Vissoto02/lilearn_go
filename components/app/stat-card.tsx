import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    className?: string;
}

export function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    className,
}: StatCardProps) {
    return (
        <Card className={cn('transition-shadow hover:shadow-md', className)}>
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-bold tracking-tight">{value}</p>
                            {trend && (
                                <span
                                    className={cn(
                                        'text-xs font-medium',
                                        trend.isPositive ? 'text-green-600' : 'text-red-600'
                                    )}
                                >
                                    {trend.isPositive ? '+' : ''}{trend.value}%
                                </span>
                            )}
                        </div>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground">{subtitle}</p>
                        )}
                    </div>
                    {Icon && (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
