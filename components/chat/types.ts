export type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    action?: string;
    parameters?: any;
    createdAt: string;
};
