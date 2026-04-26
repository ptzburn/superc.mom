import type { EditPlan, GameEvent } from "~/lib/ai-editor/types";

const W = 720;
const H = 1280;

type RenderOpts = {
	matchBlobUrl: string;
	events: GameEvent[];
	plan: EditPlan;
	onProgress?: (p: number) => void;
};

const moodColor: Record<EditPlan["mood"], string> = {
	hype: "#ff8a3d",
	cocky: "#22d3ee",
	menacing: "#a855f7",
	comeback: "#34d399",
};

function parseAccent(text: string) {
	const out: { text: string; accent: boolean }[] = [];
	const re = /\[([^\]]+)\]|([^\[\]]+)/g;
	let m: RegExpExecArray | null = null;
	// biome-ignore lint/suspicious/noAssignInExpressions: regex iteration
	while ((m = re.exec(text)) !== null) {
		out.push({ text: m[1] ?? m[2] ?? "", accent: m[1] != null });
	}
	return out;
}

function drawCaption(
	ctx: CanvasRenderingContext2D,
	text: string,
	color: string,
	t01: number,
) {
	const parts = parseAccent(text);
	const popK = Math.min(1, t01 * 6);
	const c1 = 1.70158;
	const c3 = c1 + 1;
	const eob = popK >= 1 ? 1 : 1 + c3 * (popK - 1) ** 3 + c1 * (popK - 1) ** 2;
	const scale = 0.4 + eob * 0.6;
	const alpha = Math.min(1, popK * 1.4);

	let fontSize = 76;
	ctx.font = `900 ${fontSize}px "Trebuchet MS", system-ui, sans-serif`;
	const cleanText = text.replace(/[\[\]]/g, "");
	const totalW = ctx.measureText(cleanText).width;
	const maxW = W * 0.86;
	if (totalW * scale > maxW) {
		fontSize = Math.max(32, Math.floor((fontSize * maxW) / (totalW * scale)));
		ctx.font = `900 ${fontSize}px "Trebuchet MS", system-ui, sans-serif`;
	}

	const widths = parts.map((p) => ctx.measureText(p.text).width);
	const total = widths.reduce((a, b) => a + b, 0);

	ctx.save();
	ctx.translate(W / 2, H * 0.22);
	ctx.scale(scale, scale);
	ctx.globalAlpha = alpha;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	let cursor = -total / 2;
	// Stroke pass
	for (let i = 0; i < parts.length; i++) {
		const p = parts[i];
		const widthsI = widths[i];
		if (!p || widthsI == null) continue;
		ctx.lineWidth = Math.max(8, fontSize * 0.13);
		ctx.strokeStyle = "#0d0d1a";
		ctx.strokeText(p.text, cursor + widthsI / 2, 0);
		cursor += widthsI;
	}
	// Fill pass
	cursor = -total / 2;
	for (let i = 0; i < parts.length; i++) {
		const p = parts[i];
		const widthsI = widths[i];
		if (!p || widthsI == null) continue;
		if (p.accent) {
			ctx.shadowColor = color;
			ctx.shadowBlur = 26;
			ctx.fillStyle = color;
		} else {
			ctx.shadowBlur = 0;
			ctx.fillStyle = "#fff";
		}
		ctx.fillText(p.text, cursor + widthsI / 2, 0);
		cursor += widthsI;
	}
	ctx.shadowBlur = 0;
	ctx.restore();
}

