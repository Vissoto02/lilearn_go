import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";
import { calculateWeakness } from "@/lib/weakness-calculator";

export async function GET() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Check user settings
    const { data: settings } = await supabase
        .from("user_settings")
        .select("ai_daily_insight_enabled")
        .eq("user_id", user.id)
        .single();

    if (!settings?.ai_daily_insight_enabled) {
        return Response.json({
            enabled: false,
            message: "Enable AI Insights in settings to receive daily learning recommendations."
        });
    }

    // 2. Check if insight already exists for today
    const today = new Date().toISOString().split("T")[0];
    const { data: existingInsight } = await supabase
        .from("ai_daily_insight")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (existingInsight) {
        return Response.json({ ...existingInsight, enabled: true });
    }

    // 3. Collect quiz performance data
    const [{ data: attempts }, { data: quizzes }] = await Promise.all([
        supabase.from("quiz_attempts").select("*").eq("user_id", user.id),
        supabase.from("quizzes").select("*").eq("user_id", user.id),
    ]);

    if (!attempts || attempts.length === 0) {
        return Response.json({
            enabled: true,
            message: "Complete your first quiz to unlock AI learning insights."
        });
    }

    // 4. Generate new insight using Gemini
    try {
        const weaknesses = calculateWeakness(
            (attempts || []).map(a => ({ ...a, quiz: quizzes?.find(q => q.id === a.quiz_id) })),
            quizzes || []
        );

        // Send summary data to Gemini
        const performanceData = weaknesses.map(w => ({
            subject: w.subject,
            topic: w.topic,
            accuracy: w.accuracy,
            attempts: w.totalAttempts
        })).slice(0, 10);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY is not defined');

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `You are an AI learning analytics assistant.

Your task is to analyze a student's quiz performance data and identify their weakest areas.

From the provided quiz performance data:
${JSON.stringify(performanceData, null, 2)}

1. Identify the weakest subject
2. Identify the weakest topic
3. Estimate the student's accuracy (calculate overall weighted average if multiple topics)
4. Provide a short recommendation on what to study next

Return your result in JSON format only:
{
  "weak_subject": "",
  "weak_topic": "",
  "accuracy": number,
  "message": ""
}

Guidelines:
- Keep the recommendation short.
- Focus on practical study advice.
- Do not produce long explanations.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.2,
                responseMimeType: 'application/json'
            }
        });

        const responseText = response.text;
        if (!responseText) throw new Error("AI returned empty response");

        // Extract JSON from response (handling potential markdown blocks)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Invalid AI response format");

        const insightData = JSON.parse(jsonMatch[0]);

        // 5. Save insight
        const { data: savedInsight, error: saveError } = await supabase
            .from("ai_daily_insight")
            .insert({
                user_id: user.id,
                weak_subject: insightData.weak_subject,
                weak_topic: insightData.weak_topic,
                accuracy: insightData.accuracy,
                message: insightData.message,
            })
            .select()
            .single();

        if (saveError) throw saveError;

        return Response.json({ ...savedInsight, enabled: true });
    } catch (error) {
        console.error("AI Insight Error:", error);
        return Response.json({
            error: "Failed to generate insight",
            message: "Sorry, I couldn't process your request right now. Please try again."
        }, { status: 500 });
    }
}
