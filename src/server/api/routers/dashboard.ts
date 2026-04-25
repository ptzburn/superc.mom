import { desc } from "drizzle-orm";
import { balanceAnalyses, gameSessions } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const dashboardRouter = createTRPCRouter({
	getStats: publicProcedure.query(async ({ ctx }) => {
		const sessions = await ctx.db
			.select()
			.from(gameSessions)
			.orderBy(desc(gameSessions.createdAt))
			.limit(200);

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
	}),

	getLatestAnalysis: publicProcedure.query(async ({ ctx }) => {
		const [analysis] = await ctx.db
			.select()
			.from(balanceAnalyses)
			.orderBy(desc(balanceAnalyses.createdAt))
			.limit(1);

		if (!analysis) return null;

		return {
			id: analysis.id,
			summary: analysis.summary,
			createdAt: analysis.createdAt,
			data: JSON.parse(analysis.analysisJson) as {
				problems: string[];
				suggestions: { param: string; current: number | string; suggested: number | string; reason: string; impact: string }[];
				earlyGame: string;
				estimatedRetentionGain: string;
			},
		};
	}),

	getRecentSessions: publicProcedure.query(async ({ ctx }) => {
		return ctx.db
			.select()
			.from(gameSessions)
			.orderBy(desc(gameSessions.createdAt))
			.limit(15);
	}),
});
