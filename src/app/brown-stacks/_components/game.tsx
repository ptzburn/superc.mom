"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { EditPlan } from "~/lib/ai-editor/types";
import type { FeatureSnapshot, ViralMoment } from "~/lib/ai-editor/viral";
import type { ThemeArt } from "~/lib/ai-theme";
import { ARENA_H, ARENA_W, PLAYER_MAX_HP } from "./constants";
import { render } from "./draw";
import { IPhoneFrame, useIsMobile } from "./IPhoneFrame";
import { TouchPad } from "./TouchPad";
import { FONT_DISPLAY, FONT_MONO, MOODS } from "./moods";
import { createMusicEngine, type MusicEngine } from "./music";
import { ThemeField, ViralOverlay } from "./overlays";
import { renderEdit } from "./renderEdit";
import { createSfxEngine, type SfxEngine } from "./sfx";
import { startWave, update } from "./simulation";
import { loadDataUrlImage, setActiveTheme } from "./theme";
import type { GameEvent, GameRuntime, Phase } from "./types";
import { createInitialState } from "./world";

export { viralScore } from "./utils";
export type { GameEvent } from "./types";

// Reach-out into the imperative game runtime from the TouchPad. Defined
// outside the component so the callbacks are stable and don't churn React
// reconciliation each frame.
function makeTouchBridge(stateRef: React.MutableRefObject<unknown>) {
	const MOVEMENT_KEYS = ["w", "a", "s", "d"] as const;
	const setKeys = (next: Set<string>) => {
		// biome-ignore lint/suspicious/noExplicitAny: imperative bridge
		const s = (stateRef.current as any);
		if (!s?.keys) return;
		for (const k of MOVEMENT_KEYS) s.keys.delete(k);
		for (const k of next) s.keys.add(k);
	};
	const setAim = (
		aim: { dx: number; dy: number; firing: boolean } | null,
	) => {
		// biome-ignore lint/suspicious/noExplicitAny: imperative bridge
		const s = (stateRef.current as any);
		if (!s?.player) return;
		if (!aim) {
			s.shooting = false;
			return;
		}
		const m = Math.hypot(aim.dx, aim.dy);
		if (m > 0) {
			s.mouse = {
				x: s.player.pos.x + aim.dx * 200,
				y: s.player.pos.y + aim.dy * 200,
			};
		}
		s.shooting = aim.firing;
	};
	return { setKeys, setAim };
}

