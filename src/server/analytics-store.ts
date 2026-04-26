import { promises as fs } from "node:fs";
import path from "node:path";

type StoredSession = {
	id: string;
	gameSlug: string;
	waveReached: number;
	kills: number;
	durationSeconds: number;
	createdAt: string;
};

type StoredAnalysis = {
	id: string;
	gameSlug: string;
	summary: string;
	analysisJson: string;
	createdAt: string;
};

type AnalyticsStore = {
	sessions: StoredSession[];
	analyses: StoredAnalysis[];
};

const STORE_PATH = path.join(process.cwd(), "data", "analytics.json");

let writeQueue: Promise<void> = Promise.resolve();

function normalizeGameSlug(gameSlug?: string) {
	if (!gameSlug) return "brown-stacks";
	return gameSlug.replace(/^\//, "") || "brown-stacks";
}

async function ensureStoreFile() {
	await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
	try {
		await fs.access(STORE_PATH);
	} catch {
		const initial: AnalyticsStore = { sessions: [], analyses: [] };
		await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
	}
}

async function readStore(): Promise<AnalyticsStore> {
	await ensureStoreFile();
	const raw = await fs.readFile(STORE_PATH, "utf8");
	const parsed = JSON.parse(raw) as Partial<AnalyticsStore>;
	return {
		sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
		analyses: Array.isArray(parsed.analyses) ? parsed.analyses : [],
	};
}

function queueWrite(mutator: (store: AnalyticsStore) => void | Promise<void>) {
	writeQueue = writeQueue.then(async () => {
		const store = await readStore();
		await mutator(store);
		await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
	});
	return writeQueue;
}

export async function appendSession(input: {
	gameSlug?: string;
	waveReached: number;
	kills: number;
	durationSeconds: number;
}) {
	await queueWrite((store) => {
		store.sessions.push({
			id: crypto.randomUUID(),
			gameSlug: normalizeGameSlug(input.gameSlug),
			waveReached: Number(input.waveReached),
			kills: Number(input.kills),
			durationSeconds: Number(input.durationSeconds),
			createdAt: new Date().toISOString(),
		});
	});
}

export async function getRecentSessionsByGame(gameSlug?: string, limit = 15) {
	const target = normalizeGameSlug(gameSlug);
	const store = await readStore();
	return store.sessions
		.filter((s) => s.gameSlug === target)
		.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
		.slice(0, limit);
}

export async function getStatsByGame(gameSlug?: string) {
	const sessions = await getRecentSessionsByGame(gameSlug, 200);
	if (sessions.length === 0) {
		return { totalSessions: 0, avgWave: 0, avgKills: 0, avgDuration: 0, waveDist: {} as Record<number, number> };
	}

	const total = sessions.length;
	const avgWave = sessions.reduce((s, g) => s + g.waveReached, 0) / total;
	const avgKills = sessions.reduce((s, g) => s + g.kills, 0) / total;
	const avgDuration = sessions.reduce((s, g) => s + g.durationSeconds, 0) / total;

	const waveDist: Record<number, number> = {};
	for (const s of sessions) {
		waveDist[s.waveReached] = (waveDist[s.waveReached] ?? 0) + 1;
	}

	return { totalSessions: total, avgWave, avgKills, avgDuration, waveDist };
}

export async function appendAnalysis(input: {
	gameSlug?: string;
	summary: string;
	analysisJson: string;
}) {
	await queueWrite((store) => {
		store.analyses.push({
			id: crypto.randomUUID(),
			gameSlug: normalizeGameSlug(input.gameSlug),
			summary: input.summary,
			analysisJson: input.analysisJson,
			createdAt: new Date().toISOString(),
		});
	});
}

export async function getLatestAnalysisByGame(gameSlug?: string) {
	const target = normalizeGameSlug(gameSlug);
	const store = await readStore();
	return store.analyses
		.filter((a) => a.gameSlug === target)
		.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] ?? null;
}
