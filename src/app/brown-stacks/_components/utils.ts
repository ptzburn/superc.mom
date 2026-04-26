import type { GameEvent, GameRuntime } from "./types";

export function viralScore(e: GameEvent): number {
	let s = 0;
	if (e.kind === "kill") {
		s += 30;
		if (e.chainSeconds < 4) s += 40;
		if (e.chainSeconds < 2) s += 30;
		if (e.killerHp / e.killerMaxHp < 0.25) s += 35;
		if (e.range > 400) s += 25;
	}
	if (e.kind === "low_hp_save") s += 25;
	if (e.kind === "ally_death") s -= 10;
	if (e.kind === "match_end") s += e.result === "win" ? 50 : 15;
	return s;
}

export function nowT(s: GameRuntime) {
	return performance.now() - s.matchStartMs;
}

export function clamp(n: number, min: number, max: number) {
	return Math.min(Math.max(n, min), max);
}

export function rand(min: number, max: number) {
	return min + Math.random() * (max - min);
}

export function chance(p: number) {
	return Math.random() < p;
}
