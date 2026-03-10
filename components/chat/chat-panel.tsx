import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "./types";
import { X, Bot } from "lucide-react";
import { ChatMessageList } from "./chat-message-list";
import { ChatInput } from "./chat-input";

interface ChatPanelProps {
    onClose: () => void;
    initialMessage?: string | null;
    initialContext?: any;
}

export function ChatPanel({ onClose, initialMessage, initialContext }: ChatPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        // Load from session storage on mount
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("lilearn_chat_history");
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });
    const [isLoading, setIsLoading] = useState(false);

    // Prevent re-triggering exactly the same initial message multiple times
    const lastProcessedMessage = useRef<string | null>(null);

    // Persist to session storage
    useEffect(() => {
        sessionStorage.setItem("lilearn_chat_history", JSON.stringify(messages));
    }, [messages]);

    useEffect(() => {
        if (initialMessage && initialMessage !== lastProcessedMessage.current) {
            lastProcessedMessage.current = initialMessage;
            handleSend(initialMessage, initialContext);
        }
    }, [initialMessage, initialContext]);

    const handleSend = async (message: string, context?: any) => {
        if (!message.trim() || isLoading) return;

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: message,
            createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message,
                    context: context || null
                })
            });

            const data = await res.json();

            const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: data.reply || "Sorry, I couldn't process your request right now. Please try again.",
                action: data.action,
                parameters: data.parameters,
                createdAt: new Date().toISOString()
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            console.error(error);
            const errorMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "Sorry, I couldn't process your request right now. Please try again.",
                createdAt: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background relative z-50 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.1)] border border-border/50">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">LiLearn AI Assistant</h2>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">Online and ready to help</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 -mr-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors flex shrink-0"
                    aria-label="Close chat"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative flex flex-col">
                <ChatMessageList
                    messages={messages}
                    isLoading={isLoading}
                    onQuickPrompt={handleSend}
                />
            </div>

            <ChatInput onSend={handleSend} isLoading={isLoading} />
        </div>
    );
}
