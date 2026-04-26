import {
	ALLY_AIM_RANGE,
	ALLY_BULLET_DAMAGE,
	ALLY_FIRE_RATE,
	ALLY_IDEAL_RANGE,
	ALLY_LEASH,
	ALLY_RADIUS,
	ALLY_SEPARATION,
	ALLY_SPEED,
	ARENA_H,
	ARENA_W,
	BRUTE_CHANCE,
	BULLET_DAMAGE,
	BULLET_SPEED,
	PLAYER_FIRE_RATE,
	PLAYER_RADIUS,
	PLAYER_SPEED,
	RUNNER_CHANCE,
	WAVE_BREAK_SECONDS,
} from "./constants";
import type {
	GameRuntime,
	Vec,
	Zombie,
	ZombieTarget,
	ZombieType,
} from "./types";
import { chance, clamp, nowT, rand } from "./utils";
import { bulletHitsObstacle, resolveObstacleCollision } from "./world";

export function startWave(s: GameRuntime, wave: number) {
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
	owner: string,
) {
	const offsetR = 18;
	const sx = pos.x + Math.cos(angle) * offsetR;
	const sy = pos.y + Math.sin(angle) * offsetR;
	s.bullets.push({
		pos: { x: sx, y: sy },
		startPos: { x: sx, y: sy },
		vel: {
			x: Math.cos(angle) * BULLET_SPEED,
			y: Math.sin(angle) * BULLET_SPEED,
		},
		damage: dmg,
		ttl: 1.2,
		team,
		owner,
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

export function update(s: GameRuntime, dt: number) {
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

	const hpFrac = s.player.hp / s.player.maxHp;
	if (hpFrac < 0.25 && s.lowHpFlaggedAt < 0) {
		s.lowHpFlaggedAt = nowT(s);
	} else if (hpFrac >= 0.4) {
		s.lowHpFlaggedAt = -1;
	}

	const tNow = nowT(s);
	if (tNow - s.lastSnapshotMs >= 250) {
		let runners = 0;
		let brutes = 0;
		let nearestD = 1e9;
		for (const z of s.zombies) {
			if (z.type === "runner") runners += 1;
			else if (z.type === "brute") brutes += 1;
			const dd = Math.hypot(
				z.pos.x - s.player.pos.x,
				z.pos.y - s.player.pos.y,
			);
			if (dd < nearestD) nearestD = dd;
		}
		const allyAlive = s.allies.reduce((n, a) => n + (a.alive ? 1 : 0), 0);
		const dist01 = nearestD < 1e8 ? Math.max(0, 1 - nearestD / 600) : 0;
		const density01 = Math.min(1, s.zombies.length / 8);
		const threatProxim = Math.min(1, dist01 * 0.7 + density01 * 0.5);
		s.snapshots.push({
			t: tNow,
			playerHpFrac: hpFrac,
			alliesAlive: allyAlive,
			zombiesOnScreen: s.zombies.length,
			zombieRunners: runners,
			zombieBrutes: brutes,
			threatProxim,
			killsBucket: s.bucketKills,
			hitsTakenBucket: Math.round(s.bucketHits),
			shotsFiredBucket: s.bucketShots,
			wave: s.wave,
		});
		s.lastSnapshotMs = tNow;
		s.bucketKills = 0;
		s.bucketHits = 0;
		s.bucketShots = 0;
	}

	if (s.player.hp <= 0) {
		s.phase = "gameover";
		s.bannerText = "OVERRUN";
		s.bannerTime = 9999;
		s.bannerMaxTime = 1;
		spawnBlood(s, s.player.pos, 30);
		s.events.push({
			kind: "match_end",
			t: nowT(s),
			result: "loss",
			durationMs: nowT(s),
		});
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
		fireBullet(s, p.pos, p.angle, BULLET_DAMAGE, "player", "player");
		spawnMuzzleFlash(s, p.pos, p.angle);
		s.sfx?.play("playerShoot");
		p.cooldown = PLAYER_FIRE_RATE;
		s.bucketShots += 1;
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
			const dx = a.pos.x - z.pos.x;
			const dy = a.pos.y - z.pos.y;
			const d = Math.hypot(dx, dy) || 1;
			desiredX = z.pos.x + (dx / d) * ALLY_IDEAL_RANGE;
			desiredY = z.pos.y + (dy / d) * ALLY_IDEAL_RANGE;
			a.angle = Math.atan2(z.pos.y - a.pos.y, z.pos.x - a.pos.x);
			if (a.cooldown <= 0) {
				fireBullet(s, a.pos, a.angle, ALLY_BULLET_DAMAGE, "ally", `ally:${a.armor}`);
				spawnMuzzleFlash(s, a.pos, a.angle);
				s.sfx?.play("allyShoot");
				a.cooldown = ALLY_FIRE_RATE;
			}
		} else {
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
				s.bucketHits += dmg;
			} else {
				best.ally.hp = Math.max(0, best.ally.hp - dmg);
				best.ally.hitFlash = 0.15;
				if (best.ally.hp <= 0 && best.ally.alive) {
					best.ally.alive = false;
					best.ally.respawnTimer = 0;
					spawnBlood(s, best.ally.pos, 18);
					s.events.push({
						kind: "ally_death",
						t: nowT(s),
						victim: `ally:${best.ally.armor}`,
					});
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
					if (b.team === "player") s.bucketKills += 1;
					spawnBlood(s, z.pos, 16);
					s.sfx?.play("zombieKill");
					const range = Math.hypot(
						b.pos.x - b.startPos.x,
						b.pos.y - b.startPos.y,
					);
					const t = nowT(s);
					if (b.team === "player") {
						const chainSeconds =
							s.lastPlayerKillMs < 0
								? 9999
								: (t - s.lastPlayerKillMs) / 1000;
						s.events.push({
							kind: "kill",
							t,
							killer: "player",
							victim: `zombie:${z.type}`,
							killerHp: Math.round(s.player.hp),
							killerMaxHp: s.player.maxHp,
							victimKind: z.type,
							range,
							chainSeconds,
						});
						s.lastPlayerKillMs = t;
						if (range > 350) {
							s.events.push({
								kind: "long_shot",
								t,
								killer: "player",
								range,
							});
						}
						if (
							s.lowHpFlaggedAt > 0 &&
							t - s.lowHpFlaggedAt < 1500 &&
							s.player.hp > 0
						) {
							s.events.push({
								kind: "low_hp_save",
								t,
								subject: "player",
								hpAfter: Math.round(s.player.hp),
							});
							s.lowHpFlaggedAt = -1;
						}
					} else {
						s.events.push({
							kind: "ally_kill",
							t,
							killer: b.owner,
							victim: `zombie:${z.type}`,
						});
					}
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
