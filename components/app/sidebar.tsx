'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    BookOpen,
    Calendar,
    Target,
    Upload,
    Settings,
    GraduationCap,
} from 'lucide-react';

const navigation = [
    { name: 'Dashboard', href: '/app', icon: LayoutDashboard },
    { name: 'Quiz', href: '/app/quiz', icon: BookOpen },
    { name: 'Planner', href: '/app/planner', icon: Calendar },
    { name: 'Habits', href: '/app/habits', icon: Target },
    { name: 'Upload', href: '/app/upload', icon: Upload },
    { name: 'Settings', href: '/app/settings', icon: Settings },
];

interface SidebarProps {
    className?: string;
}

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();

    return (
        <aside
            className={cn(
                'flex h-full w-64 flex-col border-r border-border bg-card',
                className
            )}
        >
            {/* Logo */}
            <div className="flex h-16 items-center gap-2 border-b border-border px-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-semibold">LiLearn</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navigation.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/app' && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                'hover:bg-accent hover:text-accent-foreground',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground'
                            )}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <item.icon className="h-5 w-5" aria-hidden="true" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="border-t border-border p-4">
                <p className="text-xs text-muted-foreground">
                    © 2024 LiLearn
                </p>
            </div>
        </aside>
    );
}
