import Game from "./_components/game";

export const metadata = {
	title: "Arena — Squad vs Zombies",
};

export default function GamePage() {
	return (
		<main className="flex min-h-screen w-full items-center justify-center bg-neutral-950 p-4">
			<Game />
		</main>
	);
}
