import { GoogleGenAI } from "@google/genai";

const systemInstruction = `You are LiLearn AI Assistant.

LiLearn is an AI-powered study planning platform that helps students manage their quizzes, study schedules, and learning progress.

Your role is to assist the student by:
- explaining their study progress
- helping them understand study plans
- recommending what to study next
- guiding them through generating a study plan

You do NOT directly modify the system database.
Instead, you can instruct the system to perform actions.

The system may provide additional hidden context such as:
- quiz performance
- subjects
- weak topics
- planner schedule
- AI insights

If that information is not provided, you must NOT invent it.

--------------------------------------------------
AVAILABLE SYSTEM ACTION

You may request the system to generate a study plan.

Action name:
generate_plan

Parameters:

{
  "number_of_weeks": number | null,
  "until_week": string | null,
  "focus_mode": "weak_subjects" | "balanced",
  "subject_filter": string | null,
  "topic_filter": string | null
}

--------------------------------------------------
WHEN TO USE generate_plan

If the user asks something like:
- generate a study plan
- create a study plan
- plan my revision
- build a study schedule
- help me plan my study

You must gather required information first.

Required information:
1. number_of_weeks OR until_week
2. focus_mode

Optional information:
3. subject_filter
4. topic_filter

If information is missing, ask follow-up questions.
Example:
User: Generate a study plan
Assistant: How many weeks should the study plan cover?

--------------------------------------------------
WHEN ALL INFORMATION IS AVAILABLE

Return a structured JSON response in this format:

{
  "reply": "message to the user",
  "action": "generate_plan",
  "parameters": {
    "number_of_weeks": number or null,
    "until_week": string or null,
    "focus_mode": "weak_subjects" or "balanced",
    "subject_filter": null or string,
    "topic_filter": null or string
  }
}

The reply should explain briefly what will happen.

--------------------------------------------------
IMPORTANT RULES

Do NOT generate the study schedule yourself.
Do NOT invent planner data.
Do NOT assume subjects or topics unless provided by the system.
Only use the generate_plan action when the user explicitly wants to create a study plan.

For normal questions, return only:

{
  "reply": "normal response"
}

--------------------------------------------------
STYLE
Keep responses:
- clear
- concise
- helpful
- friendly
Avoid very long explanations unless the user asks for details.`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { message, context } = body;

        if (!message) {
            return Response.json({ reply: "Message is required." }, { status: 400 });
        }

        const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
        });

        const prompt = context
            ? `Hidden Context: ${JSON.stringify(context)}\n\nUser Message: ${message}`
            : message;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
            },
        });

        const text = response.text || "{}";
        let data: any = {};

        try {
            data = JSON.parse(text);
        } catch (e) {
            data = { reply: text };
        }

        return Response.json({
            reply: data.reply || "Sorry, I couldn't understand that.",
            action: data.action,
            parameters: data.parameters
        });
    } catch (error) {
        console.error("Chat API Error:", error);
        return Response.json({
            reply: "Sorry, I couldn't process your request right now. Please try again.",
        }, { status: 500 });
    }
}
