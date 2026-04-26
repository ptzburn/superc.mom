export type MusicEngine = {
	start: () => void;
	stop: () => void;
	setMuted: (muted: boolean) => void;
	isMuted: () => boolean;
	dispose: () => void;
};

const BPM = 142;
const STEP = 60 / BPM / 4;
const ROOT_HZ = 55;
const SCHEDULE_AHEAD = 0.18;
const SILENT = -100;
const PATTERN_LEN = 32;

const BASS: ReadonlyArray<number> = [
	0,
	SILENT,
	SILENT,
	SILENT,
	0,
	SILENT,
	SILENT,
	-3,
	-3,
	SILENT,
	-5,
	SILENT,
	-7,
	SILENT,
	SILENT,
	SILENT,
	0,
	SILENT,
	SILENT,
	SILENT,
	0,
	SILENT,
	-3,
	SILENT,
	-5,
	SILENT,
	SILENT,
	SILENT,
	-7,
	SILENT,
	-5,
	-3,
];

const KICK: ReadonlyArray<number> = [
	1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0,
	0, 0, 0, 0, 0, 0,
];

const BELL: ReadonlyArray<number> = [
	1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1,
	1, 0, 1, 0, 1, 0,
];

const HAT: ReadonlyArray<number> = [
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	1, 1, 2, 2, 2, 2,
];

function semitoneToHz(st: number) {
	return ROOT_HZ * 2 ** (st / 12);
}

function getAudioCtor(): typeof AudioContext | undefined {
	if (typeof window === "undefined") return undefined;
	if (typeof AudioContext !== "undefined") return AudioContext;
	const w = window as { webkitAudioContext?: typeof AudioContext };
	return w.webkitAudioContext;
}

