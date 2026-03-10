import { ChatMessage } from "./types";
import { cn } from "@/lib/utils";

interface ChatMessageBubbleProps {
    message: ChatMessage;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
    const isUser = message.role === "user";

    return (
        <div
            className={cn(
                "flex w-full mb-4",
                isUser ? "justify-end" : "justify-start"
            )}
        >
            <div className="flex flex-col gap-2 max-w-[80%]">
                <div
                    className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                        isUser
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                    )}
                >
                    {message.content}
                </div>
                {!isUser && message.action === "generate_plan" && message.parameters && (
                    <div className="p-3 bg-card border rounded-xl rounded-bl-sm shadow-sm space-y-2 mt-1 w-full max-w-xs">
                        <div className="flex items-center gap-2 text-primary font-medium text-sm mb-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line></svg>
                            Study Plan Ready
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-2 rounded-lg">
                            <p><strong>Duration:</strong> {message.parameters.number_of_weeks ? `${message.parameters.number_of_weeks} weeks` : (message.parameters.until_week || "Default")}</p>
                            <p><strong>Focus:</strong> {message.parameters.focus_mode === "weak_subjects" ? "Weak Subjects" : "Balanced"}</p>
                            {message.parameters.subject_filter && <p><strong>Subject:</strong> {message.parameters.subject_filter}</p>}
                            {message.parameters.topic_filter && <p><strong>Topic:</strong> {message.parameters.topic_filter}</p>}
                        </div>
                        <a
                            href="/app/planner"
                            className="block w-full text-center py-2 px-3 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            Open Study Planner
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
