import {
	ALLY_MAX_HP,
	ALLY_RADIUS,
	ARENA_H,
	ARENA_W,
	PLAYER_MAX_HP,
	PLAYER_RADIUS,
} from "./constants";
import type { Ally, GameRuntime, Obstacle, Vec } from "./types";
import { clamp, rand } from "./utils";

export function obstacleBox(o: Obstacle) {
	if (o.kind === "barrel") {
		return { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 };
	}
	return { x: o.x, y: o.y, w: o.w, h: o.h };
}

export function obstacleBottomY(o: Obstacle) {
	if (o.kind === "barrel") return o.y + o.r;
	return o.y + o.h;
}

function rectsOverlap(
	a: { x: number; y: number; w: number; h: number },
	b: { x: number; y: number; w: number; h: number },
	pad: number,
) {
	return (
		a.x - pad < b.x + b.w &&
		a.x + a.w + pad > b.x &&
		a.y - pad < b.y + b.h &&
		a.y + a.h + pad > b.y
	);
}

export function generateObstacles(): Obstacle[] {
	const obstacles: Obstacle[] = [];
	const cx = ARENA_W / 2;
	const cy = ARENA_H / 2;
	const minDistFromCenter = 150;
	let attempts = 0;
	while (obstacles.length < 11 && attempts < 200) {
		attempts++;
		const roll = Math.random();
		let candidate: Obstacle;
		if (roll < 0.4) {
			const horizontal = Math.random() < 0.5;
			const w = horizontal ? rand(70, 130) : rand(28, 36);
			const h = horizontal ? rand(28, 36) : rand(70, 130);
			candidate = {
				kind: "sandbag",
				x: rand(60, ARENA_W - 60 - w),
				y: rand(60, ARENA_H - 60 - h),
				w,
				h,
			};
		} else if (roll < 0.78) {
			const s = rand(36, 56);
			candidate = {
				kind: "crate",
				x: rand(60, ARENA_W - 60 - s),
				y: rand(60, ARENA_H - 60 - s),
				w: s,
				h: s,
			};
		} else {
			const r = rand(15, 22);
			candidate = {
				kind: "barrel",
				x: rand(80, ARENA_W - 80),
				y: rand(80, ARENA_H - 80),
				r,
			};
		}
		const box = obstacleBox(candidate);
		const closestX = clamp(cx, box.x, box.x + box.w);
		const closestY = clamp(cy, box.y, box.y + box.h);
		if (Math.hypot(cx - closestX, cy - closestY) < minDistFromCenter) continue;
		let collides = false;
		for (const other of obstacles) {
			if (rectsOverlap(box, obstacleBox(other), 28)) {
				collides = true;
				break;
			}
		}
		if (collides) continue;
		obstacles.push(candidate);
	}
	return obstacles;
}

export function resolveObstacleCollision(
	pos: Vec,
	radius: number,
	obstacles: Obstacle[],
) {
	for (const o of obstacles) {
		if (o.kind === "barrel") {
			const dx = pos.x - o.x;
			const dy = pos.y - o.y;
			const d = Math.hypot(dx, dy);
			const min = radius + o.r;
			if (d < min) {
				if (d === 0) {
					pos.x += min;
				} else {
					pos.x = o.x + (dx / d) * min;
					pos.y = o.y + (dy / d) * min;
				}
			}
		} else {
			const closestX = clamp(pos.x, o.x, o.x + o.w);
			const closestY = clamp(pos.y, o.y, o.y + o.h);
			const dx = pos.x - closestX;
			const dy = pos.y - closestY;
			const d = Math.hypot(dx, dy);
			if (d < radius) {
				if (d === 0) {
					const ocx = o.x + o.w / 2;
					const ocy = o.y + o.h / 2;
					if (Math.abs(pos.x - ocx) > Math.abs(pos.y - ocy)) {
						pos.x = pos.x >= ocx ? o.x + o.w + radius : o.x - radius;
					} else {
						pos.y = pos.y >= ocy ? o.y + o.h + radius : o.y - radius;
					}
				} else {
					pos.x = closestX + (dx / d) * radius;
					pos.y = closestY + (dy / d) * radius;
				}
			}
		}
	}
}

export function bulletHitsObstacle(pos: Vec, obstacles: Obstacle[]) {
	for (const o of obstacles) {
		if (o.kind === "barrel") {
			const dx = pos.x - o.x;
			const dy = pos.y - o.y;
			if (dx * dx + dy * dy < o.r * o.r) return true;
		} else if (
			pos.x >= o.x &&
			pos.x <= o.x + o.w &&
			pos.y >= o.y &&
			pos.y <= o.y + o.h
		) {
			return true;
		}
	}
	return false;
}

/** Elephant hide + cap tints (armor = dark gray, highlight = flanks) */
export function createSquad(): Ally[] {
	return [
		{
			pos: { x: ARENA_W / 2 - 60, y: ARENA_H / 2 + 30 },
			hp: ALLY_MAX_HP,
			maxHp: ALLY_MAX_HP,
			angle: 0,
			cooldown: 0,
			alive: true,
			respawnTimer: 0,
			followOffset: { x: -55, y: 35 },
			armor: "#3a3d44",
			armorHighlight: "#6a6f78",
			cape: "#d82020",
			capeInner: "#f0f0f0",
			hitFlash: 0,
		},
		{
			pos: { x: ARENA_W / 2 + 60, y: ARENA_H / 2 + 30 },
			hp: ALLY_MAX_HP,
			maxHp: ALLY_MAX_HP,
			angle: 0,
			cooldown: 0,
			alive: true,
			respawnTimer: 0,
			followOffset: { x: 55, y: 35 },
			armor: "#2a2e34",
			armorHighlight: "#5a5e68",
			cape: "#c01818",
			capeInner: "#faf8f2",
			hitFlash: 0,
		},
		{
			pos: { x: ARENA_W / 2, y: ARENA_H / 2 + 60 },
			hp: ALLY_MAX_HP,
			maxHp: ALLY_MAX_HP,
			angle: 0,
			cooldown: 0,
			alive: true,
			respawnTimer: 0,
			followOffset: { x: 0, y: 60 },
			armor: "#333840",
			armorHighlight: "#5c6470",
			cape: "#e03028",
			capeInner: "#ffffff",
			hitFlash: 0,
		},
	];
}

export function createInitialState(): GameRuntime {
	return {
		phase: "menu",
		player: {
			pos: { x: ARENA_W / 2, y: ARENA_H / 2 },
			hp: PLAYER_MAX_HP,
			maxHp: PLAYER_MAX_HP,
			angle: -Math.PI / 2,
			cooldown: 0,
			hitFlash: 0,
		},
		allies: createSquad(),
		zombies: [],
		bullets: [],
		particles: [],
		texts: [],
		obstacles: generateObstacles(),
		wave: 0,
		zombiesToSpawn: 0,
		spawnTimer: 0,
		waveBreak: 0,
		bannerText: "",
		bannerTime: 0,
		bannerMaxTime: 1,
		kills: 0,
		shakeTime: 0,
		shakeMag: 0,
		keys: new Set(),
		mouse: { x: ARENA_W / 2, y: ARENA_H / 2 - 80 },
		shooting: false,
		paused: false,
		sfx: null,
		events: [],
		matchStartMs: performance.now(),
		lastPlayerKillMs: -Infinity,
		lowHpFlaggedAt: -1,
		snapshots: [],
		lastSnapshotMs: 0,
		bucketKills: 0,
		bucketHits: 0,
		bucketShots: 0,
	};
}