export default function Game() {
	const isMobile = useIsMobile();
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

		// Size the backing buffer to match the canvas's *displayed* size every
		// time it changes, then map arena coords (0..ARENA_W, 0..ARENA_H) onto
		// the full backing buffer. Falls back to the parent's box if the
		// canvas's own rect is zero (h-full sometimes reports 0 mid-layout).
		const resizeCanvas = () => {
			const rect = canvas.getBoundingClientRect();
			const parent = canvas.parentElement;
			const pRect = parent?.getBoundingClientRect();
			const cssW = rect.width || pRect?.width || window.innerWidth;
			const cssH = rect.height || pRect?.height || window.innerHeight;
			// Lock the canvas's CSS box explicitly so it cannot collapse to
			// 0 when h-full's containing block is ambiguous mid-layout.
			canvas.style.width = `${cssW}px`;
			canvas.style.height = `${cssH}px`;
			const w = Math.max(1, Math.round(cssW * dpr));
			const h = Math.max(1, Math.round(cssH * dpr));
			if (canvas.width !== w) canvas.width = w;
			if (canvas.height !== h) canvas.height = h;
		};
		resizeCanvas();
		const ro = new ResizeObserver(resizeCanvas);
		ro.observe(canvas);
		if (canvas.parentElement) ro.observe(canvas.parentElement);
		window.addEventListener("resize", resizeCanvas);
		window.addEventListener("orientationchange", resizeCanvas);

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
			// Resize check on every frame — ResizeObserver can miss the
			// initial layout pass, leaving the backing buffer at the
			// HTMLCanvas default of 300×150. Idempotent when nothing changed.
			resizeCanvas();
			// Reset base transform: arena coords → full backing buffer.
			// render() uses ctx.save()/restore() around its drawing so it
			// trusts that the current transform on entry is the arena map.
			ctx.setTransform(canvas.width / ARENA_W, 0, 0, canvas.height / ARENA_H, 0, 0);
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
			ro.disconnect();
			window.removeEventListener("resize", resizeCanvas);
			window.removeEventListener("orientationchange", resizeCanvas);
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

	const M = MOODS.menacing;

	const orientation =
		hud.phase === "gameover" &&
		videoState.status === "done" &&
		videoState.blobUrl
			? "portrait"
			: "landscape";

	const touchBridge = makeTouchBridge(
		stateRef as unknown as React.MutableRefObject<unknown>,
	);
	const showTouchPad = isMobile && hud.phase === "playing" && !hud.paused;

	const inner = (
		<div
			className="relative h-full w-full select-none overflow-hidden"
			style={{
				background: M.surface,
				color: M.ink,
				fontFamily: "var(--font-sans), system-ui, sans-serif",
				borderRadius: isMobile ? 0 : 38,
			}}
		>
			<canvas
				className="absolute inset-0 block h-full w-full"
				ref={canvasRef}
				style={{
					cursor:
						hud.phase === "playing" && !hud.paused ? "none" : "default",
					filter:
						hud.phase === "playing"
							? "saturate(0.92) contrast(1.06) brightness(0.98)"
							: "saturate(0.5) brightness(0.7)",
					borderRadius: isMobile ? 0 : 38,
				}}
			/>

			{showTouchPad && (
				<TouchPad setKeys={touchBridge.setKeys} setAim={touchBridge.setAim} />
			)}

			<DeviceCorners color={M.accent} />

			<div
				className="pointer-events-none absolute top-0 right-0 left-0 flex flex-col gap-1.5"
				style={{
					padding: "10px 24px 18px",
					background:
						"linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)",
				}}
			>
				<div
					className="flex items-center gap-2"
					style={{
						fontFamily: FONT_MONO,
						fontSize: 9,
						letterSpacing: "0.18em",
						color: M.inkDim,
					}}
				>
					<span
						style={{
							width: 6,
							height: 6,
							background: M.accent,
							borderRadius: "50%",
							boxShadow: `0 0 8px ${M.accent}`,
						}}
					/>
					<span style={{ color: M.ink }}>ARENA.LIVE</span>
					<span className="pointer-events-auto ml-auto flex items-center gap-2">
						<Link
							href="/"
							onClick={() => submitTelemetry(true)}
							style={{
								fontFamily: FONT_MONO,
								fontSize: 9,
								letterSpacing: "0.2em",
								color: M.inkDim,
								background: "rgba(0,0,0,0.5)",
								border: `1px solid ${M.inkDim}40`,
								padding: "2px 8px",
								textDecoration: "none",
							}}
						>
							HOME
						</Link>
						<button
							aria-label={muted ? "Unmute music" : "Mute music"}
							className="cursor-pointer"
							onClick={() => setMuted((m) => !m)}
							style={{
								fontFamily: FONT_MONO,
								fontSize: 9,
								letterSpacing: "0.2em",
								color: muted ? M.inkDim : M.accent,
								background: "rgba(0,0,0,0.5)",
								border: `1px solid ${M.inkDim}40`,
								padding: "2px 8px",
							}}
							type="button"
						>
							{muted ? "OFF" : "ON"}
						</button>
					</span>
				</div>
				<div className="flex items-center justify-between gap-2">
					<HudStat
						label="WAVE"
						value={String(hud.wave).padStart(2, "0")}
						mood={M}
					/>
					<HudStat
						label="KILLS"
						value={String(hud.kills).padStart(3, "0")}
						mood={M}
					/>
					<HudStat
						label="SQUAD"
						value={`${hud.alliesAlive}/${hud.alliesTotal}`}
						mood={M}
					/>
				</div>
				<HpStrip hp={hud.hp} max={hud.maxHp} mood={M} />
			</div>

			{hud.phase === "menu" && (
				<MoodOverlay mood={M}>
					<div className="text-center">
						<div
							style={{
								fontFamily: FONT_MONO,
								fontSize: 11,
								letterSpacing: "0.3em",
								color: M.inkDim,
								marginBottom: 18,
							}}
						>
							MISSION 01 · DEFEND
						</div>
						<h1
							style={{
								fontFamily: FONT_DISPLAY,
								fontSize: "clamp(36px, 7vw, 80px)",
								lineHeight: 0.88,
								color: M.ink,
								margin: 0,
								letterSpacing: "-0.01em",
							}}
						>
							ELEPHANTS{" "}
							<span style={{ color: M.accent, fontStyle: "italic" }}>VS</span>{" "}
							DONKEYS
						</h1>
						<p
							className="mx-auto mt-6"
							style={{
								fontFamily: "var(--font-sans), system-ui, sans-serif",
								fontSize: 14,
								color: M.inkDim,
								maxWidth: 480,
								lineHeight: 1.55,
							}}
						>
							Hold the arena with your team. The model is watching for clutch
							moments — go for them.
						</p>
						<div
							className="mx-auto mt-7 grid grid-cols-2 gap-x-10 gap-y-1.5"
							style={{
								fontFamily: FONT_MONO,
								fontSize: 11,
								letterSpacing: "0.18em",
								color: M.inkDim,
								maxWidth: 380,
							}}
						>
							<div>
								<span style={{ color: M.ink }}>WASD</span> — MOVE
							</div>
							<div>
								<span style={{ color: M.ink }}>MOUSE</span> — AIM
							</div>
							<div>
								<span style={{ color: M.ink }}>LMB</span> — FIRE
							</div>
							<div>
								<span style={{ color: M.ink }}>ESC</span> — PAUSE
							</div>
						</div>
						{!showThemePanel ? (
							<button
								className="mt-8 cursor-pointer"
								onClick={() => setShowThemePanel(true)}
								style={{
									fontFamily: FONT_MONO,
									fontSize: 11,
									letterSpacing: "0.22em",
									background: "transparent",
									color: M.inkDim,
									border: `1px solid ${M.inkDim}50`,
									padding: "8px 18px",
									cursor: "pointer",
									marginBottom: 16,
								}}
								type="button"
							>
								{theme ? `THEME: ${theme.label}` : "AI THEME"}
							</button>
						) : (
							<div
								className="mx-auto mt-6 w-full max-w-md text-left"
								style={{
									background: `${M.surface}cc`,
									border: `1px solid ${M.inkDim}40`,
									padding: 16,
								}}
							>
								<div className="mb-2 flex items-center justify-between">
									<span
										style={{
											fontFamily: FONT_MONO,
											fontSize: 9,
											letterSpacing: "0.2em",
											color: M.accent,
										}}
									>
										AI THEME
									</span>
									<div className="flex items-center gap-1.5">
										{theme && themeStatus === "ready" && (
											<button
												className="cursor-pointer"
												onClick={clearTheme}
												style={{
													fontFamily: FONT_MONO,
													fontSize: 9,
													letterSpacing: "0.18em",
													color: M.inkDim,
													background: "transparent",
													border: `1px solid ${M.inkDim}40`,
													padding: "2px 8px",
												}}
												type="button"
											>
												RESET
											</button>
										)}
										<button
											className="cursor-pointer"
											onClick={() => setShowThemePanel(false)}
											style={{
												fontFamily: FONT_MONO,
												fontSize: 9,
												letterSpacing: "0.18em",
												color: M.inkDim,
												background: "transparent",
												border: `1px solid ${M.inkDim}40`,
												padding: "2px 8px",
											}}
											type="button"
										>
											CLOSE
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
									className="mt-3 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
									disabled={themeStatus === "loading"}
									onClick={() => void applyTheme()}
									style={{
										fontFamily: FONT_DISPLAY,
										fontSize: 18,
										letterSpacing: "0.04em",
										background: M.accent,
										color: "#000",
										border: "none",
										padding: "10px 24px",
										boxShadow: `0 0 24px ${M.accent}60`,
									}}
									type="button"
								>
									{themeStatus === "loading"
										? "GENERATING..."
										: theme
											? "REGENERATE"
											: "APPLY THEME"}
								</button>
								{themeStatus === "ready" && theme && (
									<p
										className="mt-2 text-center"
										style={{
											fontFamily: FONT_MONO,
											fontSize: 9,
											color: M.accent,
											letterSpacing: "0.18em",
										}}
									>
										{theme.label} ·{" "}
										{theme.musicMood.replace("phonk_", "phonk · ")}
									</p>
								)}
								{themeStatus === "error" && themeError && (
									<p
										className="mt-2 text-center"
										style={{
											fontFamily: FONT_MONO,
											fontSize: 9,
											color: M.accent2,
											letterSpacing: "0.18em",
										}}
									>
										{themeError}
									</p>
								)}
							</div>
						)}
						<button
							className="mt-10 cursor-pointer"
							onClick={startGame}
							style={{
								fontFamily: FONT_DISPLAY,
								fontSize: 36,
								letterSpacing: "0.04em",
								background: M.accent,
								color: "#000",
								border: "none",
								padding: "16px 56px",
								boxShadow: `0 0 40px ${M.accent}80`,
							}}
							type="button"
						>
							START
						</button>
					</div>
				</MoodOverlay>
			)}

			{hud.phase === "gameover" && (
				<ViralOverlay
					editState={editState}
					kills={hud.kills}
					matchSummary={matchSummary}
					onAgain={startGame}
					onMakeClip={() => void requestEdit()}
					videoState={videoState}
					viralState={viralState}
					wave={hud.wave}
				/>
			)}

			{hud.phase === "playing" && hud.paused && (
				<MoodOverlay mood={M}>
					<div className="text-center">
						<div
							style={{
								fontFamily: FONT_MONO,
								fontSize: 11,
								letterSpacing: "0.3em",
								color: M.inkDim,
								marginBottom: 18,
							}}
						>
							STATE / PAUSED
						</div>
						<h1
							style={{
								fontFamily: FONT_DISPLAY,
								fontSize: "clamp(56px, 12vw, 120px)",
								lineHeight: 0.85,
								color: M.ink,
								margin: 0,
							}}
						>
							<span style={{ color: M.accent, fontStyle: "italic" }}>
								STAND
							</span>
							<br />
							BY.
						</h1>
					</div>
					<button
						className="mt-10 cursor-pointer"
						onClick={resume}
						style={{
							fontFamily: FONT_DISPLAY,
							fontSize: 32,
							letterSpacing: "0.04em",
							background: M.accent,
							color: "#000",
							border: "none",
							padding: "14px 48px",
							boxShadow: `0 0 40px ${M.accent}80`,
						}}
						type="button"
					>
						RESUME
					</button>
				</MoodOverlay>
			)}

			<div
				className="pointer-events-none absolute right-0 bottom-0 left-0 flex items-center justify-between"
				style={{
					padding: "12px 24px 14px",
					fontFamily: FONT_MONO,
					fontSize: 8,
					letterSpacing: "0.18em",
					color: M.inkDim,
					background:
						"linear-gradient(0deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)",
				}}
			>
				<span>CLICK · ESC</span>
				<span>GEMINI · viral</span>
			</div>
		</div>
	);

	if (isMobile) {
		// Drop the iPhone mockup chrome on real phones — full-bleed game.
		return (
			<div
				className="fixed inset-0 overflow-hidden bg-[#020305]"
				style={{ touchAction: "none" }}
			>
				{inner}
			</div>
		);
	}
	return <IPhoneFrame orientation={orientation}>{inner}</IPhoneFrame>;
}

