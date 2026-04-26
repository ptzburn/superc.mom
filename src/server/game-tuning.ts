import { promises as fs } from "node:fs";
import path from "node:path";
import { getGameDescriptor } from "./game-descriptors";

export async function applySuggestionToGameCode(input: {
	gameSlug: string;
	param: string;
	suggested: string | number;
}) {
	const descriptor = getGameDescriptor(input.gameSlug);

	if (!descriptor.sourceFile) {
		return {
			ok: false as const,
			error: `No source file configured for game '${input.gameSlug}'.`,
		};
	}

	const mappedConst = descriptor.paramToConst[input.param];
	if (!mappedConst) {
		return {
			ok: false as const,
			error: `Unsupported param '${input.param}' for game '${input.gameSlug}'.`,
		};
	}

	const numeric = Number(input.suggested);
	if (!Number.isFinite(numeric)) {
		return {
			ok: false as const,
			error: `Suggested value '${input.suggested}' is not a number.`,
		};
	}

	const filePath = path.join(process.cwd(), descriptor.sourceFile);
	let file: string;
	try {
		file = await fs.readFile(filePath, "utf8");
	} catch {
		return {
			ok: false as const,
			error: `Could not read source file for game '${input.gameSlug}'.`,
		};
	}

	if (mappedConst.includes(".")) {
		const result = applyObjectProperty(file, mappedConst, numeric);
		if (!result.ok) return result;
		await fs.writeFile(filePath, result.next, "utf8");
		return {
			ok: true as const,
			updatedConstant: mappedConst,
			updatedValue: numeric,
		};
	}

	const matcher = new RegExp(`(const\\s+${mappedConst}\\s*=\\s*)([^;]+)(;)`);
	if (!matcher.test(file)) {
		return {
			ok: false as const,
			error: `Could not find constant ${mappedConst} in source file for game '${input.gameSlug}'.`,
		};
	}

	const next = file.replace(matcher, `$1${numeric}$3`);
	await fs.writeFile(filePath, next, "utf8");

	return {
		ok: true as const,
		updatedConstant: mappedConst,
		updatedValue: numeric,
	};
}

function applyObjectProperty(
	file: string,
	dotPath: string,
	value: number,
): { ok: true; next: string } | { ok: false; error: string } {
	const parts = dotPath.split(".");
	if (parts.length < 2) {
		return { ok: false, error: `Invalid dotPath: ${dotPath}` };
	}

	const propName = parts[parts.length - 1]!;

	// e.g. BRAWLERS.A.hp -> find the object literal for BRAWLERS, then key A, then property hp
	// Build a regex that finds the property in context.
	// For "BRAWLERS.A.hp", we look for the A: { ... hp: <value> ... } block
	if (parts.length === 3) {
		const [objName, key, prop] = parts as [string, string, string];
		const pattern = new RegExp(
			`(${objName}[\\s\\S]*?${key}\\s*:\\s*\\{[^}]*?${prop}\\s*:\\s*)(\\d+(?:\\.\\d+)?)`,
		);
		if (!pattern.test(file)) {
			return { ok: false, error: `Could not find ${dotPath} in source file.` };
		}
		const next = file.replace(pattern, `$1${value}`);
		return { ok: true, next };
	}

	return { ok: false, error: `Unsupported dotPath depth: ${dotPath}` };
}
