import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Game Z — Brawl Killer",
};

export default function GameZPage() {
	return (
		<main className="h-screen w-full bg-black">
			<iframe
				allow="fullscreen"
				className="h-full w-full border-0"
				src="/game_z/index.html"
				title="Brawl Killer"
			/>
		</main>
	);
}