function DeviceCorners({ color }: { color: string }) {
	return (
		<>
			{(["tl", "tr", "bl", "br"] as const).map((p) => {
				const flip =
					(p.includes("r") ? "scaleX(-1) " : "") +
					(p.includes("b") ? "scaleY(-1)" : "");
				const pos =
					p === "tl"
						? { top: 6, left: 6 }
						: p === "tr"
							? { top: 6, right: 6 }
							: p === "bl"
								? { bottom: 6, left: 6 }
								: { bottom: 6, right: 6 };
				return (
					<svg
						className="absolute"
						height={14}
						key={p}
						style={{ ...pos, transform: flip }}
						width={14}
					>
						<title>device-corner</title>
						<path
							d="M0 6 L0 0 L6 0"
							fill="none"
							stroke={color}
							strokeWidth={1.5}
						/>
					</svg>
				);
			})}
		</>
	);
}

function HudStat({
	label,
	value,
	mood,
}: {
	label: string;
	value: string;
	mood: (typeof MOODS)[keyof typeof MOODS];
}) {
	return (
		<span className="flex items-baseline gap-2">
			<span style={{ color: mood.inkDim }}>{label}</span>
			<span
				style={{
					color: mood.ink,
					fontFamily: FONT_DISPLAY,
					fontSize: 20,
					lineHeight: 1,
				}}
			>
				{value}
			</span>
		</span>
	);
}

