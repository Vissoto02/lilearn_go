'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import type { Notification } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function NotificationBell() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        // Initial unread count load
        refreshUnreadCount();
    }, []);

    const refreshUnreadCount = async () => {
        try {
            const { getUnreadNotificationCount } = await import('@/app/actions/notifications');
            const { count } = await getUnreadNotificationCount();
            setUnreadCount(count);
        } catch (err) {
            console.error('Failed to load unread notification count', err);
        }
    };

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const {
                runStudySessionNotificationSweep,
                getNotifications,
                getUnreadNotificationCount,
            } = await import('@/app/actions/notifications');

            // Generate any missing study-session notifications before fetching
            await runStudySessionNotificationSweep();

            const [{ notifications }, { count }] = await Promise.all([
                getNotifications(20),
                getUnreadNotificationCount(),
            ]);

            setNotifications(notifications);
            setUnreadCount(count);
        } catch (err) {
            console.error('Failed to load notifications', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (nextOpen && notifications.length === 0) {
            loadNotifications();
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        startTransition(async () => {
            try {
                const { markNotificationRead } = await import('@/app/actions/notifications');
                await markNotificationRead(notification.id);
                setNotifications((prev) =>
                    prev.map((n) =>
                        n.id === notification.id ? { ...n, is_read: true } : n
                    )
                );
                setUnreadCount((prev) => Math.max(0, prev - (notification.is_read ? 0 : 1)));

                if (notification.link_target) {
                    router.push(notification.link_target);
                }
            } catch (err) {
                console.error('Failed to mark notification as read', err);
            }
        });
    };

    const handleMarkAllRead = () => {
        startTransition(async () => {
            try {
                const { markAllNotificationsRead } = await import('@/app/actions/notifications');
                await markAllNotificationsRead();
                setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                setUnreadCount(0);
            } catch (err) {
                console.error('Failed to mark all notifications as read', err);
            }
        });
    };

    const hasNotifications = notifications.length > 0;

    return (
        <DropdownMenu open={open} onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Notifications"
                    className="relative focus-ring"
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] min-w-[16px] h-[16px] px-0.5">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    {hasNotifications && (
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                            <CheckCheck className="h-3 w-3" />
                            Mark all read
                        </button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {loading ? (
                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading notifications...
                    </div>
                ) : !hasNotifications ? (
                    <div className="py-6 px-3 text-center text-sm text-muted-foreground">
                        No notifications yet. Your study-session alerts will appear here.
                    </div>
                ) : (
                    <>
                        <div className="max-h-80 overflow-y-auto">
                            {notifications.map((n) => (
                                <DropdownMenuItem
                                    key={n.id}
                                    className={cn(
                                        'flex flex-col items-start gap-1 py-2 px-3 text-sm cursor-pointer',
                                        !n.is_read && 'bg-primary/5 font-medium'
                                    )}
                                    onClick={() => handleNotificationClick(n)}
                                >
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                                        {n.title || 'Notification'}
                                    </span>
                                    {n.message && (
                                        <span className="text-[13px] leading-snug">
                                            {n.message}
                                        </span>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </div>
                        <DropdownMenuSeparator />
                        <div className="px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
                            <span>
                                Only study-session notifications are shown for now.
                            </span>
                            {isPending && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            )}
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

