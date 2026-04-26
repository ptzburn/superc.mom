import type { FeatureSnapshot } from "~/lib/ai-editor/viral";
import type { SfxEngine } from "./sfx";

export type ThemePack = {
	arena: HTMLImageElement;
	enemy: HTMLImageElement;
	ally: HTMLImageElement;
};

export type Vec = { x: number; y: number };

export type Bullet = {
	pos: Vec;
	vel: Vec;
	startPos: Vec;
	damage: number;
	ttl: number;
	team: "player" | "ally";
	owner: string;
};

export type ZombieType = "walker" | "runner" | "brute";

export type Zombie = {
	pos: Vec;
	vel: Vec;
	hp: number;
	maxHp: number;
	speed: number;
	radius: number;
	damage: number;
	type: ZombieType;
	hitFlash: number;
	wobble: number;
};

export type Ally = {
	pos: Vec;
	hp: number;
	maxHp: number;
	angle: number;
	cooldown: number;
	alive: boolean;
	respawnTimer: number;
	followOffset: Vec;
	/** Elephant hide (dark / light gray) */
	armor: string;
	armorHighlight: string;
	/** Cap red + white panel; also used for ear pink/tusk hi */
	cape: string;
	capeInner: string;
	hitFlash: number;
};

export type Player = {
	pos: Vec;
	hp: number;
	maxHp: number;
	angle: number;
	cooldown: number;
	hitFlash: number;
};

export type Particle = {
	pos: Vec;
	vel: Vec;
	life: number;
	maxLife: number;
	color: string;
	size: number;
};

export type FloatingText = {
	pos: Vec;
	vel: Vec;
	text: string;
	life: number;
	color: string;
};

export type Obstacle =
	| { kind: "crate"; x: number; y: number; w: number; h: number }
	| { kind: "sandbag"; x: number; y: number; w: number; h: number }
	| { kind: "barrel"; x: number; y: number; r: number };

export type Phase = "menu" | "playing" | "gameover";

export type GameRuntime = {
	phase: Phase;
	player: Player;
	allies: Ally[];
	zombies: Zombie[];
	bullets: Bullet[];
	particles: Particle[];
	texts: FloatingText[];
	obstacles: Obstacle[];
	wave: number;
	zombiesToSpawn: number;
	spawnTimer: number;
	waveBreak: number;
	bannerText: string;
	bannerTime: number;
	bannerMaxTime: number;
	kills: number;
	shakeTime: number;
	shakeMag: number;
	keys: Set<string>;
	mouse: Vec;
	shooting: boolean;
	paused: boolean;
	sfx: SfxEngine | null;
	events: GameEvent[];
	matchStartMs: number;
	lastPlayerKillMs: number;
	lowHpFlaggedAt: number;
	snapshots: FeatureSnapshot[];
	lastSnapshotMs: number;
	bucketKills: number;
	bucketHits: number;
	bucketShots: number;
};

export type GameEvent =
	| {
			kind: "kill";
			t: number;
			killer: string;
			victim: string;
			killerHp: number;
			killerMaxHp: number;
			victimKind: string;
			range: number;
			chainSeconds: number;
	  }
	| { kind: "ally_kill"; t: number; killer: string; victim: string }
	| { kind: "ally_death"; t: number; victim: string }
	| { kind: "low_hp_save"; t: number; subject: string; hpAfter: number }
	| { kind: "long_shot"; t: number; killer: string; range: number }
	| {
			kind: "match_end";
			t: number;
			result: "win" | "loss";
			durationMs: number;
	  };

export type ZombieTarget =
	| { pos: Vec; isPlayer: true }
	| { pos: Vec; isPlayer: false; ally: Ally };

export type DrawItem = { y: number; draw: () => void };
