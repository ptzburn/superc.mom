import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { mockEditPlan } from "./mock";
import type { EditPlan, GameEvent } from "./types";

export type { EditPlan, GameEvent } from "./types";
export { mockEditPlan } from "./mock";

const SHOT_SCHEMA = z.object({
	eventIndex: z.number().int().nonnegative(),
	caption: z.string().min(1),
	lengthMs: z.number().int().min(2000).max(4500),
	transition: z.enum(["cut", "whip", "flash", "glitch"]).optional(),
});

const EDIT_PLAN_SCHEMA = z.object({
	mood: z.enum(["hype", "menacing", "cocky", "comeback"]),
	audio: z.enum(["phonk_hype", "phonk_menacing", "phonk_cocky"]),
	hook: z.string().min(1),
	shots: z.array(SHOT_SCHEMA).min(3).max(6),
	outro: z.string().min(1),
});

export const SYSTEM_PROMPT = `You are a TikTok-native edit director for a top-down brawler game. You take a list of scored gameplay events and turn them into a tight, high-energy short-form video plan.

OUTPUT FORMAT
You MUST return ONLY a single JSON object. No prose, no markdown fences, no explanations.

The JSON must match this exact schema:
{
  "mood": "hype" | "menacing" | "cocky" | "comeback",
  "audio": "phonk_hype" | "phonk_menacing" | "phonk_cocky",
  "hook": string,
  "shots": [
    {
      "eventIndex": number,
      "caption": string,
      "lengthMs": number,
      "transition": "cut" | "whip" | "flash" | "glitch"
    }
  ],
  "outro": string
}

HARD RULES
- "shots" must contain between 3 and 6 entries.
- Sum of all "lengthMs" must be between 12000 and 22000 (12s to 22s total runtime).
- Each individual "lengthMs" must be between 2000 and 4500.
- "eventIndex" is the 0-based index into the input events array. Only reference events that exist.
- Order shots chronologically by the underlying event time (t).
- "hook" is a 3-7 word opener line that pops on screen at t=0.
- "outro" is a CTA, max 6 words.
- Every "caption" must be CapCut-style and contain EXACTLY ONE [BRACKETED ACCENT] substring.
- Captions are short (under ~6 words). Examples: "[FIRST] DOWN", "still on [1HP]", "[3 SHOTS]. 3 down.", "[600M] dot".

MOOD SELECTION
- "hype": clean dominant win, multiple kills.
- "cocky": low effort win, fast chains, one-tap energy.
- "menacing": loss, or a dark / clutch-but-grim tone.
- "comeback": team eats deaths/low HP first, then wins.

AUDIO SELECTION
- mood "hype" or "comeback" -> "phonk_hype"
- mood "menacing" -> "phonk_menacing"
- mood "cocky" -> "phonk_cocky"

SHOT SELECTION
- Pick the 3-6 most viral events by score and impact. Skip filler.
- Open on a strong moment (kill, low_hp_save, long_shot). Close on match_end if it pops.
- Use "transition" to add motion: "whip" for fast chains, "flash" for long shots, "glitch" for clutch saves, "cut" otherwise.

Remember: respond with raw JSON only.`;

function extractJson(text: string): string {
	const trimmed = text.trim();
	// Strip ```json ... ``` fences if the model added them despite instructions.
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenced?.[1]) return fenced[1].trim();
	// Otherwise grab the largest {...} block.
	const first = trimmed.indexOf("{");
	const last = trimmed.lastIndexOf("}");
	if (first !== -1 && last !== -1 && last > first) {
		return trimmed.slice(first, last + 1);
	}
	return trimmed;
}

/**
 * Validate the AI plan against the schema and the cross-field invariants
 * (total runtime, eventIndex bounds, exactly-one-bracket caption rule).
 */
