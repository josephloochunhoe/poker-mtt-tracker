import { NextResponse } from "next/server";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const COACH_PROMPT = `You are an elite multi-table tournament (MTT) poker coach reviewing a player's recent sessions.

You will be given a set of tournament sessions. Each includes results (buy-in, finish position, field size, cash won, bounties, profit, ROI) and the player's own written review/notes (often describing the hand that busted them or how they felt the session went).

Your job:
1. Identify recurring leaks, patterns, and mistakes across the sessions — especially anything mentioned repeatedly in the player's own reviews.
2. Comment specifically on notable bust-out hands or key decisions the player describes, with sound MTT strategy reasoning (ICM, stack depth, position, ranges, bet sizing).
3. Give concrete, prioritised, actionable improvements — what to work on first.
4. Be honest and direct but constructive and encouraging.

Keep it focused and practical. Use clear sections and short bullet points. Do not invent details that aren't in the data; if a session has no written review, lean on its stats. Avoid generic filler.`;

interface SessionPayload {
    name: string;
    type: string;
    speed: string;
    date: string;
    buyIn: string;
    finishPosition: number | null;
    fieldSize: number | null;
    cashWon: string;
    bountiesWon: string;
    profit: string;
    roi: string;
    review: string;
    registrationDepth?: string;
}

function formatSessions(sessions: SessionPayload[]): string {
    return sessions
        .map((s, i) => {
            const pos = s.finishPosition != null
                ? `${s.finishPosition}${s.fieldSize != null ? ` / ${s.fieldSize}` : ""}`
                : "N/A";
            const lines = [
                `Session ${i + 1}: ${s.name}`,
                `  Type: ${s.type} (${s.speed})`,
                `  Date: ${s.date}`,
                `  Buy-in (total invested): ${s.buyIn}`,
                `  Finish: ${pos}`,
                `  Cash won: ${s.cashWon} | Bounties: ${s.bountiesWon}`,
                `  Profit: ${s.profit} | ROI: ${s.roi}`,
                ...(s.registrationDepth ? [`  Registration Depth: ${s.registrationDepth}`] : []),
                `  Player's review: ${s.review}`,
            ];
            return lines.join("\n");
        })
        .join("\n\n");
}

export async function POST(request: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not set. Add it to your environment (get a key from Google AI Studio) to enable AI reviews." },
                { status: 500 }
            );
        }

        const body = await request.json();
        const sessions = body?.sessions;
        if (!Array.isArray(sessions) || sessions.length === 0) {
            return NextResponse.json({ error: "No sessions provided for review." }, { status: 400 });
        }

        const userContent = `Here are ${sessions.length} session(s) to review:\n\n${formatSessions(sessions)}`;

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey,
                },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: COACH_PROMPT }] },
                    contents: [{ role: "user", parts: [{ text: userContent }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
                }),
            }
        );

        const data = await res.json();

        if (!res.ok) {
            const message = data?.error?.message || `Gemini API error (${res.status})`;
            console.error("Gemini API error:", message);
            return NextResponse.json({ error: message }, { status: res.status });
        }

        const review = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!review) {
            const blockReason = data?.promptFeedback?.blockReason;
            return NextResponse.json(
                { error: blockReason ? `Response blocked: ${blockReason}` : "The AI returned an empty response. Try again." },
                { status: 502 }
            );
        }

        return NextResponse.json({ review });
    } catch (error) {
        console.error("AI review error:", error);
        const message = error instanceof Error ? error.message : "Failed to generate AI review.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
