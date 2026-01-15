'use client';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

interface AppShellProps {
    children: React.ReactNode;
    userName?: string | null;
}

export function AppShell({ children, userName }: AppShellProps) {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar - hidden on mobile */}
            <div className="hidden lg:block">
                <Sidebar />
            </div>

            {/* Main content area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Topbar */}
                <Topbar userName={userName} />

                {/* Page content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
