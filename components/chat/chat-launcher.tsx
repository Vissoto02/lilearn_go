"use client";

import { useState, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { ChatPanel } from "./chat-panel";
import { createClient } from "@/lib/supabase/client";

export function ChatLauncher() {
    const [isOpen, setIsOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const supabase = createClient();

    const [initialMessage, setInitialMessage] = useState<string | null>(null);
    const [initialContext, setInitialContext] = useState<any>(null);

    useEffect(() => {
        const handleOpenChat = (e: Event) => {
            setIsOpen(true);
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.message) {
                setInitialMessage(customEvent.detail.message);
                if (customEvent.detail.context) {
                    setInitialContext(customEvent.detail.context);
                }
            }
        };
        window.addEventListener('openLiLearnChat', handleOpenChat);
        return () => window.removeEventListener('openLiLearnChat', handleOpenChat);
    }, []);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(!!session);
        });

        return () => subscription.unsubscribe();
    }, [supabase.auth]);

    if (!isAuthenticated) return null;

    return (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end pointer-events-none">
            <div
                className={`transition-all duration-300 transform origin-bottom-right overflow-hidden ${isOpen
                    ? "pointer-events-auto scale-100 opacity-100 mb-4 h-[550px] max-h-[85vh] w-[90vw] sm:w-[400px]"
                    : "pointer-events-none scale-95 opacity-0 h-0 w-0"
                    }`}
            >
                <ChatPanel
                    onClose={() => {
                        setIsOpen(false);
                        setInitialMessage(null);
                        setInitialContext(null);
                    }}
                    initialMessage={initialMessage}
                    initialContext={initialContext}
                />
            </div>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                aria-label="Toggle chat"
            >
                {isOpen ? (
                    <X className="h-6 w-6 animate-in fade-in" />
                ) : (
                    <MessageCircle className="h-6 w-6 animate-in fade-in" />
                )}
            </button>
        </div>
    );
}
