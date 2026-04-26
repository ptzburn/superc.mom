import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

type GameOption = {
	slug: string;
	route: string;
	label: string;
};

function humanizeSlug(slug: string) {
	return slug
		.replaceAll("_", " ")
		.replaceAll("-", " ")
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

async function readMetadataTitle(pagePath: string) {
	try {
		const content = await fs.readFile(pagePath, "utf8");
		const match = content.match(/title:\s*["'`]([^"'`]+)["'`]/);
		return match?.[1]?.trim();
	} catch {
		return undefined;
	}
}

export async function GET() {
	const appDir = path.join(process.cwd(), "src", "app");
	const entries = await fs.readdir(appDir, { withFileTypes: true });
	const games: GameOption[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (!entry.name.startsWith("game") && entry.name !== "viral") continue;

		const pagePath = path.join(appDir, entry.name, "page.tsx");
		try {
			await fs.access(pagePath);
		} catch {
			continue;
		}

		const title = await readMetadataTitle(pagePath);
		const fallbackName = humanizeSlug(entry.name);
		games.push({
			slug: entry.name,
			route: `/${entry.name}`,
			label: `${entry.name} (${title ?? fallbackName})`,
		});
	}

	games.sort((a, b) => a.slug.localeCompare(b.slug));

	return NextResponse.json({ games });
}
