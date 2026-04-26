import type { ThemePack } from "./types";

/**
 * Module-level sprite overrides. When non-null, draw functions render the
 * AI-generated images on top of (or in place of) the procedural shapes.
 * Mutated by the in-menu "APPLY THEME" flow before `beginMatch`.
 */
let activeTheme: ThemePack | null = null;

export function getActiveTheme() {
	return activeTheme;
}

export function setActiveTheme(t: ThemePack | null) {
	activeTheme = t;
}

export function loadDataUrlImage(dataUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = document.createElement("img");
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("Could not decode theme image"));
		img.src = dataUrl;
	});
}
