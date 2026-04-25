import { Fredoka } from "next/font/google";
import type { ReactNode } from "react";

const fredoka = Fredoka({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-brawl",
	display: "swap",
});

export default function GameLayout({ children }: { children: ReactNode }) {
	return (
		<div className={`${fredoka.className} ${fredoka.variable}`}>{children}</div>
	);
}
