import { z } from "zod";
import {
	getLatestAnalysisByGame,
	getRecentSessionsByGame,
	getStatsByGame,
} from "~/server/analytics-store";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const dashboardRouter = createTRPCRouter({
	getStats: publicProcedure
		.input(z.object({ gameSlug: z.string().optional() }).optional())
		.query(async ({ input }) => {
			return getStatsByGame(input?.gameSlug);
		}),

	getLatestAnalysis: publicProcedure
		.input(z.object({ gameSlug: z.string().optional() }).optional())
		.query(async ({ input }) => {
			const analysis = await getLatestAnalysisByGame(input?.gameSlug);
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

	getRecentSessions: publicProcedure
		.input(z.object({ gameSlug: z.string().optional() }).optional())
		.query(async ({ input }) => {
			return getRecentSessionsByGame(input?.gameSlug, 15);
		}),
});
