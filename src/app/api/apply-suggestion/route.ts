import { NextResponse } from "next/server";
import { applySuggestionToGameCode } from "~/server/game-tuning";

export async function POST(req: Request) {
	const body = (await req.json().catch(() => ({}))) as {
		gameSlug?: string;
		param?: string;
		suggested?: number | string;
	};

	if (!body.param || body.suggested === undefined) {
		return NextResponse.json(
			{ error: "Missing required fields: param and suggested." },
			{ status: 400 },
		);
	}

	const result = await applySuggestionToGameCode({
		gameSlug: (body.gameSlug ?? "game").replace(/^\//, ""),
		param: body.param,
		suggested: body.suggested,
	});

	if (!result.ok) {
		return NextResponse.json({ error: result.error }, { status: 400 });
	}

	return NextResponse.json({
		ok: true,
		updatedConstant: result.updatedConstant,
		updatedValue: result.updatedValue,
	});
}
