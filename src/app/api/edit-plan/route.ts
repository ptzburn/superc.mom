import { NextResponse } from "next/server";
import { getEditPlan } from "~/lib/ai-editor";
import type { GameEvent } from "~/lib/ai-editor/types";

export async function POST(req: Request) {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json(
			{ error: "invalid JSON body" },
			{ status: 400 },
		);
	}

	if (
		!body ||
		typeof body !== "object" ||
		!("events" in body) ||
		!Array.isArray((body as { events: unknown }).events)
	) {
		return NextResponse.json(
			{ error: "expected { events: GameEvent[] }" },
			{ status: 400 },
		);
	}

	const events = (body as { events: GameEvent[] }).events;
	const plan = await getEditPlan(events);
	return NextResponse.json(plan);
}
