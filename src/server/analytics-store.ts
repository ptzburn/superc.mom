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

// Vercel serverless functions have a read-only filesystem outside /tmp, and
// /tmp doesn't persist across invocations. For the demo we hold state in
// module memory and seed once from the bundled data/analytics.json (reads
// from the bundled deployment are fine — only writes break).
//
// Limitations:
//   - State is lost on cold-start (~5min idle, redeploys).
//   - If Vercel spins up multiple parallel instances, each has its own copy.
//   - For real persistence: swap to @vercel/kv, Postgres, or Turso/libSQL.
const SEED_PATH = path.join(process.cwd(), "data", "analytics.json");

let store: AnalyticsStore | null = null;
let initPromise: Promise<void> | null = null;

function normalizeGameSlug(gameSlug?: string) {
	if (!gameSlug) return "brown-stacks";
	return gameSlug.replace(/^\//, "") || "brown-stacks";
}

async function init(): Promise<void> {
	if (store) return;
	if (initPromise) return initPromise;
	initPromise = (async () => {
		try {
			const raw = await fs.readFile(SEED_PATH, "utf8");
			const parsed = JSON.parse(raw) as Partial<AnalyticsStore>;
			store = {
				sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
				analyses: Array.isArray(parsed.analyses) ? parsed.analyses : [],
			};
		} catch {
			store = { sessions: [], analyses: [] };
		}
	})();
	return initPromise;
}

async function readStore(): Promise<AnalyticsStore> {
	await init();
	if (!store) throw new Error("analytics-store init failed");
	return store;
}

export async function appendSession(input: {
	gameSlug?: string;
	waveReached: number;
	kills: number;
	durationSeconds: number;
}) {
	const s = await readStore();
	s.sessions.push({
		id: crypto.randomUUID(),
		gameSlug: normalizeGameSlug(input.gameSlug),
		waveReached: Number(input.waveReached),
		kills: Number(input.kills),
		durationSeconds: Number(input.durationSeconds),
		createdAt: new Date().toISOString(),
	});
}

export async function getRecentSessionsByGame(gameSlug?: string, limit = 15) {
	const target = normalizeGameSlug(gameSlug);
	const s = await readStore();
	return s.sessions
		.filter((x) => x.gameSlug === target)
		.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
		.slice(0, limit);
}

export async function getStatsByGame(gameSlug?: string) {
	const sessions = await getRecentSessionsByGame(gameSlug, 200);
	if (sessions.length === 0) {
		return {
			totalSessions: 0,
			avgWave: 0,
			avgKills: 0,
			avgDuration: 0,
			waveDist: {} as Record<number, number>,
		};
	}

	const total = sessions.length;
	const avgWave = sessions.reduce((s, g) => s + g.waveReached, 0) / total;
	const avgKills = sessions.reduce((s, g) => s + g.kills, 0) / total;
	const avgDuration =
		sessions.reduce((s, g) => s + g.durationSeconds, 0) / total;

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
	const s = await readStore();
	s.analyses.push({
		id: crypto.randomUUID(),
		gameSlug: normalizeGameSlug(input.gameSlug),
		summary: input.summary,
		analysisJson: input.analysisJson,
		createdAt: new Date().toISOString(),
	});
}

export async function getLatestAnalysisByGame(gameSlug?: string) {
	const target = normalizeGameSlug(gameSlug);
	const s = await readStore();
	return (
		s.analyses
			.filter((a) => a.gameSlug === target)
			.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] ??
		null
	);
}
