export const ARENA_W = 960;
export const ARENA_H = 600;
export const PLAYER_RADIUS = 24;
export const ALLY_RADIUS = 22;
export const PLAYER_SPEED = 250;
export const ALLY_SPEED = 220;
export const PLAYER_FIRE_RATE = 0.18;
export const ALLY_FIRE_RATE = 0.55;
export const ALLY_AIM_RANGE = 340;
export const ALLY_IDEAL_RANGE = 140;
export const ALLY_LEASH = 320;
export const ALLY_SEPARATION = ALLY_RADIUS * 3;
export const BULLET_SPEED = 760;
export const BULLET_DAMAGE = 11;
export const ALLY_BULLET_DAMAGE = 7;
export const RUNNER_CHANCE = 0.26;
export const BRUTE_CHANCE = 0.12;
export const PLAYER_MAX_HP = 100;
export const ALLY_MAX_HP = 70;
export const WAVE_BREAK_SECONDS = 2;

/** Canvas + overlay typography (Brawl-style chunky UI; matches game/layout Fredoka) */
export const BR_FONT =
	"800 52px ui-rounded, 'Fredoka', 'Segoe UI Rounded', 'Arial Rounded MT Bold', 'Helvetica Rounded', sans-serif";

/** Brawl-style thick ink outline (cel / toy look) */
export const BRAWL_OUT = "#0f1a2c";
export const BRAWL_OUTW = 2.6;
export const BRAWL_OUT_SOFT = 1.5;

export const PLAYER_GOP_SKIN = {
	armor: "#3a3d44",
	armorHighlight: "#6a6f78",
	cape: "#d82020",
	capeInner: "#f0f0f0",
} as const;