function drawCoverVideo(
	ctx: CanvasRenderingContext2D,
	video: HTMLVideoElement,
	zoom: number,
	shake: number,
) {
	if (!video.videoWidth) return;
	const sa = video.videoWidth / video.videoHeight;
	const da = W / H;
	let dw: number;
	let dh: number;
	let dx: number;
	let dy: number;
	if (sa > da) {
		dh = H;
		dw = H * sa;
		dx = (W - dw) / 2;
		dy = 0;
	} else {
		dw = W;
		dh = W / sa;
		dx = 0;
		dy = (H - dh) / 2;
	}
	const shx = (Math.random() - 0.5) * shake;
	const shy = (Math.random() - 0.5) * shake;
	ctx.save();
	ctx.translate(W / 2 + shx, H / 2 + shy);
	ctx.scale(zoom, zoom);
	ctx.translate(-W / 2, -H / 2);
	ctx.filter = "saturate(1.45) contrast(1.22) brightness(1.04)";
	ctx.drawImage(video, dx, dy, dw, dh);
	ctx.filter = "none";
	// Cheap RGB split via additive overlay.
	ctx.globalCompositeOperation = "lighter";
	ctx.globalAlpha = 0.4;
	ctx.filter = "sepia(1) saturate(8) hue-rotate(-50deg)";
	ctx.drawImage(video, dx - 5, dy, dw, dh);
	ctx.filter = "sepia(1) saturate(8) hue-rotate(180deg)";
	ctx.drawImage(video, dx + 5, dy, dw, dh);
	ctx.filter = "none";
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = "source-over";
	ctx.restore();
}

function drawChrome(
	ctx: CanvasRenderingContext2D,
	moodAccent: string,
	beatPulse: number,
) {
	// Scanlines
	ctx.fillStyle = "rgba(0,0,0,0.16)";
	for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
	// Vignette
	const vg = ctx.createRadialGradient(
		W / 2,
		H / 2,
		Math.min(W, H) * 0.28,
		W / 2,
		H / 2,
		Math.max(W, H) * 0.7,
	);
	vg.addColorStop(0, "rgba(0,0,0,0)");
	vg.addColorStop(1, `rgba(0,0,0,${0.55 + beatPulse * 0.18})`);
	ctx.fillStyle = vg;
	ctx.fillRect(0, 0, W, H);
	// Recording dot
	ctx.beginPath();
	ctx.arc(W - 26, 28, 6, 0, Math.PI * 2);
	ctx.fillStyle = `rgba(255,80,80,${0.4 + beatPulse * 0.6})`;
	ctx.fill();
	// Watermark
	ctx.font = "bold 14px monospace";
	ctx.textAlign = "left";
	ctx.fillStyle = "rgba(255,255,255,0.85)";
	ctx.fillText("► BEST MOMENTS", 16, 28);
	ctx.fillStyle = "rgba(255,255,255,0.5)";
	ctx.fillText("#brrawl  #phonk  #edit", 16, 48);
	// Bottom caption strip with mood color
	ctx.fillStyle = "rgba(0,0,0,0.55)";
	ctx.fillRect(0, H - 80, W, 80);
	ctx.fillStyle = moodAccent;
	ctx.fillRect(0, H - 80, W, 3);
}

async function waitFrame(): Promise<void> {
	return new Promise((r) => requestAnimationFrame(() => r()));
}

async function seekVideo(video: HTMLVideoElement, t: number): Promise<void> {
	const target = Math.max(0, Math.min(video.duration - 0.1, t));
	video.currentTime = target;
	await new Promise<void>((resolve) => {
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			video.removeEventListener("seeked", finish);
			resolve();
		};
		video.addEventListener("seeked", finish);
		setTimeout(finish, 800);
	});
}

