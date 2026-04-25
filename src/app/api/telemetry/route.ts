import { NextResponse } from "next/server";
import { appendSession } from "~/server/analytics-store";

export async function POST(req: Request) {
	const body = (await req.json()) as {
		gameSlug?: string;
		waveReached: number;
		kills: number;
		durationSeconds: number;
	};

	await appendSession({
		gameSlug: body.gameSlug,
		waveReached: Number(body.waveReached),
		kills: Number(body.kills),
		durationSeconds: Number(body.durationSeconds),
	});

	return NextResponse.json({ ok: true });
}
