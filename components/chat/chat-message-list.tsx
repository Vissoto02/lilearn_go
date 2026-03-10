import { useEffect, useRef } from "react";
import { ChatMessage } from "./types";
import { ChatMessageBubble } from "./chat-bubble";
import { Bot, Sparkles } from "lucide-react";

interface ChatMessageListProps {
    messages: ChatMessage[];
    isLoading: boolean;
    onQuickPrompt: (prompt: string) => void;
}

export function ChatMessageList({ messages, isLoading, onQuickPrompt }: ChatMessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    const quickPrompts = [
        "Explain my study plan",
        "What should I study today?",
        "Help me understand my weak subjects"
    ];

    return (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full flex-1 text-center py-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Bot className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground">Hi, I'm LiLearn AI Assistant.</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-[250px] mb-8">
                        I can help explain your study plan, AI insights, and quiz performance.
                    </p>
                    <div className="flex flex-col gap-2 w-full max-w-[280px]">
                        {quickPrompts.map((prompt, idx) => (
                            <button
                                key={idx}
                                onClick={() => onQuickPrompt(prompt)}
                                className="flex items-center gap-2.5 px-4 py-3 text-sm bg-card hover:bg-muted text-foreground transition-colors rounded-xl border text-left"
                            >
                                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                                <span>{prompt}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col">
                    {messages.map((msg) => (
                        <ChatMessageBubble key={msg.id} message={msg} />
                    ))}
                    {isLoading && (
                        <div className="flex justify-start mb-4">
                            <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm flex items-center gap-2">
                                <Bot className="w-4 h-4 animate-pulse" />
                                <span>AI is thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} className="h-4 shrink-0" />
                </div>
            )}
        </div>
    );
}