export async function renderEdit({
	matchBlobUrl,
	events,
	plan,
	onProgress,
}: RenderOpts): Promise<{ blobUrl: string; durationMs: number }> {
	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("no 2d context");

	const video = document.createElement("video");
	video.src = matchBlobUrl;
	video.muted = true;
	video.playsInline = true;
	video.preload = "auto";
	await new Promise<void>((resolve, reject) => {
		const t = setTimeout(() => reject(new Error("video metadata timeout")), 4000);
		video.addEventListener(
			"loadedmetadata",
			() => {
				clearTimeout(t);
				resolve();
			},
			{ once: true },
		);
	});

	// Audio
	const audioEl = new Audio(`/audio/${plan.audio}.mp3`);
	audioEl.loop = true;
	audioEl.volume = 0.85;

	// Compose canvas video stream + audio track for the recorder.
	const stream = canvas.captureStream(30);
	let audioCtx: AudioContext | null = null;
	try {
		audioCtx = new AudioContext();
		const src = audioCtx.createMediaElementSource(audioEl);
		const dest = audioCtx.createMediaStreamDestination();
		src.connect(dest);
		src.connect(audioCtx.destination);
		for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
	} catch (err) {
		console.warn("[render] audio mix failed:", err);
	}

	const supportsVp9 = MediaRecorder.isTypeSupported(
		"video/webm;codecs=vp9,opus",
	);
	const recorder = new MediaRecorder(stream, {
		mimeType: supportsVp9
			? "video/webm;codecs=vp9,opus"
			: "video/webm;codecs=vp8,opus",
		videoBitsPerSecond: 4_000_000,
	});
	const chunks: Blob[] = [];
	recorder.ondataavailable = (e) => {
		if (e.data.size > 0) chunks.push(e.data);
	};
	const stopped = new Promise<void>((resolve) => {
		recorder.onstop = () => resolve();
	});
	recorder.start(200);

	try {
		await audioEl.play();
	} catch (err) {
		console.warn("[render] audio play failed:", err);
	}

	const accent = moodColor[plan.mood] ?? "#ffd54f";
	const beatMs = 60_000 / 142;
	const totalMs = plan.shots.reduce((a, s) => a + s.lengthMs, 0);
	const renderStart = performance.now();

	// Hook: 1.2s opening card before the first shot.
	const hookMs = 1200;
	{
		const start = performance.now();
		while (performance.now() - start < hookMs) {
			const elapsed = performance.now() - start;
			const t01 = elapsed / hookMs;
			ctx.fillStyle = "#000";
			ctx.fillRect(0, 0, W, H);
			const beatPhase = ((performance.now() - renderStart) % beatMs) / beatMs;
			const beatPulse = (1 - beatPhase) ** 2;
			drawCaption(ctx, plan.hook, accent, t01);
			drawChrome(ctx, accent, beatPulse);
			onProgress?.((elapsed / hookMs) * 0.05);
			await waitFrame();
		}
	}

	let elapsedMs = 0;
	for (let i = 0; i < plan.shots.length; i++) {
		const shot = plan.shots[i];
		if (!shot) continue;
		const ev = events[shot.eventIndex];
		if (!ev) continue;

		const seekTo = Math.max(0, ev.t / 1000 - 1.0);
		await seekVideo(video, seekTo);
		video.playbackRate = 0.65;
		try {
			await video.play();
		} catch {}

		const start = performance.now();
		while (performance.now() - start < shot.lengthMs) {
			const t01 = (performance.now() - start) / shot.lengthMs;
			const beatPhase = ((performance.now() - renderStart) % beatMs) / beatMs;
			const beatPulse = (1 - beatPhase) ** 2;
			ctx.fillStyle = "#000";
			ctx.fillRect(0, 0, W, H);
			const zoom = 1.05 + t01 * 0.16 + beatPulse * 0.04;
			const shake = beatPulse * 5;
			drawCoverVideo(ctx, video, zoom, shake);
			drawCaption(ctx, shot.caption, accent, t01);
			drawChrome(ctx, accent, beatPulse);
			const overall = 0.05 + (elapsedMs + t01 * shot.lengthMs) / totalMs * 0.9;
			onProgress?.(overall);
			await waitFrame();
		}
		elapsedMs += shot.lengthMs;
		try {
			video.pause();
		} catch {}
	}

	// Outro card 1.2s
	{
		const outroMs = 1200;
		const start = performance.now();
		while (performance.now() - start < outroMs) {
			const t01 = (performance.now() - start) / outroMs;
			ctx.fillStyle = "#000";
			ctx.fillRect(0, 0, W, H);
			const beatPhase = ((performance.now() - renderStart) % beatMs) / beatMs;
			const beatPulse = (1 - beatPhase) ** 2;
			drawCaption(ctx, plan.outro, accent, t01);
			drawChrome(ctx, accent, beatPulse);
			onProgress?.(0.95 + t01 * 0.05);
			await waitFrame();
		}
	}

	recorder.stop();
	await stopped;
	audioEl.pause();
	if (audioCtx) {
		try {
			await audioCtx.close();
		} catch {}
	}

	const blob = new Blob(chunks, { type: "video/webm" });
	const blobUrl = URL.createObjectURL(blob);
	onProgress?.(1);
	return { blobUrl, durationMs: performance.now() - renderStart };
}
