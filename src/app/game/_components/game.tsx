"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createMusicEngine, type MusicEngine } from "./music";
import { createSfxEngine, type SfxEngine } from "./sfx";

const ARENA_W = 960;
const ARENA_H = 600;
const PLAYER_RADIUS = 24;
const ALLY_RADIUS = 22;
const PLAYER_SPEED = 250;
const ALLY_SPEED = 220;
const PLAYER_FIRE_RATE = 0.18;
const ALLY_FIRE_RATE = 0.55;
const ALLY_AIM_RANGE = 340;
const ALLY_IDEAL_RANGE = 140;
const ALLY_LEASH = 320;
const ALLY_SEPARATION = ALLY_RADIUS * 3;
const BULLET_SPEED = 760;
const BULLET_DAMAGE = 11;
const ALLY_BULLET_DAMAGE = 7;
const RUNNER_CHANCE = 0.26;
const BRUTE_CHANCE = 0.12;
const PLAYER_MAX_HP = 100;
const ALLY_MAX_HP = 70;
const WAVE_BREAK_SECONDS = 2;

/** Canvas + overlay typography (Brawl-style chunky UI; matches game/layout Fredoka) */
const BR_FONT =
	"800 52px ui-rounded, 'Fredoka', 'Segoe UI Rounded', 'Arial Rounded MT Bold', 'Helvetica Rounded', sans-serif";

type Vec = { x: number; y: number };

type Bullet = {
	pos: Vec;
	vel: Vec;
	damage: number;
	ttl: number;
	team: "player" | "ally";
};

type ZombieType = "walker" | "runner" | "brute";

