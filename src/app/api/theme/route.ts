import { NextResponse } from "next/server";
import { z } from "zod";
import { getThemeArt } from "~/lib/ai-theme";

export const maxDuration = 60;

const BODY_SCHEMA = z.object({
	arena: z.string().min(3).max(500),
	enemy: z.string().min(3).max(500),
	ally: z.string().min(3).max(500),
});

export async function POST(req: Request) {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const parsed = BODY_SCHEMA.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid prompts", issues: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	try {
		const art = await getThemeArt(
			parsed.data.arena,
			parsed.data.enemy,
			parsed.data.ally,
		);
		return NextResponse.json(art);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
