"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { EditPlan } from "~/lib/ai-editor/types";
import type { FeatureSnapshot, ViralMoment } from "~/lib/ai-editor/viral";
import type { ThemeArt } from "~/lib/ai-theme";
import { ARENA_H, ARENA_W, PLAYER_MAX_HP } from "./constants";
import { render } from "./draw";
import { createMusicEngine, type MusicEngine } from "./music";
import {
	HelpRow,
	Overlay,
	StatPill,
	ThemeField,
	ViralVerdict,
} from "./overlays";
import { renderEdit } from "./renderEdit";
import { createSfxEngine, type SfxEngine } from "./sfx";
import { startWave, update } from "./simulation";
import { loadDataUrlImage, setActiveTheme } from "./theme";
import type { GameEvent, GameRuntime, Phase } from "./types";
import { createInitialState } from "./world";

export { viralScore } from "./utils";
export type { GameEvent } from "./types";

export default function Game() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const stateRef = useRef<GameRuntime>(createInitialState());
	const musicRef = useRef<MusicEngine | null>(null);
	const sfxRef = useRef<SfxEngine | null>(null);
	const sessionStartRef = useRef<number>(0);
	const telemetrySentRef = useRef(false);
	const [, setTick] = useState(0);
	const [muted, setMuted] = useState(false);
	const recorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const eventsRef = useRef<GameEvent[]>([]);
	const snapshotsRef = useRef<FeatureSnapshot[]>([]);
	const matchEndedAtRef = useRef<number>(0);
	const [matchSummary, setMatchSummary] = useState<{
		eventCount: number;
		snapshotCount: number;
		blobUrl: string | null;
	}>({ eventCount: 0, snapshotCount: 0, blobUrl: null });
	const [viralState, setViralState] = useState<{
		status: "idle" | "detecting" | "done";
		moments: ViralMoment[];
	}>({ status: "idle", moments: [] });
	const [editState, setEditState] = useState<{
		status: "idle" | "loading" | "done" | "error";
		plan: EditPlan | null;
	}>({ status: "idle", plan: null });
	const [videoState, setVideoState] = useState<{
		status: "idle" | "rendering" | "done" | "error";
		progress: number;
		blobUrl: string | null;
	}>({ status: "idle", progress: 0, blobUrl: null });
	const [hud, setHud] = useState({
		hp: PLAYER_MAX_HP,
		maxHp: PLAYER_MAX_HP,
		wave: 0,
		kills: 0,
		alliesAlive: 3,
		alliesTotal: 3,
		phase: "menu" as Phase,
		paused: false,
	});

	const [arenaPrompt, setArenaPrompt] = useState(
		"Neon ruins, cracked marble, ember glow, moonlit",
	);
	const [enemyPrompt, setEnemyPrompt] = useState(
		"Mecha-mummy jackals, rust and teal metal",
	);
	const [allyPrompt, setAllyPrompt] = useState(
		"Chrome knights, white capes, electric trim",
	);
	const [themeStatus, setThemeStatus] = useState<
		"idle" | "loading" | "ready" | "error"
	>("idle");
	const [themeError, setThemeError] = useState<string | null>(null);
	const [theme, setTheme] = useState<ThemeArt | null>(null);
	const [showThemePanel, setShowThemePanel] = useState(false);
	const themeAudioRef = useRef<HTMLAudioElement | null>(null);

	const applyTheme = async () => {
		setThemeStatus("loading");
		setThemeError(null);
		try {
			const res = await fetch("/api/theme", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					arena: arenaPrompt,
					enemy: enemyPrompt,
					ally: allyPrompt,
				}),
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(data.error ?? `theme ${res.status}`);
			}
			const next = (await res.json()) as ThemeArt;
			const [arenaImg, enemyImg, allyImg] = await Promise.all([
				loadDataUrlImage(next.arena),
				loadDataUrlImage(next.enemy),
				loadDataUrlImage(next.ally),
			]);
			setActiveTheme({ arena: arenaImg, enemy: enemyImg, ally: allyImg });
			setTheme(next);
			setThemeStatus("ready");
		} catch (err) {
			setThemeStatus("error");
			setThemeError(
				err instanceof Error ? err.message : "Could not build theme",
			);
		}
	};

	const clearTheme = () => {
		setTheme(null);
		setActiveTheme(null);
		setThemeStatus("idle");
		setThemeError(null);
		setShowThemePanel(false);
		const audio = themeAudioRef.current;
		if (audio) {
			audio.pause();
			audio.currentTime = 0;
		}
	};

	const submitTelemetry = (preferBeacon = false) => {
		if (telemetrySentRef.current) return;
		const state = stateRef.current;
		if (sessionStartRef.current <= 0) return;
		if (state.phase === "menu") return;
		telemetrySentRef.current = true;
		const duration = Math.max(
			1,
			Math.round((Date.now() - sessionStartRef.current) / 1000),
		);
		const payload = JSON.stringify({
			gameSlug: "brown-stacks",
			waveReached: state.wave,
			kills: state.kills,
			durationSeconds: duration,
		});
		if (preferBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
			const blob = new Blob([payload], { type: "application/json" });
			const sent = navigator.sendBeacon("/api/telemetry", blob);
			if (sent) return;
		}
		void fetch("/api/telemetry", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: payload,
			keepalive: preferBeacon,
		}).catch(() => {});
	};

	useEffect(() => {
		musicRef.current = createMusicEngine();
		sfxRef.current = createSfxEngine();
		stateRef.current.sfx = sfxRef.current;
		const audio = new Audio();
		audio.loop = true;
		audio.preload = "auto";
		themeAudioRef.current = audio;
		return () => {
			musicRef.current?.dispose();
			sfxRef.current?.dispose();
			musicRef.current = null;
			sfxRef.current = null;
			audio.pause();
			audio.src = "";
			themeAudioRef.current = null;
		};
	}, []);

	useEffect(() => {
		musicRef.current?.setMuted(muted);
		sfxRef.current?.setMuted(muted);
		const audio = themeAudioRef.current;
		if (audio) audio.volume = muted ? 0 : 0.6;
	}, [muted]);

	useEffect(() => {
		const m = musicRef.current;
		const audio = themeAudioRef.current;
		if (!m) return;
		const playing = hud.phase === "playing" && !hud.paused;
		if (playing) {
			if (theme && audio) {
				m.stop();
				const src = `/audio/${theme.musicMood}.mp3`;
				if (!audio.src.endsWith(src)) audio.src = src;
				audio.volume = muted ? 0 : 0.6;
				void audio.play().catch(() => {});
			} else {
				audio?.pause();
				m.start();
			}
		} else {
			m.stop();
			audio?.pause();
		}
	}, [hud.phase, hud.paused, theme, muted]);

	useEffect(() => {
		if (hud.phase !== "gameover") return;
		const events = [...stateRef.current.events];
		const snapshots = [...stateRef.current.snapshots];
		eventsRef.current = events;
		snapshotsRef.current = snapshots;
		matchEndedAtRef.current = Date.now();
		setMatchSummary({
			eventCount: events.length,
			snapshotCount: snapshots.length,
			blobUrl: null,
		});
		setViralState({ status: "detecting", moments: [] });

		const finishUp = async (blob: Blob | null) => {
			const blobUrl = blob ? URL.createObjectURL(blob) : null;
			setMatchSummary({
				eventCount: events.length,
				snapshotCount: snapshots.length,
				blobUrl,
			});
			try {
				const res = await fetch("/api/viral-detect", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ events, snapshots }),
				});
				if (!res.ok) throw new Error(`viral-detect ${res.status}`);
				const json = (await res.json()) as { moments: ViralMoment[] };
				setViralState({
					status: "done",
					moments: json.moments ?? [],
				});
			} catch (err) {
				console.error("[game] viral-detect failed", err);
				setViralState({ status: "done", moments: [] });
			}
		};

		const rec = recorderRef.current;
		if (rec && rec.state === "recording") {
			rec.onstop = () => {
				const blob =
					chunksRef.current.length > 0
						? new Blob(chunksRef.current, { type: "video/webm" })
						: null;
				void finishUp(blob);
			};
			try {
				rec.stop();
			} catch {
				void finishUp(null);
			}
		} else {
			void finishUp(null);
		}
	}, [hud.phase]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = ARENA_W * dpr;
		canvas.height = ARENA_H * dpr;
		canvas.style.width = `${ARENA_W}px`;
		canvas.style.height = `${ARENA_H}px`;
		ctx.scale(dpr, dpr);

		let raf = 0;
		let last = performance.now();
		let hudClock = 0;

		const onKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			) {
				return;
			}
			const k = e.key.toLowerCase();
			if (
				k === "w" ||
				k === "a" ||
				k === "s" ||
				k === "d" ||
				k === "arrowup" ||
				k === "arrowdown" ||
				k === "arrowleft" ||
				k === "arrowright"
			) {
				e.preventDefault();
			}
			if (k === "escape") {
				const s = stateRef.current;
				if (s.phase === "playing") s.paused = !s.paused;
				return;
			}
			stateRef.current.keys.add(k);
		};
		const onKeyUp = (e: KeyboardEvent) => {
			stateRef.current.keys.delete(e.key.toLowerCase());
		};
		const onMouseMove = (e: MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			stateRef.current.mouse = {
				x: ((e.clientX - rect.left) / rect.width) * ARENA_W,
				y: ((e.clientY - rect.top) / rect.height) * ARENA_H,
			};
		};
		const onMouseDown = (e: MouseEvent) => {
			if (e.button === 0) stateRef.current.shooting = true;
		};
		const onMouseUp = (e: MouseEvent) => {
			if (e.button === 0) stateRef.current.shooting = false;
		};
		const onBlur = () => {
			stateRef.current.keys.clear();
			stateRef.current.shooting = false;
		};
		const onContextMenu = (e: MouseEvent) => e.preventDefault();

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		canvas.addEventListener("mousemove", onMouseMove);
		canvas.addEventListener("mousedown", onMouseDown);
		window.addEventListener("mouseup", onMouseUp);
		window.addEventListener("blur", onBlur);
		canvas.addEventListener("contextmenu", onContextMenu);

		const loop = (now: number) => {
			const dt = (now - last) / 1000;
			last = now;
			const s = stateRef.current;
			update(s, dt);
			render(ctx, s);

			hudClock += dt;
			if (hudClock > 0.1) {
				hudClock = 0;
				let alive = 0;
				for (const a of s.allies) if (a.alive) alive++;
				setHud({
					hp: Math.ceil(s.player.hp),
					maxHp: s.player.maxHp,
					wave: s.wave,
					kills: s.kills,
					alliesAlive: alive,
					alliesTotal: s.allies.length,
					phase: s.phase,
					paused: s.paused,
				});
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		setTick(1);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			canvas.removeEventListener("mousemove", onMouseMove);
			canvas.removeEventListener("mousedown", onMouseDown);
			window.removeEventListener("mouseup", onMouseUp);
			window.removeEventListener("blur", onBlur);
			canvas.removeEventListener("contextmenu", onContextMenu);
		};
	}, []);

	const startMatchRecording = () => {
		const canvas = canvasRef.current;
		if (!canvas || typeof MediaRecorder === "undefined") return;
		chunksRef.current = [];
		let stream: MediaStream;
		try {
			stream = canvas.captureStream(30);
		} catch {
			return;
		}
		let mime = "";
		for (const t of [
			"video/webm;codecs=vp9",
			"video/webm;codecs=vp8",
			"video/webm",
		]) {
			if (MediaRecorder.isTypeSupported(t)) {
				mime = t;
				break;
			}
		}
		try {
			const r = mime
				? new MediaRecorder(stream, {
						mimeType: mime,
						videoBitsPerSecond: 2_500_000,
					})
				: new MediaRecorder(stream);
			r.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};
			r.start(200);
			recorderRef.current = r;
		} catch {
			recorderRef.current = null;
		}
	};

	useEffect(() => {
		if (hud.phase === "gameover" && !telemetrySentRef.current) {
			submitTelemetry();
		}
	}, [hud.phase]);

	useEffect(() => {
		const onPageHide = () => submitTelemetry(true);
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") onPageHide();
		};
		window.addEventListener("pagehide", onPageHide);
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			onPageHide();
			window.removeEventListener("pagehide", onPageHide);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, []);

	const startGame = () => {
		const s = createInitialState();
		s.phase = "playing";
		s.sfx = sfxRef.current;
		s.matchStartMs = performance.now();
		startWave(s, 1);
		stateRef.current = s;
		sessionStartRef.current = Date.now();
		telemetrySentRef.current = false;
		musicRef.current?.start();
		sfxRef.current?.ensureStarted();
		setMatchSummary({ eventCount: 0, snapshotCount: 0, blobUrl: null });
		setViralState({ status: "idle", moments: [] });
		setEditState({ status: "idle", plan: null });
		setVideoState({ status: "idle", progress: 0, blobUrl: null });
		startMatchRecording();
	};

	const downloadTelemetry = () => {
		const payload = {
			exportedAt: new Date().toISOString(),
			matchEndedAt: matchEndedAtRef.current
				? new Date(matchEndedAtRef.current).toISOString()
				: null,
			summary: {
				wave: hud.wave,
				kills: hud.kills,
				eventCount: matchSummary.eventCount,
				snapshotCount: matchSummary.snapshotCount,
			},
			events: eventsRef.current,
			snapshots: snapshotsRef.current,
			viralMoments: viralState.moments,
			editPlan: editState.plan,
		};
		const blob = new Blob([JSON.stringify(payload, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `brrawl-session-${matchEndedAtRef.current || Date.now()}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	};

	const requestEdit = async () => {
		setEditState({ status: "loading", plan: null });
		setVideoState({ status: "idle", progress: 0, blobUrl: null });
		let plan: EditPlan;
		try {
			const res = await fetch("/api/edit-plan", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ events: eventsRef.current }),
			});
			if (!res.ok) throw new Error(`edit-plan ${res.status}`);
			plan = (await res.json()) as EditPlan;
			setEditState({ status: "done", plan });
		} catch (err) {
			console.error("[game] edit-plan failed", err);
			setEditState({ status: "error", plan: null });
			return;
		}

		const matchBlobUrl = matchSummary.blobUrl;
		if (!matchBlobUrl) {
			console.warn("[game] no match recording — skipping render");
			return;
		}

		setVideoState({ status: "rendering", progress: 0, blobUrl: null });
		try {
			const { blobUrl } = await renderEdit({
				matchBlobUrl,
				events: eventsRef.current,
				plan,
				onProgress: (p) =>
					setVideoState((s) => ({ ...s, status: "rendering", progress: p })),
			});
			setVideoState({ status: "done", progress: 1, blobUrl });
		} catch (err) {
			console.error("[game] render failed", err);
			setVideoState({ status: "error", progress: 0, blobUrl: null });
		}
	};

	const resume = () => {
		stateRef.current.paused = false;
		musicRef.current?.start();
		sfxRef.current?.ensureStarted();
	};

	const brawlBtn =
		"relative select-none rounded-full border-4 border-[#143252] bg-gradient-to-b from-[#ffec90] to-[#ffb000] px-10 py-3.5 font-extrabold text-[#102840] text-lg shadow-[0_5px_0_#0a1c30,0_10px_20px_rgba(0,0,0,0.35)] transition-transform before:pointer-events-none before:absolute before:inset-x-3 before:top-1.5 before:h-[38%] before:rounded-t-[999px] before:bg-gradient-to-b before:from-white/50 before:to-transparent after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:ring-1 after:ring-inset after:ring-white/30 hover:brightness-105 active:translate-y-1 active:shadow-[0_2px_0_#0a1c30] sm:px-14 sm:py-4 sm:text-2xl";

	return (
		<div
			className="relative select-none rounded-[1.75rem] border-[#f2cc4a] border-[5px] bg-gradient-to-b from-[#3d8ce8] via-[#256fd8] to-[#164a9e] p-2.5 shadow-[0_10px_0_#0c2348,0_18px_40px_rgba(0,0,0,0.45)] sm:rounded-[2rem] sm:p-3.5"
			style={{ width: Math.min(ARENA_W + 36, 1024) }}
		>
			{/* Match info bar (Brawl top strip) */}
			<div className="mb-2 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
				<div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
					<StatPill emoji="🌊" label="WAVE" value={String(hud.wave || "—")} />
					<StatPill emoji="💀" label="KILLS" value={String(hud.kills)} />
					<StatPill
						emoji="🐘"
						label="SQUAD"
						value={`${hud.alliesAlive}/${hud.alliesTotal}`}
					/>
				</div>
				<div className="flex w-full min-w-0 items-center gap-2 sm:max-w-[22rem] sm:gap-3">
					<Link
						className="shrink-0 rounded-full border-[#143252] border-[3px] bg-gradient-to-b from-[#7cc0ff] to-[#2e74dd] px-3 py-2 font-extrabold text-[#102030] text-xs shadow-[0_3px_0_#0a1c30] active:translate-y-px"
						href="/"
						onClick={() => submitTelemetry(true)}
					>
						Dashboard
					</Link>
					<button
						aria-label={muted ? "Unmute" : "Mute"}
						className="shrink-0 rounded-full border-[#143252] border-[3px] bg-gradient-to-b from-[#5aa8ff] to-[#1e5fd0] px-2.5 py-2 font-extrabold text-[#102030] text-xs shadow-[0_3px_0_#0a1c30] active:translate-y-px"
						onClick={() => setMuted((m) => !m)}
						type="button"
					>
						{muted ? "🔇" : "♪"}
					</button>
					<div className="min-w-0 flex-1">
						<div className="mb-0.5 flex items-center justify-between font-bold text-[#b8dcff] text-[10px] uppercase leading-none tracking-wider sm:text-xs">
							<span>BRAWLER</span>
							<span className="text-white tabular-nums">
								{hud.hp} / {hud.maxHp}
							</span>
						</div>
						<div className="relative h-3.5 overflow-visible rounded-full border-[#f2cc4a] border-[2px] bg-[#0a1830] p-0.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] sm:h-4">
							<div
								className="h-full min-w-0 rounded-full bg-gradient-to-r from-[#00e090] to-[#90f060] shadow-[0_0_8px_rgba(0,255,150,0.6)]"
								style={{
									width: `${Math.max(0, Math.min(1, hud.hp / hud.maxHp)) * 100}%`,
								}}
							/>
						</div>
					</div>
				</div>
			</div>

			<div
				className="relative overflow-hidden rounded-2xl border-4 border-[#142e58] bg-[#061428] shadow-[inset_0_2px_0_rgba(255,255,255,0.12)]"
				style={{ width: ARENA_W, height: ARENA_H }}
			>
				<canvas
					className="block"
					ref={canvasRef}
					style={{
						width: ARENA_W,
						height: ARENA_H,
						cursor: hud.phase === "playing" && !hud.paused ? "none" : "default",
					}}
				/>

				{hud.phase === "menu" && (
					<Overlay>
						<p className="mb-1 font-extrabold text-[#bfe4ff] text-sm uppercase tracking-[0.2em]">
							3V3
						</p>
						<h1
							className="mb-1 text-center font-extrabold text-4xl text-white leading-none drop-shadow-[0_4px_0_#0a1c30] sm:text-5xl"
							style={{ textShadow: "0 0 2px #000, 0 3px 0 #143252" }}
						>
							ARENA
						</h1>
						<p
							className="mb-6 max-w-sm text-center font-bold text-[#ffe8a0] text-lg sm:text-xl"
							style={{ textShadow: "0 2px 0 #0a1c30" }}
						>
							ELEPHANTS <span className="text-white"> vs </span> DONKEYS
						</p>
						<p className="mb-6 max-w-md text-center font-semibold text-[#d4ecff] text-sm leading-relaxed sm:text-base">
							Hold the zone with your team. Wipe the wave before they overrun
							you!
						</p>
						<div className="mb-4 grid w-full max-w-sm grid-cols-2 gap-x-4 gap-y-2 text-left font-bold text-sm text-white sm:gap-y-2.5 sm:text-base">
							<HelpRow d="move" k="W A S D" />
							<HelpRow d="aim" k="MOUSE" />
							<HelpRow d="fire" k="CLICK" />
							<HelpRow d="pause" k="ESC" />
						</div>
						{!showThemePanel ? (
							<button
								className="mb-5 rounded-lg border-2 border-[#143252] bg-gradient-to-b from-[#a36bff] to-[#5a2cb8] px-5 py-2 font-extrabold text-[#fffbe6] text-sm shadow-[0_3px_0_#0a1c30] transition-transform active:translate-y-px"
								onClick={() => setShowThemePanel(true)}
								type="button"
							>
								{theme ? `🎨 ${theme.label}` : "🎨 Thematic game"}
							</button>
						) : (
							<div className="mb-5 w-full max-w-md rounded-xl border-2 border-[#143252] bg-[#0a2a50]/70 p-3 text-left">
								<div className="mb-2 flex items-center justify-between">
									<span className="font-extrabold text-[#ffe066] text-xs uppercase tracking-[0.18em]">
										AI Theme
									</span>
									<div className="flex items-center gap-1.5">
										{theme && themeStatus === "ready" && (
											<button
												className="rounded-md border border-[#143252] bg-[#143252]/60 px-2 py-0.5 font-bold text-[10px] text-[#bfe4ff] uppercase tracking-wider hover:bg-[#143252]"
												onClick={clearTheme}
												type="button"
											>
												Reset
											</button>
										)}
										<button
											className="rounded-md border border-[#143252] bg-[#143252]/60 px-2 py-0.5 font-bold text-[10px] text-[#bfe4ff] uppercase tracking-wider hover:bg-[#143252]"
											onClick={() => setShowThemePanel(false)}
											type="button"
										>
											Close
										</button>
									</div>
								</div>
								<div className="grid grid-cols-1 gap-2">
									<ThemeField
										label="Arena"
										value={arenaPrompt}
										onChange={setArenaPrompt}
									/>
									<ThemeField
										label="Enemy"
										value={enemyPrompt}
										onChange={setEnemyPrompt}
									/>
									<ThemeField
										label="Ally"
										value={allyPrompt}
										onChange={setAllyPrompt}
									/>
								</div>
								<button
									className="mt-3 w-full rounded-lg border-2 border-[#143252] bg-gradient-to-b from-[#a36bff] to-[#5a2cb8] px-3 py-2 font-extrabold text-[#fffbe6] text-sm shadow-[0_3px_0_#0a1c30] transition-transform active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={themeStatus === "loading"}
									onClick={() => void applyTheme()}
									type="button"
								>
									{themeStatus === "loading"
										? "Generating…"
										: theme
											? "Regenerate Theme"
											: "Apply Theme"}
								</button>
								{themeStatus === "ready" && theme && (
									<p className="mt-2 text-center font-semibold text-[#a8f0c8] text-xs">
										✓ {theme.label} ·{" "}
										{theme.musicMood.replace("phonk_", "phonk · ")}
									</p>
								)}
								{themeStatus === "error" && themeError && (
									<p className="mt-2 text-center font-semibold text-[#ff8888] text-xs">
										{themeError}
									</p>
								)}
							</div>
						)}
						<button className={brawlBtn} onClick={startGame} type="button">
							PLAY
						</button>
					</Overlay>
				)}

				{hud.phase === "gameover" && (
					<Overlay>
						<div className="flex w-full max-w-3xl flex-col items-center gap-4 px-6">
							<h1 className="font-extrabold text-3xl text-red-400 tracking-tight">
								OVERRUN
							</h1>
							<p className="text-neutral-300 text-sm">
								Held{" "}
								<span className="font-bold text-white">{hud.wave}</span> wave
								{hud.wave === 1 ? "" : "s"} · dropped{" "}
								<span className="font-bold text-white">{hud.kills}</span> ·{" "}
								<span className="font-bold text-white">
									{matchSummary.eventCount}
								</span>{" "}
								events,{" "}
								<span className="font-bold text-white">
									{matchSummary.snapshotCount}
								</span>{" "}
								telemetry samples
							</p>

							<ViralVerdict
								editState={editState}
								matchSummary={matchSummary}
								onRequestEdit={requestEdit}
								videoState={videoState}
								viralState={viralState}
							/>

							<div className="flex w-full flex-wrap items-center justify-center gap-3 pt-2">
								<button
									className="rounded-xl bg-emerald-500 px-8 py-3 font-bold text-neutral-900 shadow-lg transition hover:bg-emerald-400 active:scale-95"
									onClick={startGame}
									type="button"
								>
									REDEPLOY
								</button>
								<button
									className="rounded-xl border border-neutral-700 bg-neutral-900 px-5 py-3 font-mono text-[11px] text-neutral-200 uppercase tracking-wider transition hover:border-neutral-600 hover:bg-neutral-800"
									onClick={downloadTelemetry}
									type="button"
								>
									download telemetry .json
								</button>
								<Link
									className="inline-flex items-center justify-center rounded-xl border-4 border-[#143252] bg-gradient-to-b from-[#7cc0ff] to-[#2e74dd] px-6 py-3 font-extrabold text-[#102030] text-sm shadow-[0_4px_0_#0a1c30] transition-transform hover:brightness-105 active:translate-y-px"
									href="/"
									onClick={() => submitTelemetry(true)}
								>
									BACK TO DASHBOARD
								</Link>
							</div>
						</div>
					</Overlay>
				)}

				{hud.phase === "playing" && hud.paused && (
					<Overlay>
						<h1
							className="mb-6 font-extrabold text-5xl text-white sm:text-6xl"
							style={{ textShadow: "0 5px 0 #0a1c30" }}
						>
							PAUSED
						</h1>
						<button className={brawlBtn} onClick={resume} type="button">
							RESUME
						</button>
					</Overlay>
				)}
			</div>

			<p className="mt-2 text-center font-bold text-[#a8c8f0] text-xs leading-tight sm:mt-3 sm:text-sm">
				Click the arena to focus · <span className="text-[#fff6c0]">Esc</span>{" "}
				to pause
			</p>
		</div>
	);
}
