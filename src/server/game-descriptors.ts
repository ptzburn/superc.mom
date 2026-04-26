type GameDescriptor = {
	title: string;
	genre: string;
	mechanics: string;
	tunableParams: string[];
	/** Label for the "wave" metric in the dashboard. E.g. "Wave Reached" or "Result" */
	waveLabel: string;
	/** Path to the source file containing tunable constants, relative to cwd */
	sourceFile: string;
	/** Maps AI suggestion param names to source-code constant names */
	paramToConst: Record<string, string>;
};

const GAME_DESCRIPTORS: Record<string, GameDescriptor> = {
	"brown-stacks": {
		title: "Brown Stacks",
		genre: "a wave-based arena shooter",
		mechanics: `- Player + 3 allies vs endless zombie waves
- Zombies per wave: 5 + wave * 4
- Walker: hp=30+wave*6, speed=75+wave*3.5 (base enemy)
- Runner (wave 3+, 26% chance): hp=18+wave*3, speed=145+wave*4
- Brute (wave 2+, 12% chance): hp=110+wave*18, speed=48+wave*1.4
- Player bullet damage: 11  |  Ally bullet damage: 7
- Player max HP: 100  |  Ally max HP: 70
- Spawn rate: 0.6s initially, reduces to 0.12s minimum
- Wave break: 2s between waves`,
		tunableParams: [
			"BULLET_DAMAGE",
			"ALLY_BULLET_DAMAGE",
			"RUNNER_CHANCE",
			"BRUTE_CHANCE",
			"ALLY_MAX_HP",
			"PLAYER_MAX_HP",
			"PLAYER_FIRE_RATE",
			"ALLY_FIRE_RATE",
			"BULLET_SPEED",
			"PLAYER_SPEED",
			"ALLY_SPEED",
			"WAVE_BREAK_SECONDS",
		],
		waveLabel: "Wave Reached",
		sourceFile: "src/app/brown-stacks/_components/constants.ts",
		paramToConst: {
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
			PLAYER_SPEED: "PLAYER_SPEED",
			ALLY_SPEED: "ALLY_SPEED",
			WAVE_BREAK_SECONDS: "WAVE_BREAK_SECONDS",
		},
	},
};

const FALLBACK_DESCRIPTOR: GameDescriptor = {
	title: "Unknown Game",
	genre: "an unknown game type",
	mechanics:
		"No specific mechanics data available. Analyze based on telemetry patterns only.",
	tunableParams: [],
	waveLabel: "Wave Reached",
	sourceFile: "",
	paramToConst: {},
};

export function getGameDescriptor(gameSlug: string): GameDescriptor {
	return GAME_DESCRIPTORS[gameSlug] ?? FALLBACK_DESCRIPTOR;
}

export type { GameDescriptor };
