import type { GameEvent } from "./types";

/**
 * Per-snapshot telemetry sampled during play (~ every 250ms). The viral
 * classifier reads these alongside the typed event log to decide whether
 * each kill/save/shot is actually clip-worthy.
 */
export type FeatureSnapshot = {
	t: number; // ms since match start
	playerHpFrac: number; // 0..1
	alliesAlive: number;
	zombiesOnScreen: number;
	zombieRunners: number;
	zombieBrutes: number;
	threatProxim: number; // 0..1, closer + denser = higher
	killsBucket: number; // kills since last snapshot
	hitsTakenBucket: number; // damage taken since last snapshot
	shotsFiredBucket: number;
	wave: number;
};

export type ViralMoment = {
	eventIndex: number;
	score: number; // 0..100
	label: string; // ALLCAPS, max 4 words
	reason: string; // one sentence
};

export const VIRAL_THRESHOLD = 70;

const SYSTEM_PROMPT = `You classify gameplay moments as viral or not for short-form video clips (TikTok/YouTube Shorts).

Input is:
- "events": array of typed gameplay events with timestamps (ms since match start)
- "snapshots": array of telemetry snapshots sampled every ~250ms during the match

For each entry in "events" that is a 'kill', 'low_hp_save', 'long_shot', or 'match_end', evaluate whether the surrounding ~3 seconds would make a compelling viral clip.

Return an array of viral moments, one per qualifying event you keep. Drop the rest. Be selective — most kills are not viral.

Each moment is { eventIndex, score, label, reason }:
- score: 0-100. Above 70 = ship it. Below 70 = skip.
- label: all caps, max 4 words. Examples: "1HP CLUTCH", "TRIPLE WIPE", "WAVE BREAKER", "POINT BLANK", "CROSS MAP".
- reason: one short sentence justifying the score, citing concrete numbers from the snapshots when possible.

Score signals (use the snapshots to back these up):
- player HP fraction at moment of kill (find the snapshot closest in time)
- multikill density (chainSeconds < 3 on a 'kill' event, or several kills inside a 3s window)
- threat density on screen (zombiesOnScreen >= 4, high threatProxim)
- ally deaths inside the window (look for 'ally_death' events near the same t)
- range (long_shot, range > 400)
- match_end: result='win' may be viral, result='loss' is usually not unless it had a clutch moment first

Things that ARE NOT viral:
- routine kills with full HP and no chaos around
- ally kills the player did not contribute to
- early-wave easy fights with low threat
- match_end loss with no nearby clutch event

Output JSON only:
{ "moments": [{ "eventIndex": number, "score": number, "label": string, "reason": string }] }

No markdown, no prose.`;

export function mockDetectViralMoments(
	events: GameEvent[],
	_snapshots: FeatureSnapshot[],
): ViralMoment[] {
	const kept: ViralMoment[] = [];
	for (let i = 0; i < events.length; i++) {
		const e = events[i];
		if (!e) continue;
		let score = 0;
		let label = "";
		let reason = "";
		if (e.kind === "kill") {
			score = 25;
			const hpFrac = e.killerHp / e.killerMaxHp;
			if (hpFrac < 0.25) {
				score += 45;
				label = "1HP CLUTCH";
				reason = `kill landed at ${Math.round(hpFrac * 100)}% HP.`;
			}
			if (e.chainSeconds < 2) {
				score += 30;
				label = label || "RAPID FIRE";
				reason = reason || `chained ${e.chainSeconds.toFixed(1)}s after last kill.`;
			} else if (e.chainSeconds < 4) {
				score += 15;
			}
			if (e.range > 400) {
				score += 20;
				label = label || "CROSS MAP";
				reason = reason || `${Math.round(e.range)}px line of fire.`;
			}
			if (e.victimKind === "brute") {
				score += 15;
				label = label || "BRUTE DOWN";
				reason = reason || "took down the heavy.";
			}
		} else if (e.kind === "low_hp_save") {
			score = 85;
			label = "JUST BARELY";
			reason = `survived the window at ${e.hpAfter}hp.`;
		} else if (e.kind === "long_shot") {
			score = 75;
			label = "LONG RANGE";
			reason = `${Math.round(e.range)}px tap.`;
		} else if (e.kind === "match_end") {
			if (e.result === "win") {
				score = 80;
				label = "WIN SECURED";
				reason = "match closed out.";
			}
		}
		if (score >= VIRAL_THRESHOLD) {
			kept.push({
				eventIndex: i,
				score: Math.min(100, score),
				label: label || "BIG MOMENT",
				reason: reason || "passed threshold.",
			});
		}
	}
	return kept;
}

export async function detectViralMoments(
	events: GameEvent[],
	snapshots: FeatureSnapshot[],
): Promise<ViralMoment[]> {
	const groqKey = process.env.GROQ_API_KEY;
	if (!groqKey) return mockDetectViralMoments(events, snapshots);

	try {
		const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${groqKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "llama-3.3-70b-versatile",
				temperature: 0.3,
				max_tokens: 900,
				response_format: { type: "json_object" },
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{
						role: "user",
						content: JSON.stringify({ events, snapshots }),
					},
				],
			}),
		});
		if (!res.ok) throw new Error(`groq ${res.status}: ${await res.text()}`);
		const json = (await res.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
		};
		const content = json.choices?.[0]?.message?.content ?? "{}";
		const parsed = JSON.parse(content) as { moments?: ViralMoment[] };
		const kept = (parsed.moments ?? []).filter(
			(m) =>
				m &&
				typeof m.eventIndex === "number" &&
				m.eventIndex >= 0 &&
				m.eventIndex < events.length &&
				typeof m.score === "number" &&
				m.score >= VIRAL_THRESHOLD &&
				typeof m.label === "string" &&
				typeof m.reason === "string",
		);
		return kept;
	} catch (err) {
		console.warn(
			"[viral] groq detect failed, falling back to mock:",
			err instanceof Error ? err.message : err,
		);
		return mockDetectViralMoments(events, snapshots);
	}
}
