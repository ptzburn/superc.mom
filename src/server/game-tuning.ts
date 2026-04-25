import { promises as fs } from "node:fs";
import path from "node:path";

const GAME_FILE = path.join(process.cwd(), "src", "app", "game", "_components", "game.tsx");

const PARAM_TO_CONST: Record<string, string> = {
	BULLET_DAMAGE: "BULLET_DAMAGE",
	PLAYER_BULLET_DAMAGE: "BULLET_DAMAGE",
	ALLY_BULLET_DAMAGE: "ALLY_BULLET_DAMAGE",
	RUNNER_CHANCE: "RUNNER_CHANCE",
	BRUTE_CHANCE: "BRUTE_CHANCE",
	ALLY_MAX_HP: "ALLY_MAX_HP",
	PLAYER_MAX_HP: "PLAYER_MAX_HP",
	PLAYER_FIRE_RATE: "PLAYER_FIRE_RATE",
	ALLY_FIRE_RATE: "ALLY_FIRE_RATE",
	BULLET_SPEED: "BULLET_SPEED",
};

export async function applySuggestionToGameCode(input: {
	gameSlug: string;
	param: string;
	suggested: string | number;
}) {
	if (input.gameSlug !== "game") {
		return { ok: false as const, error: "Apply is currently supported for /game only." };
	}

	const mappedConst = PARAM_TO_CONST[input.param];
	if (!mappedConst) {
		return {
			ok: false as const,
			error: `Unsupported param '${input.param}' for auto-apply.`,
		};
	}

	const numeric = Number(input.suggested);
	if (!Number.isFinite(numeric)) {
		return {
			ok: false as const,
			error: `Suggested value '${input.suggested}' is not a number.`,
		};
	}

	const file = await fs.readFile(GAME_FILE, "utf8");
	const matcher = new RegExp(`(const\\s+${mappedConst}\\s*=\\s*)([^;]+)(;)`);
	if (!matcher.test(file)) {
		return {
			ok: false as const,
			error: `Could not find constant ${mappedConst} in game file.`,
		};
	}

	const next = file.replace(matcher, `$1${numeric}$3`);
	await fs.writeFile(GAME_FILE, next, "utf8");

	return {
		ok: true as const,
		updatedConstant: mappedConst,
		updatedValue: numeric,
	};
}