export function createMusicEngine(): MusicEngine {
	let ctx: AudioContext | null = null;
	let master: GainNode | null = null;
	let bus: GainNode | null = null;
	let comp: DynamicsCompressorNode | null = null;
	let noiseBuf: AudioBuffer | null = null;
	let intervalId: number | null = null;
	let nextStepTime = 0;
	let step = 0;
	let muted = false;
	let running = false;

	function ensureContext() {
		if (ctx) return ctx;
		const Ctor = getAudioCtor();
		if (!Ctor) return null;
		ctx = new Ctor();
		comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -10;
		comp.ratio.value = 4;
		comp.attack.value = 0.003;
		comp.release.value = 0.18;
		bus = ctx.createGain();
		bus.gain.value = 0.95;
		master = ctx.createGain();
		master.gain.value = muted ? 0 : 0.55;
		comp.connect(bus).connect(master).connect(ctx.destination);

		const len = Math.floor(ctx.sampleRate * 0.4);
		const buf = ctx.createBuffer(1, len, ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
		noiseBuf = buf;
		return ctx;
	}

	function distortionCurve(amount: number) {
		const n = 256;
		const curve = new Float32Array(n);
		const k = amount;
		for (let i = 0; i < n; i++) {
			const x = (i * 2) / n - 1;
			curve[i] =
				((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
		}
		return curve;
	}

	function playKick(t: number) {
		if (!ctx || !comp) return;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(150, t);
		osc.frequency.exponentialRampToValueAtTime(40, t + 0.13);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.95, t + 0.005);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
		osc.connect(g).connect(comp);
		osc.start(t);
		osc.stop(t + 0.45);

		const click = ctx.createOscillator();
		const cg = ctx.createGain();
		click.type = "square";
		click.frequency.value = 1200;
		cg.gain.setValueAtTime(0.0001, t);
		cg.gain.exponentialRampToValueAtTime(0.25, t + 0.001);
		cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
		click.connect(cg).connect(comp);
		click.start(t);
		click.stop(t + 0.03);
	}

	function playBass(t: number, st: number, dur: number) {
		if (!ctx || !comp) return;
		const freq = semitoneToHz(st);
		const osc = ctx.createOscillator();
		const sub = ctx.createOscillator();
		const lp = ctx.createBiquadFilter();
		const ws = ctx.createWaveShaper();
		const g = ctx.createGain();

		osc.type = "sawtooth";
		osc.frequency.setValueAtTime(freq * 2, t);
		osc.frequency.exponentialRampToValueAtTime(freq, t + 0.05);

		sub.type = "sine";
		sub.frequency.setValueAtTime(freq, t);
		sub.frequency.exponentialRampToValueAtTime(freq * 0.985, t + dur);

		lp.type = "lowpass";
		lp.Q.value = 6;
		lp.frequency.setValueAtTime(950, t);
		lp.frequency.exponentialRampToValueAtTime(260, t + dur);

		ws.curve = distortionCurve(10);
		ws.oversample = "4x";

		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
		g.gain.setValueAtTime(0.55, t + dur * 0.75);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

		osc.connect(lp);
		sub.connect(lp);
		lp.connect(ws).connect(g).connect(comp);
		osc.start(t);
		sub.start(t);
		osc.stop(t + dur + 0.05);
		sub.stop(t + dur + 0.05);
	}

	function playCowbell(t: number) {
		if (!ctx || !comp) return;
		const o1 = ctx.createOscillator();
		const o2 = ctx.createOscillator();
		const bp = ctx.createBiquadFilter();
		const g = ctx.createGain();
		o1.type = "square";
		o2.type = "square";
		o1.frequency.value = 805;
		o2.frequency.value = 540;
		bp.type = "bandpass";
		bp.frequency.value = 800;
		bp.Q.value = 1.7;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.42, t + 0.002);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
		o1.connect(bp);
		o2.connect(bp);
		bp.connect(g).connect(comp);
		o1.start(t);
		o2.start(t);
		o1.stop(t + 0.22);
		o2.stop(t + 0.22);
	}

	function playHat(t: number, accent: boolean) {
		if (!ctx || !comp || !noiseBuf) return;
		const src = ctx.createBufferSource();
		const hp = ctx.createBiquadFilter();
		const g = ctx.createGain();
		src.buffer = noiseBuf;
		hp.type = "highpass";
		hp.frequency.value = 7200;
		const peak = accent ? 0.32 : 0.18;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(peak, t + 0.001);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
		src.connect(hp).connect(g).connect(comp);
		src.start(t);
		src.stop(t + 0.07);
	}

	function bassNoteDuration(idx: number) {
		for (let i = 1; i < PATTERN_LEN; i++) {
			const next = BASS[(idx + i) % PATTERN_LEN];
			if (next !== undefined && next !== SILENT) {
				return Math.min(STEP * i, STEP * 6);
			}
		}
		return STEP * 6;
	}

	function schedule() {
		if (!ctx || !running) return;
		while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
			const idx = step % PATTERN_LEN;
			const k = KICK[idx] ?? 0;
			const b = BASS[idx];
			const c = BELL[idx] ?? 0;
			const h = HAT[idx] ?? 0;
			if (k === 1) playKick(nextStepTime);
			if (b !== undefined && b !== SILENT) {
				playBass(nextStepTime, b, bassNoteDuration(idx));
			}
			if (c === 1) playCowbell(nextStepTime);
			if (h > 0) playHat(nextStepTime, h === 2);
			nextStepTime += STEP;
			step += 1;
		}
	}

	function start() {
		const c = ensureContext();
		if (!c) return;
		if (c.state === "suspended") {
			void c.resume();
		}
		if (running) return;
		running = true;
		nextStepTime = c.currentTime + 0.06;
		step = 0;
		intervalId = window.setInterval(schedule, 25);
	}

	function stop() {
		if (intervalId !== null) {
			window.clearInterval(intervalId);
			intervalId = null;
		}
		running = false;
		if (master && ctx) {
			master.gain.cancelScheduledValues(ctx.currentTime);
			master.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
			window.setTimeout(() => {
				if (master && ctx && !running) {
					master.gain.setValueAtTime(muted ? 0 : 0.55, ctx.currentTime);
				}
			}, 200);
		}
	}

	function setMuted(m: boolean) {
		muted = m;
		if (master && ctx) {
			master.gain.cancelScheduledValues(ctx.currentTime);
			master.gain.setTargetAtTime(
				m ? 0 : running ? 0.55 : 0,
				ctx.currentTime,
				0.04,
			);
		}
	}

	function isMuted() {
		return muted;
	}

	function dispose() {
		stop();
		if (ctx) {
			void ctx.close();
			ctx = null;
		}
	}

	return { start, stop, setMuted, isMuted, dispose };
}
