'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    BookOpen,
    Calendar,
    Target,
    Upload,
    Settings,
    Swords,
    Medal,
} from 'lucide-react';

const navigation = [
    { name: 'Dashboard', href: '/app', icon: LayoutDashboard },
    { name: 'Planner', href: '/app/planner', icon: Calendar },
    { name: 'Quiz', href: '/app/quiz', icon: BookOpen },
    { name: 'Revision', href: '/app/revision', icon: Swords },
    { name: 'Habits', href: '/app/habits', icon: Target },
    { name: 'Leaderboard', href: '/app/leaderboard', icon: Medal },
    { name: 'Uploaded', href: '/app/upload', icon: Upload },
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
            <div className="flex h-16 items-center gap-3 border-b border-border px-6">
                <Image
                    src="/logo_only.png"
                    alt="LiLearn"
                    width={32}
                    height={32}
                    className="rounded-lg"
                />
                <span className="text-xl font-semibold tracking-tight">LiLearn</span>
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


        </aside>
    );
}
