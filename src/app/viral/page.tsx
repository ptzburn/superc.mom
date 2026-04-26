import Game from "./_components/game";

export const metadata = {
	title: "Viral — AI clips your gameplay",
};

export default function ViralPage() {
	return (
		<main className="flex min-h-screen w-full items-center justify-center bg-neutral-950 p-4">
			<Game />
		</main>
	);
}