function validatePlan(raw: unknown, eventsLength: number): EditPlan {
	const parsed = EDIT_PLAN_SCHEMA.parse(raw);

	const totalMs = parsed.shots.reduce((acc, s) => acc + s.lengthMs, 0);
	if (totalMs < 12000 || totalMs > 22000) {
		throw new Error(
			`total runtime ${totalMs}ms outside [12000, 22000]`,
		);
	}

	for (const shot of parsed.shots) {
		if (shot.eventIndex >= eventsLength) {
			throw new Error(
				`eventIndex ${shot.eventIndex} >= events length ${eventsLength}`,
			);
		}
		const matches = shot.caption.match(/\[[^\]]+\]/g);
		if (!matches || matches.length !== 1) {
			throw new Error(
				`caption ${JSON.stringify(shot.caption)} must contain exactly one [bracketed] accent`,
			);
		}
	}

	if (parsed.outro.split(/\s+/).filter(Boolean).length > 6) {
		throw new Error(`outro ${JSON.stringify(parsed.outro)} exceeds 6 words`);
	}

	return parsed;
}

async function callGroq(events: GameEvent[]): Promise<EditPlan> {
	const apiKey = process.env.GROQ_API_KEY;
	if (!apiKey) throw new Error("no GROQ_API_KEY");

	const userPayload = {
		events: events.map((e, i) => ({ index: i, ...e })),
		eventCount: events.length,
	};

	const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "llama-3.3-70b-versatile",
			temperature: 0.7,
			max_tokens: 700,
			response_format: { type: "json_object" },
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{
					role: "user",
					content: `Here are the scored gameplay events. Return the edit plan JSON only.\n\n${JSON.stringify(userPayload)}`,
				},
			],
		}),
	});

	if (!res.ok) {
		throw new Error(`groq ${res.status}: ${await res.text()}`);
	}
	const json = (await res.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	const content = json.choices?.[0]?.message?.content;
	if (!content) throw new Error("no content in Groq response");

	const jsonText = extractJson(content);
	const parsed = JSON.parse(jsonText);
	return validatePlan(parsed, events.length);
}

async function callAnthropic(events: GameEvent[]): Promise<EditPlan> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error("no ANTHROPIC_API_KEY");

	const client = new Anthropic({ apiKey });

	const userPayload = {
		events: events.map((e, i) => ({ index: i, ...e })),
		eventCount: events.length,
	};

	const response = await client.messages.create({
		model: "claude-haiku-4-5-20251001",
		max_tokens: 700,
		system: [
			{
				type: "text",
				text: SYSTEM_PROMPT,
				cache_control: { type: "ephemeral" },
			},
		],
		messages: [
			{
				role: "user",
				content: `Here are the scored gameplay events. Return the edit plan JSON only.\n\n${JSON.stringify(userPayload)}`,
			},
		],
	});

	const textBlock = response.content.find(
		(b): b is Extract<typeof b, { type: "text" }> => b.type === "text",
	);
	if (!textBlock) throw new Error("no text block in Claude response");

	const jsonText = extractJson(textBlock.text);
	const parsed = JSON.parse(jsonText);
	return validatePlan(parsed, events.length);
}

/**
 * Produce a TikTok edit plan for a list of scored gameplay events.
 *
 * Provider preference: GROQ_API_KEY > ANTHROPIC_API_KEY > deterministic mock.
 * Falls back to the mock on any network/validation failure.
 */
export async function getEditPlan(events: GameEvent[]): Promise<EditPlan> {
	if (process.env.GROQ_API_KEY) {
		try { return await callGroq(events); }
		catch (err) {
			console.warn(
				"[ai-editor] groq failed, trying next provider:",
				err instanceof Error ? err.message : err,
			);
		}
	}
	if (process.env.ANTHROPIC_API_KEY) {
		try { return await callAnthropic(events); }
		catch (err) {
			console.warn(
				"[ai-editor] anthropic failed, falling back to mock:",
				err instanceof Error ? err.message : err,
			);
		}
	}
	return mockEditPlan(events);
}
