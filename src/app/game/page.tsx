import Game from "./_components/game";

export const metadata = {
	title: "Arena — Squad vs Zombies",
};

export default function GamePage() {
	return (
		<main
			className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-3 sm:p-6"
			style={{
				background:
					"radial-gradient(120% 80% at 50% 15%, #7ec8ff 0%, #4a9ef0 28%, #2b6be7 55%, #1e3d7a 85%, #0f2348 100%)",
			}}
		>
			{/* Brawl-style sky & ground bands */}
			<div
				aria-hidden
				className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_90%_40%_at_50%_0%,rgba(255,255,255,0.25)_0%,transparent_55%)]"
			/>
			<div
				aria-hidden
				className="pointer-events-none fixed bottom-0 left-0 -z-10 h-[28%] w-full bg-gradient-to-t from-[#3d8a4a] via-[#5ab86a] to-transparent opacity-50"
			/>
			<Game />
		</main>
	);
}