function HpStrip({
	hp,
	max,
	mood,
}: {
	hp: number;
	max: number;
	mood: (typeof MOODS)[keyof typeof MOODS];
}) {
	const frac = Math.max(0, Math.min(1, hp / max));
	const color = frac < 0.25 ? mood.accent2 : mood.accent;
	return (
		<div
			className="flex w-full items-center gap-2"
			style={{
				fontFamily: FONT_MONO,
				fontSize: 9,
				letterSpacing: "0.18em",
				color: mood.inkDim,
			}}
		>
			<span>HP</span>
			<span
				className="relative h-1 flex-1"
				style={{ background: `${mood.inkDim}40` }}
			>
				<span
					className="absolute top-0 left-0 h-full"
					style={{
						width: `${frac * 100}%`,
						background: color,
						boxShadow: `0 0 8px ${color}`,
					}}
				/>
			</span>
			<span
				style={{
					color: mood.ink,
					fontVariantNumeric: "tabular-nums",
				}}
			>
				{hp}/{max}
			</span>
		</div>
	);
}

function MoodOverlay({
	mood,
	children,
}: {
	mood: (typeof MOODS)[keyof typeof MOODS];
	children: React.ReactNode;
}) {
	return (
		<div
			className="absolute inset-0 z-40 overflow-hidden"
			style={{
				background: `radial-gradient(ellipse at 60% 40%, ${mood.bgDeep} 0%, #000 80%)`,
				borderRadius: 38,
			}}
		>
			{(["tl", "tr", "bl", "br"] as const).map((p) => {
				const flip =
					(p.includes("r") ? "scaleX(-1) " : "") +
					(p.includes("b") ? "scaleY(-1)" : "");
				const pos =
					p === "tl"
						? { top: 16, left: 16 }
						: p === "tr"
							? { top: 16, right: 16 }
							: p === "bl"
								? { bottom: 16, left: 16 }
								: { bottom: 16, right: 16 };
				return (
					<svg
						className="absolute z-10"
						height={20}
						key={p}
						style={{ ...pos, transform: flip }}
						width={20}
					>
						<title>corner</title>
						<path
							d="M0 8 L0 0 L8 0"
							fill="none"
							stroke={mood.accent}
							strokeWidth={1.5}
						/>
					</svg>
				);
			})}
			<div
				className="pointer-events-none absolute z-10"
				style={{
					inset: 0,
					background: `linear-gradient(180deg, transparent 0%, ${mood.surface}30 50%, transparent 100%)`,
				}}
			/>
			<div className="absolute inset-0 overflow-y-auto">
				<div className="flex min-h-full flex-col items-center justify-center px-6 py-8">
					<div className="relative">{children}</div>
				</div>
			</div>
		</div>
	);
}
