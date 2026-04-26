import { dashboardRouter } from "~/server/api/routers/dashboard";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
	dashboard: dashboardRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/** Create a server-side caller for the tRPC API. */
export const createCaller = createCallerFactory(appRouter);
