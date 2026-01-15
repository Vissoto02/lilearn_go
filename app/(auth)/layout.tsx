import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
            {/* Logo */}
            <Link
                href="/"
                className="mb-8 flex items-center gap-2 transition-opacity hover:opacity-80"
            >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                    <GraduationCap className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="text-2xl font-semibold">LiLearn</span>
            </Link>

            {/* Auth card container */}
            <div className="w-full max-w-md">
                {children}
            </div>

            {/* Footer */}
            <p className="mt-8 text-center text-sm text-muted-foreground">
                © 2024 LiLearn. All rights reserved.
            </p>
        </div>
    );
}
