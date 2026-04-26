import { NextResponse } from "next/server";
import {
	appendAnalysis,
	getRecentSessionsByGame,
} from "~/server/analytics-store";
import { getGameDescriptor } from "~/server/game-descriptors";

interface Suggestion {
	param: string;
	current: number | string;
	suggested: number | string;
	reason: string;
	impact: string;
}

interface AnalysisResult {
	summary: string;
	problems: string[];
	suggestions: Suggestion[];
	earlyGame: string;
	estimatedRetentionGain: string;
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => ({}))) as { gameRoute?: string; gameSlug?: string };
	const gameSlug = (body.gameSlug ?? body.gameRoute ?? "brown-stacks").replace(/^\//, "");
	const sessions = await getRecentSessionsByGame(gameSlug, 200);

	if (sessions.length === 0) {
		return NextResponse.json({ error: "No sessions yet — play a game first!" }, { status: 400 });
	}

	const descriptor = getGameDescriptor(gameSlug);

	const avgWave = sessions.reduce((s, g) => s + g.waveReached, 0) / sessions.length;
	const avgKills = sessions.reduce((s, g) => s + g.kills, 0) / sessions.length;
	const avgDuration = sessions.reduce((s, g) => s + g.durationSeconds, 0) / sessions.length;

	const waveDist: Record<number, number> = {};
	for (const s of sessions) {
		waveDist[s.waveReached] = (waveDist[s.waveReached] ?? 0) + 1;
	}

	const winRate =
		descriptor.waveLabel === "Result"
			? `${((sessions.filter((s) => s.waveReached === 1).length / sessions.length) * 100).toFixed(1)}%`
			: null;

	const telemetryBlock = [
		`Telemetry (${sessions.length} sessions):`,
		`- Average ${descriptor.waveLabel.toLowerCase()}: ${descriptor.waveLabel === "Result" ? `win rate ${winRate}` : avgWave.toFixed(1)}`,
		`- Average kills: ${avgKills.toFixed(1)}`,
		`- Average session length: ${Math.round(avgDuration)}s`,
		`- ${descriptor.waveLabel} distribution: ${JSON.stringify(waveDist)}`,
	].join("\n");

	const prompt = `You are a game balancing expert analyzing telemetry for "${descriptor.title}" — ${descriptor.genre}.

Game mechanics:
${descriptor.mechanics}

${telemetryBlock}

Analyze and respond with JSON only (no markdown):
{
  "summary": "2-3 sentence overview of player experience and biggest pain points",
  "problems": ["specific problem 1", "specific problem 2", "specific problem 3"],
  "suggestions": [
    { "param": "EXAMPLE_PARAM", "current": 10, "suggested": 14, "reason": "...", "impact": "+15% improvement" }
  ],
  "earlyGame": "assessment of early experience and new player onboarding",
  "estimatedRetentionGain": "+X%"
}

IMPORTANT: Only suggest params from this list: ${descriptor.tunableParams.join(", ")}. Use exact param names.`;

	const geminiKey = process.env.GEMINI_API_KEY;
	const anthropicKey = process.env.ANTHROPIC_API_KEY;

	let text = "";

	if (geminiKey) {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(geminiKey)}`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: {
						temperature: 0.2,
						maxOutputTokens: 1024,
					},
				}),
			},
		);

		if (!response.ok) {
			const err = await response.text();
			return NextResponse.json({ error: `Gemini API error: ${err}` }, { status: 500 });
		}

		const data = (await response.json()) as {
			candidates?: { content?: { parts?: { text?: string }[] } }[];
		};
		text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
	} else if (anthropicKey) {
		const response = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"x-api-key": anthropicKey,
				"anthropic-version": "2023-06-01",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				model: "claude-haiku-4-5-20251001",
				max_tokens: 1024,
				messages: [{ role: "user", content: prompt }],
			}),
		});

		if (!response.ok) {
			const err = await response.text();
			return NextResponse.json({ error: `Anthropic API error: ${err}` }, { status: 500 });
		}

		const data = (await response.json()) as { content: { text: string }[] };
		text = data.content[0]?.text ?? "";
	} else {
		return NextResponse.json(
			{ error: "Set GEMINI_API_KEY (preferred) or ANTHROPIC_API_KEY in .env" },
			{ status: 500 },
		);
	}

	let analysis: AnalysisResult;
	try {
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		analysis = jsonMatch ? (JSON.parse(jsonMatch[0]) as AnalysisResult) : {
			summary: text,
			problems: [],
			suggestions: [],
			earlyGame: "",
			estimatedRetentionGain: "unknown",
		};
	} catch {
		analysis = { summary: text, problems: [], suggestions: [], earlyGame: "", estimatedRetentionGain: "unknown" };
	}

	await appendAnalysis({
		gameSlug,
		summary: analysis.summary,
		analysisJson: JSON.stringify(analysis),
	});

	return NextResponse.json(analysis);
}
