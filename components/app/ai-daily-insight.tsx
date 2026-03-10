"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Bot } from "lucide-react";
import Link from "next/link";

interface InsightData {
    enabled: boolean;
    weak_subject?: string;
    weak_topic?: string;
    accuracy?: number;
    message?: string;
    error?: string;
}

export function AIDailyInsight() {
    const [data, setData] = useState<InsightData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchInsight = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/ai-insight");
            const result = await res.json();
            setData(result);
        } catch (err) {
            console.error(err);
            setData({ enabled: true, error: "Failed to load insight" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsight();
    }, []);

    const openChat = () => {
        const message = `Please explain my AI daily study insight. \n\nMy weakest subject is ${data?.weak_subject}, specifically the topic "${data?.weak_topic}". \n\nMy accuracy is ${data?.accuracy}%. \n\nYour recommendation was: "${data?.message}"\n\nWhat should I do to improve?`;

        window.dispatchEvent(
            new CustomEvent("openLiLearnChat", {
                detail: { message }
            })
        );
    };

    if (loading) {
        return (
            <Card className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </Card>
        );
    }

    if (!data?.enabled) {
        return (
            <Card className="bg-muted/30 border-dashed">
                <CardContent className="py-8 text-center space-y-4">
                    <div className="bg-muted w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                        <Bot className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="max-w-[280px] mx-auto space-y-2">
                        <p className="text-sm font-medium">AI Insights are disabled</p>
                        <p className="text-xs text-muted-foreground">
                            {data?.message || "Enable AI Insights in settings to receive daily learning recommendations."}
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/app/settings">Go to Settings</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (data.message && !data.weak_subject) {
        return (
            <Card className="bg-primary/5 border-primary/10">
                <CardContent className="py-8 text-center space-y-4">
                    <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                        <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground max-w-[300px] mx-auto">
                        {data.message}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/10 overflow-hidden relative shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Sparkles className="h-16 w-16 text-primary" />
            </div>

            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                    </div>
                    AI Study Insight
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                    <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Weakest Subject</p>
                        <p className="text-sm font-semibold truncate leading-none">{data.weak_subject}</p>
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Accuracy</p>
                        <p className="text-sm font-bold text-primary leading-none">{data.accuracy}%</p>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Weakest Topic</p>
                        <p className="text-sm font-semibold leading-relaxed">{data.weak_topic}</p>
                    </div>
                </div>

                <div className="bg-background/40 backdrop-blur-sm rounded-xl p-3 border border-primary/5">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-2">Recommendation</p>
                    <p className="text-sm text-foreground/90 italic leading-relaxed">
                        "{data.message}"
                    </p>
                </div>

                <Button onClick={openChat} className="w-full gap-2 font-medium shadow-sm transition-all active:scale-[0.98]" variant="secondary">
                    <Bot className="h-4 w-4" />
                    Ask AI for more details
                </Button>
            </CardContent>
        </Card>
    );
}
