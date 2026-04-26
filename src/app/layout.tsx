import "~/styles/globals.css";

import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
	title: "Viral — Brown Stacks",
	description: "Wave-based arena shooter with AI viral-clip editor.",
	manifest: "/manifest.webmanifest",
	icons: [
		{ rel: "icon", url: "/favicon.ico" },
		{ rel: "icon", type: "image/png", sizes: "192x192", url: "/icons/icon-192.png" },
		{ rel: "icon", type: "image/png", sizes: "512x512", url: "/icons/icon-512.png" },
		{ rel: "apple-touch-icon", url: "/icons/apple-touch-icon.png" },
	],
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: "Viral",
	},
	applicationName: "Viral",
	formatDetection: { telephone: false },
};

export const viewport: Viewport = {
	themeColor: "#020305",
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	viewportFit: "cover",
	colorScheme: "dark",
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html className={`${geist.variable}`} lang="en">
			<body>
				<TRPCReactProvider>{children}</TRPCReactProvider>
				{/* Register service worker after hydration */}
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: tiny inline SW registration */}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: inline SW registration
					dangerouslySetInnerHTML={{
						__html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(()=>{}); }); }`,
					}}
				/>
			</body>
		</html>
	);
}
