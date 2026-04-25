"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Background } from "./_components/Background";
import { EditorOverlay } from "./_components/EditorOverlay";
import { Footer } from "./_components/Footer";
import { HowItWorks } from "./_components/HowItWorks";
import { PhoneBezel } from "./_components/PhoneBezel";
import { PlanCards } from "./_components/PlanCards";
import { PlanStream } from "./_components/PlanStream";
import type {
	AppState,
	EditPlan,
	GameEvent,
	MatchEndPayload,
} from "./_components/types";

const EDITOR_STAGES = [
	"Decoding replay buffer",
	"Tagging signature moments",
	"Selecting hook & mood",
	"Cutting against the beat",
	"Sealing edit-plan",
];

export default function GameZPage() {
	const [state, setState] = useState<AppState>("idle");
	const [plan, setPlan] = useState<EditPlan | null>(null);
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [events, setEvents] = useState<GameEvent[]>([]);
	const [scores, setScores] = useState<number[]>([]);
	const [stageIdx, setStageIdx] = useState(0);
	const [iframeKey, setIframeKey] = useState(0);
	const iframeRef = useRef<HTMLIFrameElement | null>(null);

	const handleMatchEnd = useCallback(async (payload: MatchEndPayload) => {
		setEvents(payload.events ?? []);
		setScores(payload.scores ?? []);
		setBlobUrl(payload.blobUrl);
		setPlan(null);
		setState("editing");
		setStageIdx(0);

		try {
			const res = await fetch("/api/edit-plan", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ events: payload.events ?? [] }),
			});
			if (!res.ok) throw new Error(`edit-plan ${res.status}`);
			const next: EditPlan = await res.json();
			setPlan(next);
			setState("done");
		} catch (err) {
			console.error("[game_z] edit-plan failed", err);
			// fallback so demo never softlocks
			setPlan({
				mood: "hype",
				audio: "shadow_low_end_140bpm",
				hook: "they thought it was over",
				shots: (payload.events ?? []).slice(0, 6).map((e, i) => ({
					eventIndex: i,
					caption:
						typeof e?.type === "string"
							? e.type.toUpperCase()
							: `MOMENT ${i + 1}`,
					lengthMs: 900,
					transition: i % 2 === 0 ? "whip" : "flash",
				})),
				outro: "follow for more clutch.",
			});
			setState("done");
		}
	}, []);

	// listen for iframe postMessage
	useEffect(() => {
		const onMsg = (e: MessageEvent) => {
			const data = e.data as Partial<MatchEndPayload> | undefined;
			if (!data || typeof data !== "object") return;
			if (data.type !== "BRRAWL_MATCH_END") return;
			handleMatchEnd(data as MatchEndPayload);
		};
		window.addEventListener("message", onMsg);
		return () => window.removeEventListener("message", onMsg);
	}, [handleMatchEnd]);

	// rotate editor stage labels while loading
	useEffect(() => {
		if (state !== "editing") return;
		const id = setInterval(() => {
			setStageIdx((i) => (i + 1) % EDITOR_STAGES.length);
		}, 1100);
		return () => clearInterval(id);
	}, [state]);

	const handlePlayAgain = useCallback(() => {
		setState("idle");
		setPlan(null);
		setBlobUrl(null);
		setEvents([]);
		setScores([]);
		setIframeKey((k) => k + 1);
	}, []);

	return (
		<main className="relative min-h-screen w-full overflow-x-hidden text-white">
			<Background />

			{/* Top bar */}
			<header className="relative z-10 mx-auto flex max-w-[1280px] items-center justify-between px-6 pt-6 md:px-10">
				<div className="flex items-center gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 ring-1 ring-white/20">
						<div className="h-2.5 w-2.5 rounded-sm bg-black/80" />
					</div>
					<div>
						<div className="font-semibold text-[14px] text-white tracking-tight">
							Brrawl Edits
						</div>
						<div className="font-mono text-[9.5px] text-white/40 uppercase tracking-[.3em]">
							ai · in-browser
						</div>
					</div>
				</div>
				<nav className="hidden items-center gap-7 font-mono text-[11px] text-white/55 uppercase tracking-[.18em] md:flex">
					<a className="transition hover:text-white" href="#play">
						play
					</a>
					<a className="transition hover:text-white" href="#decisions">
						decisions
					</a>
					<a className="transition hover:text-white" href="#how">
						pipeline
					</a>
				</nav>
				<div className="hidden items-center gap-2 font-mono text-[10px] text-white/45 tracking-wider md:flex">
					<div className="h-[6px] w-[6px] animate-pulse rounded-full bg-emerald-400" />
					LIVE DEMO
				</div>
			</header>

			{/* HERO */}
			<section
				className="relative z-10 mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-6 pt-12 pb-16 md:px-10 md:pt-20 md:pb-24 lg:grid-cols-12 lg:gap-14"
				id="play"
			>
				{/* LEFT: copy */}
				<div className="lg:col-span-6 lg:pt-6">
					<div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] py-1 pr-3 pl-1 backdrop-blur">
						<span className="rounded-full bg-gradient-to-r from-violet-500 to-orange-400 px-2 py-0.5 font-mono text-[10px] text-black tracking-widest">
							NEW
						</span>
						<span className="font-mono text-[11px] text-white/65 uppercase tracking-[.18em]">
							watch · cut · ship
						</span>
					</div>

					<h1 className="mt-6 font-semibold text-[44px] leading-[1.02] tracking-tight md:text-[68px] lg:text-[80px]">
						Your gameplay,
						<br />
						<span
							className="bg-gradient-to-r from-violet-300 via-cyan-300 to-orange-300 bg-clip-text text-transparent"
							style={{
								backgroundSize: "200% 100%",
								animation: "hero-shimmer 8s ease-in-out infinite",
							}}
						>
							edited by AI.
						</span>
					</h1>

					<p className="mt-6 max-w-xl text-[16px] text-white/65 leading-relaxed md:text-[17px]">
						Play a 90-second round. While you fight, an in-browser model is
						already drafting the TikTok — picking the hook, the mood, the cuts.
						By the time you tap stop, the edit is ready.
					</p>

					<div className="mt-8 flex flex-wrap items-center gap-3">
						<a
							className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-[13px] text-black transition hover:bg-white/90"
							href="#decisions"
						>
							See AI decisions
							<span
								aria-hidden
								className="transition group-hover:translate-x-0.5"
							>
								→
							</span>
						</a>
						<a
							className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-5 py-3 font-medium text-[13px] text-white/85 backdrop-blur transition hover:bg-white/[0.06]"
							href="#how"
						>
							How it works
						</a>
					</div>

					{/* mini stats */}
					<div className="mt-12 grid max-w-md grid-cols-3 gap-6">
						<Stat k="< 2s" v="edit latency" />
						<Stat k="0" v="server frames" />
						<Stat k="9:16" v="ready for tiktok" />
					</div>
				</div>

				{/* RIGHT: phone + side panel */}
				<div className="grid grid-cols-1 gap-6 lg:col-span-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
					<div className="relative">
						{/* status chip above phone */}
						<div className="absolute -top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 backdrop-blur">
							<div
								className={`h-[6px] w-[6px] rounded-full ${
									state === "idle"
										? "animate-pulse bg-cyan-300"
										: state === "editing"
											? "animate-pulse bg-amber-300"
											: "bg-emerald-400"
								}`}
							/>
							<span className="font-mono text-[10px] text-white/70 uppercase tracking-[.25em]">
								{state === "idle"
									? "ready · play a match"
									: state === "editing"
										? "ai editing"
										: "edit ready"}
							</span>
						</div>

						<PhoneBezel
							dim={state === "editing"}
							haloMood={plan?.mood ?? "idle"}
						>
							{state !== "done" && (
								<iframe
									allow="autoplay; fullscreen; clipboard-write"
									className="absolute inset-0 z-0 h-full w-full rounded-[44px] border-0"
									key={iframeKey}
									ref={iframeRef}
									scrolling="no"
									src="/game_z/index.html"
									title="Brrawl Stars"
								/>
							)}

							{state === "editing" && (
								<EditorOverlay stage={EDITOR_STAGES[stageIdx] ?? ""} />
							)}

							{state === "done" && blobUrl && (
								<div className="relative z-0 h-full w-full">
									{/* eslint-disable-next-line jsx-a11y/media-has-caption */}
									<video
										autoPlay
										className="absolute inset-0 h-full w-full object-cover"
										loop
										muted
										playsInline
										src={blobUrl}
									/>
									{/* tiktok-ish overlay */}
									<div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
									<div className="absolute right-3 bottom-20 flex flex-col items-center gap-4">
										{["♥", "✦", "↗"].map((g, i) => (
											<div
												className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/90 text-xl backdrop-blur"
												key={g}
												style={{
													animation: `done-pop 600ms ease-out ${i * 120}ms backwards`,
												}}
											>
												{g}
											</div>
										))}
									</div>
									<div className="absolute right-4 bottom-4 left-4 flex flex-col gap-2">
										{plan && (
											<div className="font-semibold text-[13px] text-white drop-shadow">
												"{plan.hook}"
											</div>
										)}
										<div className="flex gap-2">
											<a
												className="flex-1 rounded-full bg-white px-3 py-2 text-center font-semibold text-[11px] text-black uppercase tracking-wider transition hover:bg-white/90"
												download="brrawl-edit.webm"
												href={blobUrl}
											>
												Download MP4
											</a>
											<button
												className="flex-1 rounded-full border border-white/30 bg-black/50 px-3 py-2 text-center font-semibold text-[11px] text-white uppercase tracking-wider backdrop-blur transition hover:bg-black/70"
												onClick={handlePlayAgain}
												type="button"
											>
												Play again
											</button>
										</div>
									</div>
								</div>
							)}
						</PhoneBezel>

						{/* score badge */}
						{state === "done" && scores.length > 0 && (
							<div className="absolute -bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 backdrop-blur">
								<span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">
									final
								</span>
								<span className="font-mono text-[12px] text-white tracking-wider">
									{scores.join(" : ")}
								</span>
							</div>
						)}
					</div>

					{/* side panel: terminal stream */}
					<div className="lg:pt-2">
						<PlanStream loading={state === "editing"} plan={plan} />
						<div className="mt-3 flex items-center gap-2 px-1 font-mono text-[10px] text-white/40 uppercase tracking-wider">
							<div className="h-[5px] w-[5px] rounded-full bg-violet-300" />
							<span>{events.length} events captured</span>
							<span className="ml-auto">/api/edit-plan</span>
						</div>
					</div>
				</div>
			</section>

			{/* DECISIONS */}
			<section
				className="relative z-10 mx-auto max-w-[1280px] px-6 pb-20 md:px-10"
				id="decisions"
			>
				<PlanCards plan={plan} />
			</section>

			{/* HOW IT WORKS */}
			<section
				className="relative z-10 mx-auto max-w-[1280px] px-6 pb-20 md:px-10"
				id="how"
			>
				<HowItWorks />
			</section>

			{/* FOOTER */}
			<div className="relative z-10 mx-auto max-w-[1280px] px-6 pb-12 md:px-10">
				<Footer />
			</div>

			<style>{`
				@keyframes hero-shimmer {
					0%, 100% { background-position: 0% 50%; }
					50% { background-position: 100% 50%; }
				}
				@keyframes done-pop {
					from { opacity: 0; transform: translateY(8px) scale(.85); }
					to   { opacity: 1; transform: translateY(0) scale(1); }
				}
			`}</style>
		</main>
	);
}

function Stat({ k, v }: { k: string; v: string }) {
	return (
		<div>
			<div className="bg-gradient-to-br from-white to-white/55 bg-clip-text font-semibold text-[26px] text-transparent tracking-tight">
				{k}
			</div>
			<div className="mt-1 font-mono text-[10px] text-white/45 uppercase tracking-[.18em]">
				{v}
			</div>
		</div>
	);
}
