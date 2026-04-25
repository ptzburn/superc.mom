export type GameEvent = {
	type: string;
	t?: number;
	[key: string]: unknown;
};

export type EditPlanShot = {
	eventIndex: number;
	caption: string;
	lengthMs: number;
	transition?: "cut" | "whip" | "flash" | "glitch";
};

export type EditPlanMood = "hype" | "menacing" | "cocky" | "comeback";

export type EditPlan = {
	mood: EditPlanMood;
	audio: string;
	hook: string;
	shots: EditPlanShot[];
	outro: string;
};

export type MatchEndPayload = {
	type: "BRRAWL_MATCH_END";
	events: GameEvent[];
	scores: number[];
	blobUrl: string;
};

export type AppState = "idle" | "editing" | "done";
