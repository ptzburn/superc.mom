import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { gameSessions } from "~/server/db/schema";

export async function POST(req: Request) {
	const body = (await req.json()) as {
		waveReached: number;
		kills: number;
		durationSeconds: number;
	};

	await db.insert(gameSessions).values({
		waveReached: Number(body.waveReached),
		kills: Number(body.kills),
		durationSeconds: Number(body.durationSeconds),
	});

	return NextResponse.json({ ok: true });
}
