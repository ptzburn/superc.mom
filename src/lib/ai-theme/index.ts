import { z } from "zod";

export type MusicMood = "phonk_cocky" | "phonk_hype" | "phonk_menacing";

const DATA_URL = z.string().regex(/^data:image\/(png|jpeg|webp);base64,/);

export const THEME_ART_SCHEMA = z.object({
	label: z.string().min(1).max(40),
	musicMood: z.enum(["phonk_cocky", "phonk_hype", "phonk_menacing"]),
	arena: DATA_URL,
	enemy: DATA_URL,
	ally: DATA_URL,
});

export type ThemeArt = z.infer<typeof THEME_ART_SCHEMA>;

const SAFETY_PREFIX = "Stylized game art, no real people: ";

const ARENA_PROMPT =
	"Seamless top-down battle arena ground, cartoon brawler, readable surface, no characters, no UI, no text: ";

const SPRITE_PROMPT =
	"One single game character sprite, top-down view, centered on canvas, " +
	"filling 85% of the frame. Chunky bold black outline, vibrant colors, " +
	"Brawl Stars / Clash Royale art style. Transparent background. ";

const SPRITE_SUFFIX: Record<"enemy" | "ally", string> = {
	enemy: "This is an ENEMY unit. Menacing, aggressive pose. ",
	ally: "This is a friendly ALLY unit. Heroic, protective pose. ",
};

type ThemeRole = "arena" | "enemy" | "ally";

async function openaiImage(role: ThemeRole, userPrompt: string): Promise<string> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) throw new Error("no OPENAI_API_KEY");

	const trimmed = userPrompt.trim().slice(0, 300);

	const body =
		role === "arena"
			? {
					model: "dall-e-2",
					prompt: `${SAFETY_PREFIX}${ARENA_PROMPT}${trimmed}`.slice(0, 990),
					n: 1,
					size: "256x256",
					response_format: "b64_json",
				}
			: {
					model: "gpt-image-1",
					prompt: `${SAFETY_PREFIX}${SPRITE_PROMPT}${SPRITE_SUFFIX[role]}${trimmed}`,
					n: 1,
					size: "1024x1024",
					quality: "low",
					background: "transparent",
					output_format: "png",
				};

	const res = await fetch("https://api.openai.com/v1/images/generations", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		throw new Error(`openai ${role} ${res.status}: ${await res.text()}`);
	}
	const json = (await res.json()) as {
		data?: Array<{ b64_json?: string }>;
	};
	const b64 = json.data?.[0]?.b64_json;
	if (!b64) throw new Error(`no image data returned for ${role}`);
	return `data:image/png;base64,${b64}`;
}

/** Deterministic mood pick from prompt keywords — avoids an extra LLM round-trip. */
function pickMoodFromText(text: string): MusicMood {
	const lower = text.toLowerCase();
	if (
		/(neon|hype|fire|cyber|electric|chrome|miami|gold|disco|laser)/.test(lower)
	)
		return "phonk_hype";
	if (
		/(dark|grim|abyss|shadow|necro|blood|horror|crypt|ruin|cursed|hell)/.test(
			lower,
		)
	)
		return "phonk_menacing";
	return "phonk_cocky";
}

function pickLabel(arena: string): string {
	const words = arena
		.split(/[\s,.;:!?]+/)
		.filter(Boolean)
		.slice(0, 3)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
	return words.join(" ").slice(0, 40) || "Custom Theme";
}

/**
 * Generate the three sprite/background images in parallel.
 * Throws if OPENAI_API_KEY is missing or any image generation fails.
 */
export async function getThemeArt(
	arena: string,
	enemy: string,
	ally: string,
): Promise<ThemeArt> {
	if (!process.env.OPENAI_API_KEY) {
		throw new Error("OPENAI_API_KEY is not set — add it to use AI themes.");
	}
	const [arenaUrl, enemyUrl, allyUrl] = await Promise.all([
		openaiImage("arena", arena),
		openaiImage("enemy", enemy),
		openaiImage("ally", ally),
	]);
	return {
		label: pickLabel(arena),
		musicMood: pickMoodFromText(`${arena} ${enemy} ${ally}`),
		arena: arenaUrl,
		enemy: enemyUrl,
		ally: allyUrl,
	};
}