type Zombie = {
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

type Ally = {
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

type Player = {
	pos: Vec;
	hp: number;
	maxHp: number;
	angle: number;
	cooldown: number;
	hitFlash: number;
};

type Particle = {
	pos: Vec;
	vel: Vec;
	life: number;
	maxLife: number;
	color: string;
	size: number;
};

type FloatingText = {
	pos: Vec;
	vel: Vec;
	text: string;
	life: number;
	color: string;
};

type Obstacle =
	| { kind: "crate"; x: number; y: number; w: number; h: number }
	| { kind: "sandbag"; x: number; y: number; w: number; h: number }
	| { kind: "barrel"; x: number; y: number; r: number };

type Phase = "menu" | "playing" | "gameover";

type GameRuntime = {
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
};

function clamp(n: number, min: number, max: number) {
	return Math.min(Math.max(n, min), max);
}

/** Lighter on top/forward, darker on bottom — reads as 3D on an ellipse (top-down). */
function createBlobGradient(
	ctx: CanvasRenderingContext2D,
	ox: number,
	oy: number,
	rx: number,
	ry: number,
	light: string,
	mid: string,
	dark: string,
) {
	const g = ctx.createRadialGradient(
		ox - rx * 0.4,
		oy - ry * 0.5,
		Math.min(rx, ry) * 0.08,
		ox,
		oy,
		Math.max(rx, ry) * 1.05,
	);
	g.addColorStop(0, light);
	g.addColorStop(0.5, mid);
	g.addColorStop(1, dark);
	return g;
}

/** Brawl-style thick ink outline (cel / toy look) */
const BRAWL_OUT = "#0f1a2c";
const BRAWL_OUTW = 2.6;
const BRAWL_OUT_SOFT = 1.5;

/** Top-down polymer handgun: barrel along +x from origin. `L` = overall length. */
function drawHandgunTopDown(ctx: CanvasRenderingContext2D, L: number) {
	const sw = L * 0.14;
	const s0 = L * 0.08;
	const s1 = L * 0.66;
	// slide (stainless)
	const mGrad = ctx.createLinearGradient(0, -sw, 0, sw);
	mGrad.addColorStop(0, "#d0d8e0");
	mGrad.addColorStop(0.35, "#7a8694");
	mGrad.addColorStop(0.7, "#3a4048");
	mGrad.addColorStop(1, "#101418");
	ctx.beginPath();
	ctx.roundRect(s0, -sw, s1 - s0, sw * 2, L * 0.025);
	ctx.fillStyle = mGrad;
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 0.85;
	ctx.stroke();
	// ejection / slide lines
	for (let i = 0; i < 3; i++) {
		const x = s0 + 4 + i * 3.5;
		ctx.beginPath();
		ctx.moveTo(x, -sw * 0.55);
		ctx.lineTo(x + 0.6, -sw * 0.15);
		ctx.strokeStyle = "rgba(0,0,0,0.28)";
		ctx.lineWidth = 0.4;
		ctx.stroke();
	}
	// muzzle
	ctx.beginPath();
	ctx.ellipse(s1, 0, L * 0.04, sw * 0.55, 0, 0, Math.PI * 2);
	const mug = ctx.createRadialGradient(s1, 0, 0, s1, 0, L * 0.05);
	mug.addColorStop(0, "#2a2a2a");
	mug.addColorStop(0.5, "#0a0a0a");
	mug.addColorStop(1, "#000000");
	ctx.fillStyle = mug;
	ctx.fill();
	ctx.beginPath();
	ctx.arc(s1 + L * 0.03, 0, L * 0.018, 0, Math.PI * 2);
	ctx.fillStyle = "rgba(0,0,0,0.75)";
	ctx.fill();
	// front sight
	ctx.fillStyle = "#0a0a0a";
	ctx.fillRect(s1 - 0.3, -sw * 0.85, 1, sw * 0.4);
	// frame
	ctx.beginPath();
	ctx.moveTo(s0, sw);
	ctx.lineTo(s0 - L * 0.12, L * 0.2);
	ctx.lineTo(s0 - L * 0.04, L * 0.32);
	ctx.lineTo(s0 + L * 0.2, L * 0.12);
	ctx.closePath();
	const fgrad = ctx.createLinearGradient(0, 0, 0, L * 0.3);
	fgrad.addColorStop(0, "#3a3d42");
	fgrad.addColorStop(1, "#0c0d10");
	ctx.fillStyle = fgrad;
	ctx.fill();
	ctx.stroke();
	// trigger guard
	ctx.beginPath();
	ctx.arc(s0 + L * 0.3, L * 0.1, L * 0.1, 0, Math.PI);
	ctx.strokeStyle = "rgba(0,0,0,0.5)";
	ctx.lineWidth = 0.6;
	ctx.stroke();
	// trigger
	ctx.beginPath();
	ctx.moveTo(s0 + L * 0.3, L * 0.12);
	ctx.quadraticCurveTo(s0 + L * 0.22, L * 0.16, s0 + L * 0.2, L * 0.1);
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 0.5;
	ctx.stroke();
	// grip
	ctx.beginPath();
	ctx.roundRect(s0 - L * 0.2, L * 0.1, L * 0.2, L * 0.2, 2);
	const gg = ctx.createLinearGradient(0, L * 0.1, 0, L * 0.32);
	gg.addColorStop(0, "#181818");
	gg.addColorStop(1, "#050505");
	ctx.fillStyle = gg;
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 0.7;
	ctx.stroke();
	// mag base plate
	ctx.fillStyle = "#2a2a2a";
	ctx.fillRect(s0 - L * 0.12, L * 0.24, L * 0.1, 1.2);
	// under-rail / accessory hint
	ctx.strokeStyle = "rgba(255,255,255,0.15)";
	ctx.lineWidth = 0.3;
	ctx.beginPath();
	ctx.moveTo(s0 + L * 0.1, sw);
	ctx.lineTo(s0 + L * 0.45, sw);
	ctx.stroke();
}

function rand(min: number, max: number) {
	return min + Math.random() * (max - min);
}

function chance(p: number) {
	return Math.random() < p;
}

function obstacleBox(o: Obstacle) {
	if (o.kind === "barrel") {
		return { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 };
	}
	return { x: o.x, y: o.y, w: o.w, h: o.h };
}

function obstacleBottomY(o: Obstacle) {
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

function generateObstacles(): Obstacle[] {
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

function resolveObstacleCollision(
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

function bulletHitsObstacle(pos: Vec, obstacles: Obstacle[]) {
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
function createSquad(): Ally[] {
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

const PLAYER_GOP_SKIN: Pick<
	Ally,
	"armor" | "armorHighlight" | "cape" | "capeInner"
> = {
	armor: "#3a3d44",
	armorHighlight: "#6a6f78",
	cape: "#d82020",
	capeInner: "#f0f0f0",
};

function createInitialState(): GameRuntime {
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
	};
}

function startWave(s: GameRuntime, wave: number) {
	s.wave = wave;
	s.zombiesToSpawn = 5 + wave * 4;
	s.spawnTimer = 0.4;
	s.bannerText = `WAVE ${wave}`;
	s.bannerTime = 2.4;
	s.bannerMaxTime = 2.4;
}

function spawnZombie(s: GameRuntime) {
	const wave = s.wave;
	const margin = 50;
	const side = Math.floor(Math.random() * 4);
	const pos: Vec =
		side === 0
			? { x: rand(0, ARENA_W), y: -margin }
			: side === 1
				? { x: ARENA_W + margin, y: rand(0, ARENA_H) }
				: side === 2
					? { x: rand(0, ARENA_W), y: ARENA_H + margin }
					: { x: -margin, y: rand(0, ARENA_H) };

	let type: ZombieType = "walker";
	let hp = 30 + wave * 6;
	let speed = 75 + wave * 3.5;
	let radius = 21;
	let damage = 14;
	const r = Math.random();
	if (wave >= 3 && r < RUNNER_CHANCE) {
		type = "runner";
		hp = 18 + wave * 3;
		speed = 145 + wave * 4;
		radius = 16;
		damage = 9;
	} else if (wave >= 2 && r < RUNNER_CHANCE + BRUTE_CHANCE) {
		type = "brute";
		hp = 110 + wave * 18;
		speed = 48 + wave * 1.4;
		radius = 32;
		damage = 24;
	}

	s.zombies.push({
		pos,
		vel: { x: 0, y: 0 },
		hp,
		maxHp: hp,
		speed,
		radius,
		damage,
		type,
		hitFlash: 0,
		wobble: Math.random() * Math.PI * 2,
	});
}

function nearestZombie(s: GameRuntime, from: Vec, maxDist: number) {
	let best: Zombie | null = null;
	let bestD = maxDist;
	for (const z of s.zombies) {
		const d = Math.hypot(z.pos.x - from.x, z.pos.y - from.y);
		if (d < bestD) {
			bestD = d;
			best = z;
		}
	}
	return best;
}

function fireBullet(
	s: GameRuntime,
	pos: Vec,
	angle: number,
	dmg: number,
	team: "player" | "ally",
) {
	const offsetR = 18;
	s.bullets.push({
		pos: {
			x: pos.x + Math.cos(angle) * offsetR,
			y: pos.y + Math.sin(angle) * offsetR,
		},
		vel: {
			x: Math.cos(angle) * BULLET_SPEED,
			y: Math.sin(angle) * BULLET_SPEED,
		},
		damage: dmg,
		ttl: 1.2,
		team,
	});
}

function spawnMuzzleFlash(s: GameRuntime, pos: Vec, angle: number) {
	for (let i = 0; i < 5; i++) {
		s.particles.push({
			pos: { x: pos.x + Math.cos(angle) * 18, y: pos.y + Math.sin(angle) * 18 },
			vel: {
				x: Math.cos(angle) * rand(80, 200) + rand(-50, 50),
				y: Math.sin(angle) * rand(80, 200) + rand(-50, 50),
			},
			life: 0.18,
			maxLife: 0.18,
			color: chance(0.5) ? "#fff2a8" : "#ffd24a",
			size: rand(2, 4.5),
		});
	}
}

function spawnBlood(s: GameRuntime, pos: Vec, count: number) {
	for (let i = 0; i < count; i++) {
		const a = Math.random() * Math.PI * 2;
		const speed = rand(40, 220);
		s.particles.push({
			pos: { x: pos.x, y: pos.y },
			vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
			life: rand(0.4, 0.9),
			maxLife: 0.9,
			color: chance(0.7) ? "#9a1313" : "#5b0c0c",
			size: rand(2, 5),
		});
	}
}

function triggerShake(s: GameRuntime, time: number, mag: number) {
	s.shakeTime = Math.max(s.shakeTime, time);
	s.shakeMag = Math.max(s.shakeMag, mag);
}

function update(s: GameRuntime, dt: number) {
	if (s.phase !== "playing" || s.paused) return;
	const d = Math.min(dt, 0.05);
	updatePlayer(s, d);
	updateAllies(s, d);
	updateZombies(s, d);
	updateBullets(s, d);
	updateParticles(s, d);
	updateTexts(s, d);
	spawnLogic(s, d);
	if (s.shakeTime > 0) s.shakeTime -= d;
	if (s.bannerTime > 0) s.bannerTime -= d;
	if (s.player.hp <= 0) {
		s.phase = "gameover";
		s.bannerText = "OVERRUN";
		s.bannerTime = 9999;
		s.bannerMaxTime = 1;
		spawnBlood(s, s.player.pos, 30);
	}
}

function updatePlayer(s: GameRuntime, dt: number) {
	const p = s.player;
	let dx = 0;
	let dy = 0;
	if (s.keys.has("w") || s.keys.has("arrowup")) dy -= 1;
	if (s.keys.has("s") || s.keys.has("arrowdown")) dy += 1;
	if (s.keys.has("a") || s.keys.has("arrowleft")) dx -= 1;
	if (s.keys.has("d") || s.keys.has("arrowright")) dx += 1;
	const m = Math.hypot(dx, dy);
	if (m > 0) {
		dx /= m;
		dy /= m;
	}
	p.pos.x = clamp(
		p.pos.x + dx * PLAYER_SPEED * dt,
		PLAYER_RADIUS,
		ARENA_W - PLAYER_RADIUS,
	);
	p.pos.y = clamp(
		p.pos.y + dy * PLAYER_SPEED * dt,
		PLAYER_RADIUS,
		ARENA_H - PLAYER_RADIUS,
	);
	resolveObstacleCollision(p.pos, PLAYER_RADIUS, s.obstacles);
	p.pos.x = clamp(p.pos.x, PLAYER_RADIUS, ARENA_W - PLAYER_RADIUS);
	p.pos.y = clamp(p.pos.y, PLAYER_RADIUS, ARENA_H - PLAYER_RADIUS);
	p.angle = Math.atan2(s.mouse.y - p.pos.y, s.mouse.x - p.pos.x);
	p.cooldown = Math.max(0, p.cooldown - dt);
	p.hitFlash = Math.max(0, p.hitFlash - dt);
	if (s.shooting && p.cooldown <= 0) {
		fireBullet(s, p.pos, p.angle, BULLET_DAMAGE, "player");
		spawnMuzzleFlash(s, p.pos, p.angle);
		s.sfx?.play("playerShoot");
		p.cooldown = PLAYER_FIRE_RATE;
	}
}

function updateAllies(s: GameRuntime, dt: number) {
	for (const a of s.allies) {
		if (!a.alive) {
			a.respawnTimer -= dt;
			continue;
		}
		a.cooldown = Math.max(0, a.cooldown - dt);
		a.hitFlash = Math.max(0, a.hitFlash - dt);

		const z = nearestZombie(s, a.pos, ALLY_AIM_RANGE);
		let desiredX = a.pos.x;
		let desiredY = a.pos.y;

		if (z) {
			// Hold ideal firing distance from the target.
			const dx = a.pos.x - z.pos.x;
			const dy = a.pos.y - z.pos.y;
			const d = Math.hypot(dx, dy) || 1;
			desiredX = z.pos.x + (dx / d) * ALLY_IDEAL_RANGE;
			desiredY = z.pos.y + (dy / d) * ALLY_IDEAL_RANGE;
			a.angle = Math.atan2(z.pos.y - a.pos.y, z.pos.x - a.pos.x);
			if (a.cooldown <= 0) {
				fireBullet(s, a.pos, a.angle, ALLY_BULLET_DAMAGE, "ally");
				spawnMuzzleFlash(s, a.pos, a.angle);
				s.sfx?.play("allyShoot");
				a.cooldown = ALLY_FIRE_RATE;
			}
		} else {
			// No threats: only regroup if the player has wandered out of leash.
			const pdx = s.player.pos.x - a.pos.x;
			const pdy = s.player.pos.y - a.pos.y;
			const pd = Math.hypot(pdx, pdy);
			if (pd > ALLY_LEASH) {
				const t = (pd - ALLY_LEASH * 0.6) / pd;
				desiredX = a.pos.x + pdx * t;
				desiredY = a.pos.y + pdy * t;
			}
			a.angle = s.player.angle;
		}

		// Spread out from other allies so they don't bunch up.
		for (const b of s.allies) {
			if (b === a || !b.alive) continue;
			const sdx = a.pos.x - b.pos.x;
			const sdy = a.pos.y - b.pos.y;
			const sd = Math.hypot(sdx, sdy);
			if (sd > 0 && sd < ALLY_SEPARATION) {
				const force = (ALLY_SEPARATION - sd) / ALLY_SEPARATION;
				desiredX += (sdx / sd) * force * 60;
				desiredY += (sdy / sd) * force * 60;
			}
		}

		const mdx = desiredX - a.pos.x;
		const mdy = desiredY - a.pos.y;
		const md = Math.hypot(mdx, mdy);
		if (md > 4) {
			const move = Math.min(md, ALLY_SPEED * dt);
			a.pos.x += (mdx / md) * move;
			a.pos.y += (mdy / md) * move;
		}
		resolveObstacleCollision(a.pos, ALLY_RADIUS, s.obstacles);
		a.pos.x = clamp(a.pos.x, ALLY_RADIUS, ARENA_W - ALLY_RADIUS);
		a.pos.y = clamp(a.pos.y, ALLY_RADIUS, ARENA_H - ALLY_RADIUS);
	}
}

type ZombieTarget =
	| { pos: Vec; isPlayer: true }
	| { pos: Vec; isPlayer: false; ally: Ally };

function updateZombies(s: GameRuntime, dt: number) {
	for (const z of s.zombies) {
		z.wobble += dt * 5;
		let best: ZombieTarget = { pos: s.player.pos, isPlayer: true };
		let bestD = Math.hypot(s.player.pos.x - z.pos.x, s.player.pos.y - z.pos.y);
		for (const a of s.allies) {
			if (!a.alive) continue;
			const d = Math.hypot(a.pos.x - z.pos.x, a.pos.y - z.pos.y);
			if (d < bestD) {
				bestD = d;
				best = { pos: a.pos, isPlayer: false, ally: a };
			}
		}
		const dx = best.pos.x - z.pos.x;
		const dy = best.pos.y - z.pos.y;
		const d = Math.hypot(dx, dy) || 1;
		const wobbleScale = z.type === "runner" ? 0.25 : 0.55;
		z.vel.x = (dx / d) * z.speed + Math.cos(z.wobble) * 14 * wobbleScale;
		z.vel.y = (dy / d) * z.speed + Math.sin(z.wobble * 0.7) * 10 * wobbleScale;
		z.pos.x += z.vel.x * dt;
		z.pos.y += z.vel.y * dt;
		resolveObstacleCollision(z.pos, z.radius, s.obstacles);
		z.hitFlash = Math.max(0, z.hitFlash - dt);
		const targetRadius = best.isPlayer ? PLAYER_RADIUS : ALLY_RADIUS;
		if (d < z.radius + targetRadius) {
			const dmg = z.damage * dt;
			if (best.isPlayer) {
				s.player.hp = Math.max(0, s.player.hp - dmg);
				s.player.hitFlash = 0.15;
				triggerShake(s, 0.18, 6);
				s.sfx?.play("playerHurt");
			} else {
				best.ally.hp = Math.max(0, best.ally.hp - dmg);
				best.ally.hitFlash = 0.15;
				if (best.ally.hp <= 0 && best.ally.alive) {
					best.ally.alive = false;
					best.ally.respawnTimer = 0;
					spawnBlood(s, best.ally.pos, 18);
				}
			}
		}
	}
	resolveZombieCollisions(s);
}

function resolveZombieCollisions(s: GameRuntime) {
	for (let i = 0; i < s.zombies.length; i++) {
		for (let j = i + 1; j < s.zombies.length; j++) {
			const a = s.zombies[i];
			const b = s.zombies[j];
			if (!a || !b) continue;
			const dx = b.pos.x - a.pos.x;
			const dy = b.pos.y - a.pos.y;
			const d = Math.hypot(dx, dy);
			const min = a.radius + b.radius;
			if (d > 0 && d < min) {
				const overlap = (min - d) / 2;
				const ux = dx / d;
				const uy = dy / d;
				a.pos.x -= ux * overlap;
				a.pos.y -= uy * overlap;
				b.pos.x += ux * overlap;
				b.pos.y += uy * overlap;
			}
		}
	}
}

function updateBullets(s: GameRuntime, dt: number) {
	for (let i = s.bullets.length - 1; i >= 0; i--) {
		const b = s.bullets[i];
		if (!b) continue;
		b.pos.x += b.vel.x * dt;
		b.pos.y += b.vel.y * dt;
		b.ttl -= dt;
		if (
			b.ttl <= 0 ||
			b.pos.x < -20 ||
			b.pos.y < -20 ||
			b.pos.x > ARENA_W + 20 ||
			b.pos.y > ARENA_H + 20
		) {
			s.bullets.splice(i, 1);
			continue;
		}
		if (bulletHitsObstacle(b.pos, s.obstacles)) {
			for (let k = 0; k < 4; k++) {
				s.particles.push({
					pos: { x: b.pos.x, y: b.pos.y },
					vel: { x: rand(-120, 120), y: rand(-120, 120) },
					life: 0.18,
					maxLife: 0.18,
					color: "#d8c9a3",
					size: rand(1.5, 3),
				});
			}
			s.bullets.splice(i, 1);
			continue;
		}
		let hit = false;
		for (let j = s.zombies.length - 1; j >= 0; j--) {
			const z = s.zombies[j];
			if (!z) continue;
			const dx = z.pos.x - b.pos.x;
			const dy = z.pos.y - b.pos.y;
			if (dx * dx + dy * dy < (z.radius + 4) * (z.radius + 4)) {
				z.hp -= b.damage;
				z.hitFlash = 0.1;
				spawnBlood(s, b.pos, 4);
				s.texts.push({
					pos: { x: z.pos.x, y: z.pos.y - z.radius },
					vel: { x: 0, y: -30 },
					text: `${Math.round(b.damage)}`,
					life: 0.6,
					color: b.team === "player" ? "#ffe26a" : "#a8e6ff",
				});
				if (z.hp <= 0) {
					s.zombies.splice(j, 1);
					s.kills += 1;
					spawnBlood(s, z.pos, 16);
					s.sfx?.play("zombieKill");
				} else {
					s.sfx?.play("zombieHit");
				}
				hit = true;
				break;
			}
		}
		if (hit) s.bullets.splice(i, 1);
	}
}

function updateParticles(s: GameRuntime, dt: number) {
	for (let i = s.particles.length - 1; i >= 0; i--) {
		const p = s.particles[i];
		if (!p) continue;
		p.pos.x += p.vel.x * dt;
		p.pos.y += p.vel.y * dt;
		p.vel.x *= 0.9;
		p.vel.y *= 0.9;
		p.life -= dt;
		if (p.life <= 0) s.particles.splice(i, 1);
	}
}

function updateTexts(s: GameRuntime, dt: number) {
	for (let i = s.texts.length - 1; i >= 0; i--) {
		const t = s.texts[i];
		if (!t) continue;
		t.pos.x += t.vel.x * dt;
		t.pos.y += t.vel.y * dt;
		t.life -= dt;
		if (t.life <= 0) s.texts.splice(i, 1);
	}
}

function spawnLogic(s: GameRuntime, dt: number) {
	if (s.zombiesToSpawn > 0) {
		s.spawnTimer -= dt;
		if (s.spawnTimer <= 0) {
			spawnZombie(s);
			s.zombiesToSpawn -= 1;
			s.spawnTimer = clamp(0.6 - s.wave * 0.05, 0.12, 0.6);
		}
	} else if (s.zombies.length === 0) {
		if (s.waveBreak <= 0) {
			s.waveBreak = WAVE_BREAK_SECONDS;
			s.player.hp = Math.min(
				s.player.maxHp,
				s.player.hp + s.player.maxHp * 0.2,
			);
			for (const a of s.allies) {
				if (a.alive) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.3);
			}
		}
		s.waveBreak -= dt;
		if (s.waveBreak <= 0) {
			startWave(s, s.wave + 1);
			s.waveBreak = 0;
		}
	}
}

function render(ctx: CanvasRenderingContext2D, s: GameRuntime) {
	ctx.save();
	if (s.shakeTime > 0) {
		const m = s.shakeMag * (s.shakeTime / 0.18);
		ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
	}
	drawGround(ctx);

	type DrawItem = { y: number; draw: () => void };
	const items: DrawItem[] = [];
	for (const a of s.allies) {
		if (a.alive) items.push({ y: a.pos.y, draw: () => drawAlly(ctx, a) });
		else items.push({ y: a.pos.y, draw: () => drawDeadAlly(ctx, a) });
	}
	items.push({ y: s.player.pos.y, draw: () => drawPlayer(ctx, s.player) });
	for (const z of s.zombies)
		items.push({ y: z.pos.y, draw: () => drawZombie(ctx, z) });
	for (const o of s.obstacles)
		items.push({ y: obstacleBottomY(o), draw: () => drawObstacle(ctx, o) });
	items.sort((a, b) => a.y - b.y);
	for (const it of items) it.draw();

	for (const b of s.bullets) drawBullet(ctx, b);
	for (const p of s.particles) drawParticle(ctx, p);

	for (const z of s.zombies) {
		drawHpBar(ctx, z.pos, z.hp, z.maxHp, z.radius + 8, 28, 4, "#ff4058");
	}
	for (const a of s.allies) {
		if (a.alive && a.hp < a.maxHp) {
			drawHpBar(ctx, a.pos, a.hp, a.maxHp, ALLY_RADIUS + 12, 28, 4, "#00e868");
		}
	}

	for (const t of s.texts) {
		ctx.globalAlpha = clamp(t.life / 0.6, 0, 1);
		ctx.fillStyle = t.color;
		ctx.font = "bold 13px ui-sans-serif, system-ui, sans-serif";
		ctx.textAlign = "center";
		ctx.fillText(t.text, t.pos.x, t.pos.y);
	}
	ctx.globalAlpha = 1;
	ctx.restore();

	drawVignette(ctx);
	if (s.bannerTime > 0 && s.bannerText && s.phase !== "gameover") {
		drawBanner(ctx, s.bannerText, s.bannerTime, s.bannerMaxTime);
	}
	drawCrosshair(ctx, s.mouse);
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle) {
	ctx.save();
	if (o.kind === "barrel") {
		// Brawl TNT-style barrel
		ctx.beginPath();
		ctx.ellipse(
			o.x,
			o.y + o.r * 0.55,
			o.r * 0.95,
			o.r * 0.38,
			0,
			0,
			Math.PI * 2,
		);
		ctx.fillStyle = "rgba(0,0,0,0.28)";
		ctx.fill();
		const bg = ctx.createRadialGradient(
			o.x - o.r * 0.25,
			o.y - o.r * 0.2,
			0,
			o.x,
			o.y,
			o.r,
		);
		bg.addColorStop(0, "#e86850");
		bg.addColorStop(0.45, "#c84030");
		bg.addColorStop(1, "#781018");
		ctx.beginPath();
		ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
		ctx.fillStyle = bg;
		ctx.fill();
		ctx.strokeStyle = BRAWL_OUT;
		ctx.lineWidth = BRAWL_OUTW;
		ctx.stroke();
		ctx.strokeStyle = "rgba(255,255,255,0.28)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(o.x - o.r * 0.2, o.y - o.r * 0.2, o.r * 0.35, 0, Math.PI * 2);
		ctx.stroke();
		ctx.fillStyle = "#f0e8d8";
		ctx.fillRect(o.x - o.r * 0.55, o.y - o.r * 0.12, o.r * 1.1, o.r * 0.24);
		ctx.strokeStyle = BRAWL_OUT;
		ctx.lineWidth = BRAWL_OUT_SOFT;
		ctx.strokeRect(o.x - o.r * 0.55, o.y - o.r * 0.12, o.r * 1.1, o.r * 0.24);
		ctx.fillStyle = "#1a1a1a";
		ctx.font = `bold ${Math.max(8, o.r * 0.55)}px sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("!", o.x, o.y + o.r * 0.02);
	} else if (o.kind === "crate") {
		ctx.fillStyle = "rgba(0,0,0,0.3)";
		ctx.fillRect(o.x + 4, o.y + 6, o.w, o.h);
		const g = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
		g.addColorStop(0, "#d4a86a");
		g.addColorStop(0.5, "#9a6a35");
		g.addColorStop(1, "#5a3a1a");
		ctx.fillStyle = g;
		ctx.fillRect(o.x, o.y, o.w, o.h);
		ctx.strokeStyle = BRAWL_OUT;
		ctx.lineWidth = BRAWL_OUTW;
		ctx.strokeRect(o.x, o.y, o.w, o.h);
		const plank = 10;
		for (let py = o.y + plank; py < o.y + o.h - 2; py += plank) {
			ctx.beginPath();
			ctx.moveTo(o.x + 2, py);
			ctx.lineTo(o.x + o.w - 2, py);
			ctx.strokeStyle = "rgba(0,0,0,0.22)";
			ctx.lineWidth = 1.2;
			ctx.stroke();
		}
		ctx.strokeStyle = "rgba(255,255,255,0.2)";
		ctx.beginPath();
		ctx.moveTo(o.x + 3, o.y + 3);
		ctx.lineTo(o.x + o.w - 3, o.y + o.h - 3);
		ctx.stroke();
		for (const [dx, dy] of [
			[2, 2],
			[o.w - 2, 2],
		] as const) {
			ctx.fillStyle = "#5a5a5a";
			ctx.beginPath();
			ctx.arc(o.x + dx, o.y + dy, 3, 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = BRAWL_OUT;
			ctx.lineWidth = 0.8;
			ctx.stroke();
		}
	} else {
		// Stone block wall (Brawl)
		ctx.fillStyle = "rgba(0,0,0,0.3)";
		ctx.fillRect(o.x + 2, o.y + 5, o.w, o.h);
		const g2 = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
		g2.addColorStop(0, "#b8a898");
		g2.addColorStop(0.4, "#8a7a6a");
		g2.addColorStop(1, "#4a3a2c");
		ctx.fillStyle = g2;
		ctx.fillRect(o.x, o.y, o.w, o.h);
		const isHoriz = o.w > o.h;
		const count = isHoriz
			? Math.max(2, Math.round(o.w / 28))
			: Math.max(2, Math.round(o.h / 28));
		for (let i = 1; i < count; i++) {
			ctx.beginPath();
			if (isHoriz) {
				const x = o.x + (o.w / count) * i;
				ctx.moveTo(x, o.y + 1);
				ctx.lineTo(x, o.y + o.h - 1);
			} else {
				const y = o.y + (o.h / count) * i;
				ctx.moveTo(o.x + 1, y);
				ctx.lineTo(o.x + o.w - 1, y);
			}
			ctx.strokeStyle = "rgba(0,0,0,0.2)";
			ctx.lineWidth = 1.1;
			ctx.stroke();
		}
		ctx.strokeStyle = BRAWL_OUT;
		ctx.lineWidth = BRAWL_OUTW;
		ctx.strokeRect(o.x, o.y, o.w, o.h);
	}
	ctx.restore();
}

function drawGround(ctx: CanvasRenderingContext2D) {
	// Brawl: sunny grass field (lime → forest green)
	const cx = ARENA_W / 2;
	const cy = ARENA_H / 2;
	const g = ctx.createRadialGradient(
		cx * 0.9,
		cy * 0.75,
		40,
		cx,
		cy,
		Math.max(ARENA_W, ARENA_H) * 0.72,
	);
	g.addColorStop(0, "#9fe860");
	g.addColorStop(0.35, "#6dd23e");
	g.addColorStop(0.7, "#4ab028");
	g.addColorStop(1, "#2d7818");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, ARENA_W, ARENA_H);
	// Soft grass tufts (deterministic, no flicker)
	for (let i = 0; i < 90; i++) {
		const x = ((i * 127 + i * i * 0.1) | 0) % (ARENA_W - 24);
		const y = ((i * 83 + 37) | 0) % (ARENA_H - 24);
		const rad = 5 + (i % 6) * 2.2;
		ctx.globalAlpha = 0.1 + (i % 5) * 0.04;
		ctx.beginPath();
		ctx.arc(12 + x, 12 + y, rad, 0, Math.PI * 2);
		ctx.fillStyle = i % 3 === 0 ? "#1a5a0c" : "#b8f070";
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	// Dark “bush” patches (Brawl cover grass look)
	for (let i = 0; i < 16; i++) {
		const bx = 40 + ((i * 97) % (ARENA_W - 100));
		const by = 30 + ((i * 71 + i * 7) % (ARENA_H - 80));
		ctx.beginPath();
		ctx.ellipse(bx, by, 22 + (i % 4) * 5, 16 + (i % 3) * 3, 0, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(25, 90, 18, 0.22)";
		ctx.fill();
	}
	// Subtle path / tile sheen
	const step = 48;
	for (let x = 0; x < ARENA_W; x += step) {
		for (let y = 0; y < ARENA_H; y += step) {
			const tx = x + 1;
			const ty = y + 1;
			ctx.beginPath();
			ctx.moveTo(tx, ty);
			ctx.lineTo(tx + step * 0.4, ty);
			ctx.lineTo(tx + step * 0.2, ty + step * 0.4);
			ctx.closePath();
			ctx.fillStyle = "rgba(255,255,255,0.035)";
			ctx.fill();
		}
	}
	// Brawl gold arena rim
	const rim = ctx.createLinearGradient(0, 0, ARENA_W, ARENA_H);
	rim.addColorStop(0, "#fff6c8");
	rim.addColorStop(0.3, "#f0c850");
	rim.addColorStop(0.5, "#d8a020");
	rim.addColorStop(0.7, "#f0c850");
	rim.addColorStop(1, "#fff6c8");
	ctx.strokeStyle = rim;
	ctx.lineWidth = 7;
	ctx.strokeRect(2, 2, ARENA_W - 4, ARENA_H - 4);
	ctx.strokeStyle = "rgba(255,255,255,0.55)";
	ctx.lineWidth = 1.2;
	ctx.strokeRect(5, 5, ARENA_W - 10, ARENA_H - 10);
	ctx.strokeStyle = "rgba(20, 50, 120, 0.35)";
	ctx.lineWidth = 2;
	ctx.strokeRect(9, 9, ARENA_W - 18, ARENA_H - 18);
}

/** Your team: **elephant** mascot + red/white cap (+x = facing). */
function drawGOPBrawler(
	ctx: CanvasRenderingContext2D,
	pos: Vec,
	angle: number,
	r: number,
	bodyDark: string,
	bodyLight: string,
	capRed: string,
	capPanel: string,
	hitFlash: number,
) {
	const earIn = `rgba(255,200,210,0.9)`;
	ctx.save();
	ctx.translate(pos.x, pos.y);
	const sh = ctx.createRadialGradient(0, r * 0.65, 0, 0, r * 0.75, r * 0.95);
	sh.addColorStop(0, "rgba(20, 40, 80, 0.35)");
	sh.addColorStop(1, "rgba(40, 100, 160, 0.06)");
	ctx.beginPath();
	ctx.ellipse(0, r * 0.7, r * 0.88, r * 0.34, 0, 0, Math.PI * 2);
	ctx.fillStyle = sh;
	ctx.fill();
	ctx.rotate(angle);
	const txW = r * 0.52;
	const tyH = r * 0.48;
	// Rounded body
	ctx.beginPath();
	ctx.ellipse(0, 0, txW, tyH, 0, 0, Math.PI * 2);
	ctx.fillStyle = createBlobGradient(
		ctx,
		0,
		-tyH * 0.15,
		txW,
		tyH,
		bodyLight,
		bodyDark,
		"rgba(0,0,0,0.45)",
	);
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = BRAWL_OUTW;
	ctx.stroke();
	// Four stumpy feet
	for (const dx of [-0.32, 0.22] as const) {
		for (const sy of [-1, 1] as const) {
			ctx.beginPath();
			ctx.ellipse(
				dx * r,
				sy * (tyH * 0.75),
				r * 0.12,
				r * 0.16,
				0,
				0,
				Math.PI * 2,
			);
			const fg = createBlobGradient(
				ctx,
				dx * r,
				sy * (tyH * 0.75),
				r * 0.12,
				r * 0.16,
				"#4a4a4a",
				"#1a1a1a",
				"rgba(0,0,0,0.5)",
			);
			ctx.fillStyle = fg;
			ctx.fill();
			ctx.strokeStyle = BRAWL_OUT;
			ctx.lineWidth = 0.7;
			ctx.stroke();
		}
	}
	// Cranium + ears
	const hx = r * 0.38;
	const hy = 0.02 * r;
	for (const sign of [-1, 1] as const) {
		ctx.beginPath();
		ctx.ellipse(
			hx * 0.4,
			sign * (r * 0.4),
			r * 0.2,
			r * 0.32,
			sign * 0.1,
			0,
			Math.PI * 2,
		);
		ctx.fillStyle = createBlobGradient(
			ctx,
			hx * 0.4,
			sign * (r * 0.4),
			r * 0.2,
			r * 0.32,
			bodyLight,
			bodyDark,
			"rgba(0,0,0,0.35)",
		);
		ctx.fill();
		ctx.strokeStyle = BRAWL_OUT;
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.beginPath();
		ctx.ellipse(
			hx * 0.38,
			sign * (r * 0.38),
			r * 0.1,
			r * 0.18,
			sign * 0.12,
			0,
			Math.PI * 2,
		);
		ctx.fillStyle = earIn;
		ctx.fill();
	}
	ctx.beginPath();
	ctx.ellipse(hx, hy, r * 0.22, r * 0.2, 0, 0, Math.PI * 2);
	ctx.fillStyle = createBlobGradient(
		ctx,
		hx,
		hy - r * 0.1,
		r * 0.22,
		r * 0.2,
		bodyLight,
		bodyDark,
		"rgba(0,0,0,0.25)",
	);
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = BRAWL_OUTW;
	ctx.stroke();
	// Trunk
	const trunkG = ctx.createLinearGradient(hx, hy, hx + r * 0.7, hy);
	trunkG.addColorStop(0, bodyLight);
	trunkG.addColorStop(0.55, bodyDark);
	trunkG.addColorStop(1, "#0a0a0a");
	ctx.beginPath();
	ctx.moveTo(hx + r * 0.1, hy);
	ctx.quadraticCurveTo(
		hx + r * 0.48,
		hy - r * 0.12,
		hx + r * 0.68,
		hy + r * 0.06,
	);
	ctx.strokeStyle = trunkG;
	ctx.lineWidth = 4.2;
	ctx.lineCap = "round";
	ctx.stroke();
	// Tusks
	ctx.beginPath();
	ctx.arc(hx + r * 0.1, hy + r * 0.1, r * 0.1, 0.1, 0.9);
	ctx.strokeStyle = "rgba(255,250,240,0.95)";
	ctx.lineWidth = 1.2;
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(hx + r * 0.1, hy - r * 0.1, r * 0.1, -0.9, -0.1);
	ctx.stroke();
	// eyes
	for (const sy of [-1, 1] as const) {
		ctx.beginPath();
		ctx.arc(hx + r * 0.12, hy + sy * (r * 0.05), 1.1, 0, Math.PI * 2);
		ctx.fillStyle = "#0a0a0a";
		ctx.fill();
	}
	// Mini MAGA cap (party colors)
	const capG = ctx.createLinearGradient(
		hx - r * 0.1,
		hy - r * 0.55,
		hx + r * 0.35,
		hy - r * 0.1,
	);
	capG.addColorStop(0, "#ff3a2a");
	capG.addColorStop(0.6, capRed);
	capG.addColorStop(1, "#4a0000");
	ctx.beginPath();
	ctx.moveTo(hx - r * 0.18, hy - r * 0.1);
	ctx.lineTo(hx - r * 0.1, hy - r * 0.58);
	ctx.lineTo(hx + r * 0.2, hy - r * 0.62);
	ctx.lineTo(hx + r * 0.38, hy - r * 0.12);
	ctx.lineTo(hx + r * 0.05, hy - 0.02 * r);
	ctx.closePath();
	ctx.fillStyle = capG;
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 1.1;
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(hx + r * 0.02, hy - r * 0.05);
	ctx.lineTo(hx + r * 0.1, hy - r * 0.5);
	ctx.lineTo(hx + r * 0.36, hy - r * 0.2);
	ctx.closePath();
	ctx.fillStyle = capPanel;
	ctx.fill();
	ctx.stroke();
	const capFont = `bold ${Math.max(3.2, r * 0.055)}px ui-sans-serif, sans-serif`;
	ctx.save();
	ctx.translate(hx + r * 0.18, hy - r * 0.32);
	ctx.rotate(-0.12);
	ctx.font = capFont;
	ctx.fillStyle = "#102878";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText("MAGA", 0, 0);
	ctx.restore();
	// Pistol
	ctx.save();
	ctx.translate(r * 0.4, r * 0.1);
	ctx.rotate(0.05);
	drawHandgunTopDown(ctx, r * 0.95);
	ctx.restore();
	if (hitFlash > 0) {
		ctx.globalAlpha = clamp(hitFlash / 0.15, 0, 1) * 0.6;
		ctx.beginPath();
		ctx.ellipse(0, 0, txW * 1.15, tyH * 1.15, 0, 0, Math.PI * 2);
		ctx.fillStyle = "#ffffff";
		ctx.fill();
		ctx.globalAlpha = 1;
	}
	ctx.restore();
}

function drawVigilante(ctx: CanvasRenderingContext2D, a: Ally) {
	drawGOPBrawler(
		ctx,
		a.pos,
		a.angle,
		ALLY_RADIUS,
		a.armor,
		a.armorHighlight,
		a.cape,
		a.capeInner,
		a.hitFlash,
	);
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player) {
	drawGOPBrawler(
		ctx,
		p.pos,
		p.angle,
		PLAYER_RADIUS,
		PLAYER_GOP_SKIN.armor,
		PLAYER_GOP_SKIN.armorHighlight,
		PLAYER_GOP_SKIN.cape,
		PLAYER_GOP_SKIN.capeInner,
		p.hitFlash,
	);
	// Brawl-style “your brawler” ring
	ctx.beginPath();
	ctx.arc(p.pos.x, p.pos.y, PLAYER_RADIUS + 8, 0, Math.PI * 2);
	ctx.strokeStyle = "rgba(255,255,255,0.95)";
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(p.pos.x, p.pos.y, PLAYER_RADIUS + 6, 0, Math.PI * 2);
	ctx.strokeStyle = "rgba(0,200,255,0.95)";
	ctx.lineWidth = 2;
	ctx.stroke();
}

function drawAlly(ctx: CanvasRenderingContext2D, a: Ally) {
	drawVigilante(ctx, a);
}

function drawDeadAlly(ctx: CanvasRenderingContext2D, a: Ally) {
	const r = ALLY_RADIUS;
	ctx.save();
	ctx.translate(a.pos.x, a.pos.y);
	ctx.rotate(a.angle);
	const tw = r * 0.52;
	const th = r * 0.48;
	// Fallen elephant
	ctx.beginPath();
	ctx.ellipse(0, 0, tw * 0.9, th * 0.85, 0.2, 0, Math.PI * 2);
	ctx.fillStyle = createBlobGradient(
		ctx,
		0,
		0,
		tw,
		th,
		"rgba(90,100,120,0.85)",
		"rgba(40,48,60,0.9)",
		"rgba(0,0,0,0.5)",
	);
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = BRAWL_OUTW;
	ctx.stroke();
	for (const s of [1, -1] as const) {
		ctx.beginPath();
		ctx.ellipse(0, s * r * 0.3, r * 0.2, r * 0.1, 0, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(50,50,60,0.4)";
		ctx.fill();
	}
	// Dropped “head + cap”
	const ox = r * 0.35;
	const oy = 0;
	ctx.beginPath();
	ctx.ellipse(ox, oy, r * 0.22, r * 0.2, 0, 0, Math.PI * 2);
	ctx.fillStyle = "rgba(60, 58, 65, 0.45)";
	ctx.fill();
	// Fallen MAGA cap
	const cr = -r * 0.55;
	const cyy = 0.15 * r;
	ctx.beginPath();
	ctx.ellipse(cr, cyy, r * 0.4, r * 0.22, 0.1, 0, Math.PI * 2);
	ctx.fillStyle = createBlobGradient(
		ctx,
		cr,
		cyy,
		r * 0.4,
		r * 0.22,
		"#ff4040",
		"#a81010",
		"rgba(0,0,0,0.45)",
	);
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = BRAWL_OUTW;
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(cr - r * 0.35, cyy);
	ctx.lineTo(cr + r * 0.2, cyy - r * 0.1);
	ctx.strokeStyle = "rgba(0,0,0,0.3)";
	ctx.lineWidth = 0.5;
	ctx.stroke();
	ctx.restore();
}

function drawZombie(ctx: CanvasRenderingContext2D, z: Zombie) {
	ctx.save();
	ctx.translate(z.pos.x, z.pos.y);
	// Shadow
	ctx.beginPath();
	ctx.ellipse(
		0,
		z.radius * 0.7,
		z.radius * 0.85,
		z.radius * 0.35,
		0,
		0,
		Math.PI * 2,
	);
	const zs = ctx.createRadialGradient(
		0,
		z.radius * 0.6,
		0,
		0,
		z.radius * 0.7,
		z.radius,
	);
	zs.addColorStop(0, "rgba(0,0,0,0.5)");
	zs.addColorStop(1, "rgba(0,0,0,0.1)");
	ctx.fillStyle = zs;
	ctx.fill();

	const angle = Math.atan2(z.vel.y, z.vel.x);
	ctx.rotate(angle);

	const sm = z.type === "brute" ? 1.15 : z.type === "runner" ? 0.9 : 1;
	// Rival “blue team” suits (D-style primary blues)
	const suit =
		z.type === "brute"
			? { main: "#0d3a7a", light: "#2a5ab8" }
			: z.type === "runner"
				? { main: "#1050a0", light: "#3a7ee0" }
				: { main: "#1248a0", light: "#3888e8" };
	const puffy = z.radius * 0.9 * sm;
	const sLight = suit.light;
	const tw = puffy * 0.5;
	const th = puffy * 0.46;
	// **Donkey** body (D mascot)
	ctx.beginPath();
	ctx.ellipse(0, 0, tw, th, 0, 0, Math.PI * 2);
	ctx.fillStyle = createBlobGradient(
		ctx,
		0,
		0,
		tw,
		th,
		sLight,
		suit.main,
		"rgba(0,0,0,0.4)",
	);
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = BRAWL_OUTW;
	ctx.stroke();
	// Blue “blanket” / saddle
	const sg = ctx.createLinearGradient(0, -puffy * 0.2, 0, puffy * 0.3);
	sg.addColorStop(0, "#4080e0");
	sg.addColorStop(0.5, "#2050a0");
	sg.addColorStop(1, "#102860");
	ctx.fillStyle = sg;
	ctx.beginPath();
	ctx.moveTo(0, -puffy * 0.1);
	ctx.lineTo(-puffy * 0.2, puffy * 0.22);
	ctx.lineTo(puffy * 0.2, puffy * 0.22);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 0.6;
	ctx.stroke();
	// Four legs + hooves
	for (const dx of [-0.3, 0.24] as const) {
		for (const sy of [-1, 1] as const) {
			ctx.beginPath();
			ctx.ellipse(
				dx * puffy,
				sy * (th * 0.78),
				puffy * 0.08,
				puffy * 0.1,
				0,
				0,
				Math.PI * 2,
			);
			ctx.fillStyle = createBlobGradient(
				ctx,
				dx * puffy,
				sy * (th * 0.78),
				puffy * 0.08,
				puffy * 0.1,
				"#2a2a2a",
				suit.main,
				"rgba(0,0,0,0.35)",
			);
			ctx.fill();
			ctx.strokeStyle = BRAWL_OUT;
			ctx.lineWidth = 0.55;
			ctx.stroke();
		}
	}
	// Tail
	ctx.beginPath();
	ctx.moveTo(-tw * 0.8, 0.05 * puffy);
	ctx.quadraticCurveTo(-puffy * 0.7, puffy * 0.1, -puffy * 0.85, 0.18 * puffy);
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 1.1;
	ctx.lineCap = "round";
	ctx.stroke();
	// Muzzle (elongated) + long ears
	const fcx = puffy * 0.4;
	const fcy = 0.01 * puffy;
	ctx.beginPath();
	ctx.ellipse(fcx, fcy, puffy * 0.2, puffy * 0.1, 0, 0, Math.PI * 2);
	ctx.fillStyle = createBlobGradient(
		ctx,
		fcx,
		fcy,
		puffy * 0.2,
		puffy * 0.1,
		"#d0a890",
		"#805858",
		"rgba(0,0,0,0.3)",
	);
	ctx.fill();
	ctx.stroke();
	for (const sign of [-1, 1] as const) {
		ctx.beginPath();
		ctx.ellipse(
			fcx * 0.4,
			fcy - sign * puffy * 0.2,
			puffy * 0.08,
			puffy * 0.22,
			sign * 0.15,
			0,
			Math.PI * 2,
		);
		ctx.fillStyle = createBlobGradient(
			ctx,
			fcx * 0.4,
			fcy,
			puffy * 0.08,
			puffy * 0.22,
			"#1a1a1a",
			"#0a0a0a",
			"rgba(0,0,0,0.4)",
		);
		ctx.fill();
		ctx.strokeStyle = BRAWL_OUT;
		ctx.lineWidth = 0.6;
		ctx.stroke();
	}
	// small eyes
	for (const sy of [-1, 1] as const) {
		ctx.beginPath();
		ctx.arc(fcx, fcy + sy * (puffy * 0.03), 0.9, 0, Math.PI * 2);
		ctx.fillStyle = "#0a0a0a";
		ctx.fill();
	}
	// Muzzle end
	ctx.beginPath();
	ctx.ellipse(
		fcx + puffy * 0.18,
		fcy,
		puffy * 0.07,
		puffy * 0.06,
		0,
		0,
		Math.PI * 2,
	);
	ctx.fillStyle = "rgba(24, 24, 28, 0.85)";
	ctx.fill();
	ctx.save();
	ctx.translate(puffy * 0.38, puffy * 0.08);
	ctx.rotate(0.04);
	drawHandgunTopDown(ctx, puffy * 0.88);
	ctx.restore();

	if (z.type === "brute") {
		ctx.strokeStyle = "rgba(255,200,80,0.75)";
		ctx.lineWidth = 2.5;
		ctx.setLineDash([5, 4]);
		ctx.beginPath();
		ctx.ellipse(0, 0, tw * 1.12, th * 1.1, 0, 0, Math.PI * 2);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	if (z.hitFlash > 0) {
		ctx.globalAlpha = clamp(z.hitFlash / 0.1, 0, 1) * 0.7;
		ctx.beginPath();
		ctx.ellipse(0, 0, tw * 1.1, th * 1.1, 0, 0, Math.PI * 2);
		ctx.fillStyle = "#ffffff";
		ctx.fill();
		ctx.globalAlpha = 1;
	}
	ctx.restore();
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
	const angle = Math.atan2(b.vel.y, b.vel.x);
	const isPl = b.team === "player";
	ctx.save();
	ctx.translate(b.pos.x, b.pos.y);
	ctx.rotate(angle);
	ctx.shadowColor = isPl
		? "rgba(255, 220, 80, 0.9)"
		: "rgba(140, 200, 255, 0.9)";
	ctx.shadowBlur = 8;
	const bg = ctx.createLinearGradient(-6, -1.5, 6, 1.5);
	if (isPl) {
		bg.addColorStop(0, "rgba(255,255,255,0.95)");
		bg.addColorStop(0.4, "#ffe26a");
		bg.addColorStop(0.7, "#c9a020");
		bg.addColorStop(1, "rgba(80,50,0,0.6)");
	} else {
		bg.addColorStop(0, "rgba(255,255,255,0.9)");
		bg.addColorStop(0.45, "#a8d8ff");
		bg.addColorStop(0.75, "#4a8ec8");
		bg.addColorStop(1, "rgba(20,30,60,0.55)");
	}
	ctx.fillStyle = bg;
	ctx.fillRect(-6, -1.5, 12, 3);
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 1.2;
	ctx.strokeRect(-6.5, -2, 13, 4);
	ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
	const a = clamp(p.life / p.maxLife, 0, 1);
	ctx.globalAlpha = a;
	ctx.fillStyle = p.color;
	ctx.beginPath();
	ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = 1;
}

function drawHpBar(
	ctx: CanvasRenderingContext2D,
	pos: Vec,
	hp: number,
	maxHp: number,
	yOffset: number,
	width: number,
	height: number,
	color: string,
) {
	const frac = clamp(hp / maxHp, 0, 1);
	const cy = pos.y - yOffset + height / 2;
	const x0 = pos.x - width / 2;
	const x1 = pos.x + width / 2;
	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.beginPath();
	ctx.lineWidth = height + 4;
	ctx.strokeStyle = "#f4c84a";
	ctx.moveTo(x0, cy);
	ctx.lineTo(x1, cy);
	ctx.stroke();
	ctx.beginPath();
	ctx.lineWidth = height;
	ctx.strokeStyle = "#0c1a36";
	ctx.moveTo(x0, cy);
	ctx.lineTo(x1, cy);
	ctx.stroke();
	if (frac > 0.001) {
		const xm = x0 + (x1 - x0) * frac;
		const grd = ctx.createLinearGradient(x0, cy, xm, cy);
		grd.addColorStop(0, color);
		grd.addColorStop(1, "rgba(255,255,255,0.25)");
		ctx.beginPath();
		ctx.lineWidth = height - 2;
		ctx.strokeStyle = grd;
		ctx.moveTo(x0, cy);
		ctx.lineTo(xm, cy);
		ctx.stroke();
	}
	ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D) {
	const grad = ctx.createRadialGradient(
		ARENA_W / 2,
		ARENA_H / 2,
		ARENA_H * 0.4,
		ARENA_W / 2,
		ARENA_H / 2,
		Math.max(ARENA_W, ARENA_H) * 0.75,
	);
	grad.addColorStop(0, "rgba(0,0,0,0)");
	grad.addColorStop(1, "rgba(0,40,80,0.06)");
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, ARENA_W, ARENA_H);
}

function drawBanner(
	ctx: CanvasRenderingContext2D,
	text: string,
	time: number,
	maxTime: number,
) {
	const t = clamp(time / maxTime, 0, 1);
	const fade = t > 0.7 ? (1 - t) / 0.3 : t < 0.2 ? t / 0.2 : 1;
	ctx.globalAlpha = clamp(fade, 0, 1);
	const bw = Math.min(520, ARENA_W - 48);
	const bh = 108;
	const bx = (ARENA_W - bw) / 2;
	const by = ARENA_H / 2 - bh / 2;
	const panel = ctx.createLinearGradient(bx, by, bx, by + bh);
	panel.addColorStop(0, "rgba(40,100,200,0.88)");
	panel.addColorStop(0.5, "rgba(25,70,180,0.9)");
	panel.addColorStop(1, "rgba(15,40,120,0.92)");
	ctx.fillStyle = panel;
	ctx.beginPath();
	ctx.moveTo(bx + 18, by);
	ctx.lineTo(bx + bw - 18, by);
	ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 18);
	ctx.lineTo(bx + bw, by + bh - 18);
	ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 18, by + bh);
	ctx.lineTo(bx + 18, by + bh);
	ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 18);
	ctx.lineTo(bx, by + 18);
	ctx.quadraticCurveTo(bx, by, bx + 18, by);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = "#f6d86a";
	ctx.lineWidth = 5;
	ctx.stroke();
	ctx.font = BR_FONT;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	const tx = ARENA_W / 2;
	const ty = ARENA_H / 2 + 3;
	for (let i = 6; i >= 1; i -= 1) {
		ctx.strokeStyle = i % 2 === 0 ? "#0a1c40" : "#102850";
		ctx.lineWidth = i;
		ctx.strokeText(text, tx, ty);
	}
	const txtGrad = ctx.createLinearGradient(0, ty - 28, 0, ty + 28);
	txtGrad.addColorStop(0, "#fff8c0");
	txtGrad.addColorStop(0.5, "#ffd030");
	txtGrad.addColorStop(1, "#e09000");
	ctx.fillStyle = txtGrad;
	ctx.fillText(text, tx, ty);
	ctx.globalAlpha = 1;
}

function drawCrosshair(ctx: CanvasRenderingContext2D, mouse: Vec) {
	ctx.save();
	ctx.translate(mouse.x, mouse.y);
	const ray = (x0: number, y0: number, x1: number, y1: number) => {
		ctx.beginPath();
		ctx.strokeStyle = "rgba(0,0,0,0.5)";
		ctx.lineWidth = 3;
		ctx.moveTo(x0, y0);
		ctx.lineTo(x1, y1);
		ctx.stroke();
		ctx.beginPath();
		ctx.strokeStyle = "#7ee8ff";
		ctx.lineWidth = 1.5;
		ctx.moveTo(x0, y0);
		ctx.lineTo(x1, y1);
		ctx.stroke();
	};
	ray(-22, 0, -9, 0);
	ray(9, 0, 22, 0);
	ray(0, -22, 0, -9);
	ray(0, 9, 0, 22);
	ctx.beginPath();
	ctx.arc(0, 0, 4, 0, Math.PI * 2);
	ctx.fillStyle = "#b8f4ff";
	ctx.fill();
	ctx.strokeStyle = "rgba(0,0,0,0.45)";
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.restore();
}

export default function Game() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const stateRef = useRef<GameRuntime>(createInitialState());
	const musicRef = useRef<MusicEngine | null>(null);
	const sfxRef = useRef<SfxEngine | null>(null);
	const sessionStartRef = useRef<number>(0);
	const telemetrySentRef = useRef(false);
	const [, setTick] = useState(0);
	const [muted, setMuted] = useState(false);
	const [hud, setHud] = useState({
		hp: PLAYER_MAX_HP,
		maxHp: PLAYER_MAX_HP,
		wave: 0,
		kills: 0,
		alliesAlive: 3,
		alliesTotal: 3,
		phase: "menu" as Phase,
		paused: false,
	});

	const submitTelemetry = (preferBeacon = false) => {
		if (telemetrySentRef.current) return;
		const state = stateRef.current;
		if (sessionStartRef.current <= 0) return;
		if (state.phase === "menu") return;
		telemetrySentRef.current = true;
		const duration = Math.max(
			1,
			Math.round((Date.now() - sessionStartRef.current) / 1000),
		);
		const payload = JSON.stringify({
			gameSlug: "game",
			waveReached: state.wave,
			kills: state.kills,
			durationSeconds: duration,
		});
		if (preferBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
			const blob = new Blob([payload], { type: "application/json" });
			const sent = navigator.sendBeacon("/api/telemetry", blob);
			if (sent) return;
		}
		void fetch("/api/telemetry", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: payload,
			keepalive: preferBeacon,
		}).catch(() => {
			// Ignore failures here; avoid duplicate retries after unload.
		});
	};

	useEffect(() => {
		musicRef.current = createMusicEngine();
		sfxRef.current = createSfxEngine();
		stateRef.current.sfx = sfxRef.current;
		return () => {
			musicRef.current?.dispose();
			sfxRef.current?.dispose();
			musicRef.current = null;
			sfxRef.current = null;
		};
	}, []);

	useEffect(() => {
		musicRef.current?.setMuted(muted);
		sfxRef.current?.setMuted(muted);
	}, [muted]);

	useEffect(() => {
		const m = musicRef.current;
		if (!m) return;
		if (hud.phase === "playing" && !hud.paused) m.start();
		else m.stop();
	}, [hud.phase, hud.paused]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = ARENA_W * dpr;
		canvas.height = ARENA_H * dpr;
		canvas.style.width = `${ARENA_W}px`;
		canvas.style.height = `${ARENA_H}px`;
		ctx.scale(dpr, dpr);

		let raf = 0;
		let last = performance.now();
		let hudClock = 0;

		const onKeyDown = (e: KeyboardEvent) => {
			const k = e.key.toLowerCase();
			if (
				k === "w" ||
				k === "a" ||
				k === "s" ||
				k === "d" ||
				k === "arrowup" ||
				k === "arrowdown" ||
				k === "arrowleft" ||
				k === "arrowright"
			) {
				e.preventDefault();
			}
			if (k === "escape") {
				const s = stateRef.current;
				if (s.phase === "playing") s.paused = !s.paused;
				return;
			}
			stateRef.current.keys.add(k);
		};
		const onKeyUp = (e: KeyboardEvent) => {
			stateRef.current.keys.delete(e.key.toLowerCase());
		};
		const onMouseMove = (e: MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			stateRef.current.mouse = {
				x: ((e.clientX - rect.left) / rect.width) * ARENA_W,
				y: ((e.clientY - rect.top) / rect.height) * ARENA_H,
			};
		};
		const onMouseDown = (e: MouseEvent) => {
			if (e.button === 0) stateRef.current.shooting = true;
		};
		const onMouseUp = (e: MouseEvent) => {
			if (e.button === 0) stateRef.current.shooting = false;
		};
		const onBlur = () => {
			stateRef.current.keys.clear();
			stateRef.current.shooting = false;
		};
		const onContextMenu = (e: MouseEvent) => e.preventDefault();

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		canvas.addEventListener("mousemove", onMouseMove);
		canvas.addEventListener("mousedown", onMouseDown);
		window.addEventListener("mouseup", onMouseUp);
		window.addEventListener("blur", onBlur);
		canvas.addEventListener("contextmenu", onContextMenu);

		const loop = (now: number) => {
			const dt = (now - last) / 1000;
			last = now;
			const s = stateRef.current;
			update(s, dt);
			render(ctx, s);

			hudClock += dt;
			if (hudClock > 0.1) {
				hudClock = 0;
				let alive = 0;
				for (const a of s.allies) if (a.alive) alive++;
				setHud({
					hp: Math.ceil(s.player.hp),
					maxHp: s.player.maxHp,
					wave: s.wave,
					kills: s.kills,
					alliesAlive: alive,
					alliesTotal: s.allies.length,
					phase: s.phase,
					paused: s.paused,
				});
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		setTick(1);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			canvas.removeEventListener("mousemove", onMouseMove);
			canvas.removeEventListener("mousedown", onMouseDown);
			window.removeEventListener("mouseup", onMouseUp);
			window.removeEventListener("blur", onBlur);
			canvas.removeEventListener("contextmenu", onContextMenu);
		};
	}, []);

	useEffect(() => {
		if (hud.phase === "gameover" && !telemetrySentRef.current) {
			submitTelemetry();
		}
	}, [hud.phase]);

	useEffect(() => {
		const onPageHide = () => submitTelemetry(true);
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") onPageHide();
		};
		window.addEventListener("pagehide", onPageHide);
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			onPageHide();
			window.removeEventListener("pagehide", onPageHide);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, []);

	const startGame = () => {
		const s = createInitialState();
		s.phase = "playing";
		s.sfx = sfxRef.current;
		startWave(s, 1);
		stateRef.current = s;
		sessionStartRef.current = Date.now();
		telemetrySentRef.current = false;
		musicRef.current?.start();
		sfxRef.current?.ensureStarted();
	};

	const resume = () => {
		stateRef.current.paused = false;
		musicRef.current?.start();
		sfxRef.current?.ensureStarted();
	};

	const brawlBtn =
		"relative select-none rounded-full border-4 border-[#143252] bg-gradient-to-b from-[#ffec90] to-[#ffb000] px-10 py-3.5 font-extrabold text-[#102840] text-lg shadow-[0_5px_0_#0a1c30,0_10px_20px_rgba(0,0,0,0.35)] transition-transform before:pointer-events-none before:absolute before:inset-x-3 before:top-1.5 before:h-[38%] before:rounded-t-[999px] before:bg-gradient-to-b before:from-white/50 before:to-transparent after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:ring-1 after:ring-inset after:ring-white/30 hover:brightness-105 active:translate-y-1 active:shadow-[0_2px_0_#0a1c30] sm:px-14 sm:py-4 sm:text-2xl";

	return (
		<div
			className="relative select-none rounded-[1.75rem] border-[#f2cc4a] border-[5px] bg-gradient-to-b from-[#3d8ce8] via-[#256fd8] to-[#164a9e] p-2.5 shadow-[0_10px_0_#0c2348,0_18px_40px_rgba(0,0,0,0.45)] sm:rounded-[2rem] sm:p-3.5"
			style={{ width: Math.min(ARENA_W + 36, 1024) }}
		>
			{/* Match info bar (Brawl top strip) */}
			<div className="mb-2 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
				<div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
					<StatPill emoji="🌊" label="WAVE" value={String(hud.wave || "—")} />
					<StatPill emoji="💀" label="KILLS" value={String(hud.kills)} />
					<StatPill
						emoji="🐘"
						label="SQUAD"
						value={`${hud.alliesAlive}/${hud.alliesTotal}`}
					/>
				</div>
				<div className="flex w-full min-w-0 items-center gap-2 sm:max-w-[22rem] sm:gap-3">
					<Link
						className="shrink-0 rounded-full border-[#143252] border-[3px] bg-gradient-to-b from-[#7cc0ff] to-[#2e74dd] px-3 py-2 font-extrabold text-[#102030] text-xs shadow-[0_3px_0_#0a1c30] active:translate-y-px"
						href="/"
						onClick={() => submitTelemetry(true)}
					>
						Dashboard
					</Link>
					<button
						aria-label={muted ? "Unmute" : "Mute"}
						className="shrink-0 rounded-full border-[#143252] border-[3px] bg-gradient-to-b from-[#5aa8ff] to-[#1e5fd0] px-2.5 py-2 font-extrabold text-[#102030] text-xs shadow-[0_3px_0_#0a1c30] active:translate-y-px"
						onClick={() => setMuted((m) => !m)}
						type="button"
					>
						{muted ? "🔇" : "♪"}
					</button>
					<div className="min-w-0 flex-1">
						<div className="mb-0.5 flex items-center justify-between font-bold text-[#b8dcff] text-[10px] uppercase leading-none tracking-wider sm:text-xs">
							<span>BRAWLER</span>
							<span className="text-white tabular-nums">
								{hud.hp} / {hud.maxHp}
							</span>
						</div>
						<div className="relative h-3.5 overflow-visible rounded-full border-[#f2cc4a] border-[2px] bg-[#0a1830] p-0.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] sm:h-4">
							<div
								className="h-full min-w-0 rounded-full bg-gradient-to-r from-[#00e090] to-[#90f060] shadow-[0_0_8px_rgba(0,255,150,0.6)]"
								style={{
									width: `${Math.max(0, Math.min(1, hud.hp / hud.maxHp)) * 100}%`,
								}}
							/>
						</div>
					</div>
				</div>
			</div>

			<div
				className="relative overflow-hidden rounded-2xl border-4 border-[#142e58] bg-[#061428] shadow-[inset_0_2px_0_rgba(255,255,255,0.12)]"
				style={{ width: ARENA_W, height: ARENA_H }}
			>
				<canvas
					className="block"
					ref={canvasRef}
					style={{
						width: ARENA_W,
						height: ARENA_H,
						cursor: hud.phase === "playing" && !hud.paused ? "none" : "default",
					}}
				/>

				{hud.phase === "menu" && (
					<Overlay>
						<p className="mb-1 font-extrabold text-[#bfe4ff] text-sm uppercase tracking-[0.2em]">
							3V3
						</p>
						<h1
							className="mb-1 text-center font-extrabold text-4xl text-white leading-none drop-shadow-[0_4px_0_#0a1c30] sm:text-5xl"
							style={{ textShadow: "0 0 2px #000, 0 3px 0 #143252" }}
						>
							ARENA
						</h1>
						<p
							className="mb-6 max-w-sm text-center font-bold text-[#ffe8a0] text-lg sm:text-xl"
							style={{ textShadow: "0 2px 0 #0a1c30" }}
						>
							ELEPHANTS <span className="text-white"> vs </span> DONKEYS
						</p>
						<p className="mb-6 max-w-md text-center font-semibold text-[#d4ecff] text-sm leading-relaxed sm:text-base">
							Hold the zone with your team. Wipe the wave before they overrun
							you!
						</p>
						<div className="mb-6 grid w-full max-w-sm grid-cols-2 gap-x-4 gap-y-2 text-left font-bold text-sm text-white sm:gap-y-2.5 sm:text-base">
							<HelpRow d="move" k="W A S D" />
							<HelpRow d="aim" k="MOUSE" />
							<HelpRow d="fire" k="CLICK" />
							<HelpRow d="pause" k="ESC" />
						</div>
						<button className={brawlBtn} onClick={startGame} type="button">
							PLAY
						</button>
					</Overlay>
				)}

				{hud.phase === "gameover" && (
					<Overlay>
						<p className="mb-1 font-extrabold text-[#ffb0b0] text-sm uppercase tracking-[0.2em]">
							DEFEAT
						</p>
						<h1
							className="mb-4 text-center font-extrabold text-4xl text-white sm:text-5xl"
							style={{ textShadow: "0 4px 0 #0a1c30, 0 0 20px #800" }}
						>
							DEFEATED
						</h1>
						<p className="mb-8 max-w-sm text-center font-bold text-[#d4ecff] text-lg sm:text-xl">
							Wave <span className="text-[#ffe066]">{hud.wave}</span> · Kills{" "}
							<span className="text-[#ffe066]">{hud.kills}</span>
						</p>
						<button className={brawlBtn} onClick={startGame} type="button">
							PLAY AGAIN
						</button>
						<Link
							className="mt-3 inline-flex rounded-full border-4 border-[#143252] bg-gradient-to-b from-[#7cc0ff] to-[#2e74dd] px-8 py-2.5 font-extrabold text-[#102840] text-base shadow-[0_4px_0_#0a1c30,0_8px_18px_rgba(0,0,0,0.3)] transition-transform hover:brightness-105 active:translate-y-1 active:shadow-[0_2px_0_#0a1c30]"
							href="/"
							onClick={() => submitTelemetry(true)}
						>
							BACK TO DASHBOARD
						</Link>
					</Overlay>
				)}

				{hud.phase === "playing" && hud.paused && (
					<Overlay>
						<h1
							className="mb-6 font-extrabold text-5xl text-white sm:text-6xl"
							style={{ textShadow: "0 5px 0 #0a1c30" }}
						>
							PAUSED
						</h1>
						<button className={brawlBtn} onClick={resume} type="button">
							RESUME
						</button>
					</Overlay>
				)}
			</div>

			<p className="mt-2 text-center font-bold text-[#a8c8f0] text-xs leading-tight sm:mt-3 sm:text-sm">
				Click the arena to focus · <span className="text-[#fff6c0]">Esc</span>{" "}
				to pause
			</p>
		</div>
	);
}

function StatPill({
	emoji,
	label,
	value,
}: {
	emoji: string;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-center gap-1.5 rounded-full border-2 border-[#f0c84a] bg-gradient-to-b from-[#4a9ef8] to-[#1a58c4] px-2.5 py-1.5 pl-1.5 font-extrabold text-white text-xs shadow-[0_3px_0_#0c2a55] sm:gap-2 sm:px-3.5 sm:py-2 sm:text-sm">
			<span
				aria-hidden
				className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0c2a55] bg-gradient-to-b from-white/25 to-white/5 text-base sm:h-8 sm:w-8"
			>
				{emoji}
			</span>
			<span className="text-[#b8dfff] text-[10px] sm:text-xs">{label}</span>
			<span className="min-w-[1.5rem] text-right text-[#fff6a0] tabular-nums sm:min-w-[2rem]">
				{value}
			</span>
		</div>
	);
}

function HelpRow({ k, d }: { k: string; d: string }) {
	return (
		<div className="flex items-baseline justify-between gap-2 rounded-lg border border-white/10 bg-[#0a2a50]/50 px-2 py-1.5 sm:px-3">
			<span className="shrink-0 text-[#ffe066] text-xs tracking-wide sm:text-sm">
				{k}
			</span>
			<span className="text-[#8ec0f0] text-xs sm:text-sm">{d}</span>
		</div>
	);
}

function Overlay({ children }: { children: React.ReactNode }) {
	return (
		<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-b from-[#1255c0]/88 via-[#0d3a8a]/92 to-[#061a40]/95 px-4 py-6 backdrop-blur-[2px]">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-30"
				style={{
					backgroundImage:
						"repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 16px)",
				}}
			/>
			<div className="relative flex max-w-lg flex-col items-center">
				{children}
			</div>
		</div>
	);
}
