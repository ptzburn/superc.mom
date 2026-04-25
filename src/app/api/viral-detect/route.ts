import { NextResponse } from "next/server";
import type { GameEvent } from "~/lib/ai-editor/types";
import {
	type FeatureSnapshot,
	detectViralMoments,
} from "~/lib/ai-editor/viral";

export const runtime = "nodejs";

export async function POST(req: Request) {
	let body: { events?: GameEvent[]; snapshots?: FeatureSnapshot[] };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return NextResponse.json(
			{ error: "invalid json" },
			{ status: 400 },
		);
	}
	const events = Array.isArray(body.events) ? body.events : [];
	const snapshots = Array.isArray(body.snapshots) ? body.snapshots : [];
	const moments = await detectViralMoments(events, snapshots);
	return NextResponse.json({ moments });
}
