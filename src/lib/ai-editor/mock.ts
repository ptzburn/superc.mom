import type { EditPlan, GameEvent } from "./types";

/**
 * Re-implements the in-game viral score so the deterministic mock matches
 * what the game's heuristic considers "highlight-worthy".
 */
function scoreEvent(e: GameEvent): number {
	switch (e.kind) {
		case "kill": {
			let s = 30;
			if (e.chainSeconds < 4) s += 40;
			if (e.chainSeconds < 2) s += 30;
			if (e.killerMaxHp > 0 && e.killerHp / e.killerMaxHp < 0.25) s += 35;
			if (e.range > 400) s += 25;
			return s;
		}
		case "ally_kill":
			return 20;
		case "ally_death":
			return -10;
		case "low_hp_save":
			return 45;
		case "long_shot":
			return 35;
		case "match_end":
			return e.result === "win" ? 50 : 15;
	}
}

function moodFromEvents(events: GameEvent[]): EditPlan["mood"] {
	const end = events.find((e) => e.kind === "match_end") as
		| Extract<GameEvent, { kind: "match_end" }>
		| undefined;
	const allyDeaths = events.filter((e) => e.kind === "ally_death").length;
	const lowHpSaves = events.filter((e) => e.kind === "low_hp_save").length;

	if (end?.result === "loss") return "menacing";
	if (allyDeaths >= 2 && end?.result === "win") return "comeback";
	if (lowHpSaves >= 1 && end?.result === "win") return "comeback";
	const kills = events.filter((e) => e.kind === "kill").length;
	if (kills >= 4) return "cocky";
	return "hype";
}

function audioForMood(mood: EditPlan["mood"]): EditPlan["audio"] {
	if (mood === "menacing") return "phonk_menacing";
	if (mood === "cocky") return "phonk_cocky";
	return "phonk_hype";
}

function hookForMood(mood: EditPlan["mood"]): string {
	switch (mood) {
		case "comeback":
			return "down bad. then this happened.";
		case "menacing":
			return "they thought they had me.";
		case "cocky":
			return "easy work. watch this.";
		default:
			return "lobby never stood a chance.";
	}
}

function outroForMood(mood: EditPlan["mood"]): string {
	switch (mood) {
		case "comeback":
			return "follow for more clutch";
		case "menacing":
			return "we ride at dawn";
		case "cocky":
			return "skill issue. follow up.";
		default:
			return "drop a follow. gg";
	}
}

function captionForEvent(e: GameEvent, indexInShot: number): string {
	switch (e.kind) {
		case "kill": {
			const lowHp = e.killerMaxHp > 0 && e.killerHp / e.killerMaxHp < 0.25;
			if (lowHp) return `still on [${e.killerHp}HP]`;
			if (e.chainSeconds < 2) return "[INSTANT]. gone.";
			if (e.range > 400) return `[${Math.round(e.range)}M] sniper`;
			if (indexInShot === 0) return "[FIRST] DOWN";
			return "[3 SHOTS]. 3 down.";
		}
		case "ally_kill":
			return "team [LOCKED] in";
		case "ally_death":
			return "down a [MAN]";
		case "low_hp_save":
			return `clutch on [${e.hpAfter}HP]`;
		case "long_shot":
			return `[${Math.round(e.range)}M] dot`;
		case "match_end":
			return e.result === "win" ? "[GG]. ez." : "[L] but lessons";
	}
}

function transitionFor(
	e: GameEvent,
	idx: number,
): "cut" | "whip" | "flash" | "glitch" | undefined {
	if (idx === 0) return "cut";
	if (e.kind === "kill" && e.chainSeconds < 2) return "whip";
	if (e.kind === "low_hp_save") return "glitch";
	if (e.kind === "long_shot") return "flash";
	return "cut";
}

function lengthFor(e: GameEvent): number {
	switch (e.kind) {
		case "kill":
			return e.chainSeconds < 2 ? 2200 : 2800;
		case "ally_kill":
			return 2200;
		case "ally_death":
			return 2400;
		case "low_hp_save":
			return 3500;
		case "long_shot":
			return 3000;
		case "match_end":
			return 3200;
	}
}

/**
 * Deterministic offline fallback. Picks the top 3-5 events by viral score,
 * orders them chronologically, and produces a CapCut-style edit plan.
 */
export function mockEditPlan(events: GameEvent[]): EditPlan {
	const indexed = events.map((e, i) => ({ event: e, originalIndex: i }));
	const ranked = [...indexed].sort(
		(a, b) => scoreEvent(b.event) - scoreEvent(a.event),
	);

	// Aim for 3-5 shots; total runtime must land in [12000, 22000].
	const desired = Math.min(5, Math.max(3, Math.min(ranked.length, 5)));
	const picked = ranked.slice(0, desired);
	picked.sort((a, b) => a.event.t - b.event.t);

	const mood = moodFromEvents(events);
	const shots = picked.map((p, i) => ({
		eventIndex: p.originalIndex,
		caption: captionForEvent(p.event, i),
		lengthMs: lengthFor(p.event),
		transition: transitionFor(p.event, i),
	}));

	// Clamp total runtime into [12000, 22000].
	const MIN = 12000;
	const MAX = 22000;
	let total = shots.reduce((acc, s) => acc + s.lengthMs, 0);
	if (total < MIN && shots.length > 0) {
		const add = Math.ceil((MIN - total) / shots.length);
		for (const s of shots) s.lengthMs = Math.min(4500, s.lengthMs + add);
		total = shots.reduce((acc, s) => acc + s.lengthMs, 0);
	}
	if (total > MAX && shots.length > 0) {
		const remove = Math.ceil((total - MAX) / shots.length);
		for (const s of shots) s.lengthMs = Math.max(2000, s.lengthMs - remove);
	}

	return {
		mood,
		audio: audioForMood(mood),
		hook: hookForMood(mood),
		shots,
		outro: outroForMood(mood),
	};
}
