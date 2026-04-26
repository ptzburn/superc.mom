export type MusicEngine = {
	start: () => void;
	stop: () => void;
	setMuted: (muted: boolean) => void;
	isMuted: () => boolean;
	dispose: () => void;
};

/** Baile / Brazilian phonk: mid-tempo, heavy 808, syncopated sub, rolling hats */
const BPM = 134;
const STEP = 60 / BPM / 4;
const ROOT_HZ = 44.5; // A0 area — “carro rebaixado” weight
const SCHEDULE_AHEAD = 0.22;
const SILENT = -100;
const PATTERN_LEN = 32;

/** Sub syncopation — 16th-note funk (subido / tumba) */
const BASS: ReadonlyArray<number> = [
	0,
	SILENT,
	3,
	0,
	SILENT,
	-2,
	0,
	SILENT,
	0,
	3,
	-2,
	SILENT,
	0,
	5,
	SILENT,
	0,
	-2,
	SILENT,
	0,
	3,
	0,
	SILENT,
	0,
	-3,
	0,
	SILENT,
	3,
	-2,
	SILENT,
	0,
	-5,
	0,
];

/** 808 kick — 4/4, front-loaded */
const KICK: ReadonlyArray<number> = [
	1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0,
	0, 0, 1, 0, 0, 0,
];

const CLAP: ReadonlyArray<number> = [
	0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0,
	0, 0, 1, 0, 0, 0,
];

/** Lead stabs (sinistro pluck) */
const BELL: ReadonlyArray<number> = [
	0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
	1, 0, 0, 0, 1, 0,
];

/** Hi-hat roll: 1 = hit, 2 = open (accent) */
const HAT: ReadonlyArray<number> = [
	1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
	1, 0, 1, 0, 2, 0,
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
	let comp: DynamicsCompressorNode | null = null;
	let subNode: GainNode | null = null;
	let midNode: GainNode | null = null;
	let noiseBuf: AudioBuffer | null = null;
	let airBuf: AudioBuffer | null = null;
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
		comp.threshold.value = -18;
		comp.knee.value = 10;
		comp.ratio.value = 2.1;
		comp.attack.value = 0.002;
		comp.release.value = 0.24;
		// “Grave” bus vs percussion / plucks (sidechain feel via separate gains)
		subNode = ctx.createGain();
		subNode.gain.value = 1.25;
		midNode = ctx.createGain();
		midNode.gain.value = 0.78;
		master = ctx.createGain();
		master.gain.value = muted ? 0 : 0.64;
		subNode.connect(comp);
		midNode.connect(comp);
		comp.connect(master);
		master.connect(ctx.destination);

		const len = Math.floor(ctx.sampleRate * 0.4);
		const buf = ctx.createBuffer(1, len, ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
		noiseBuf = buf;

		const airLen = Math.floor(ctx.sampleRate * 0.12);
		const ab = ctx.createBuffer(1, airLen, ctx.sampleRate);
		const ad = ab.getChannelData(0);
		for (let i = 0; i < airLen; i++) {
			const t = i / airLen;
			ad[i] = (Math.random() * 2 - 1) * (1 - t) * 0.8;
		}
		airBuf = ab;
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

	/** 808 — long sub, heavy hit */
	function playKick(t: number) {
		if (!ctx || !subNode) return;
		const body = ctx.createOscillator();
		const bg = ctx.createGain();
		body.type = "sine";
		body.frequency.setValueAtTime(200, t);
		body.frequency.exponentialRampToValueAtTime(40, t + 0.14);
		bg.gain.setValueAtTime(0.0001, t);
		bg.gain.exponentialRampToValueAtTime(0.9, t + 0.004);
		bg.gain.exponentialRampToValueAtTime(0.12, t + 0.14);
		bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
		body.connect(bg);
		if (subNode) bg.connect(subNode);

		const sub = ctx.createOscillator();
		const sg = ctx.createGain();
		sub.type = "sine";
		sub.frequency.setValueAtTime(58, t);
		sg.gain.setValueAtTime(0.0001, t);
		sg.gain.exponentialRampToValueAtTime(0.55, t + 0.01);
		sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
		sub.connect(sg);
		if (subNode) sg.connect(subNode);
		sub.start(t);
		sub.stop(t + 0.4);
		body.start(t);
		body.stop(t + 0.5);

		const click = ctx.createOscillator();
		const cg = ctx.createGain();
		click.type = "square";
		click.frequency.value = 1500;
		cg.gain.setValueAtTime(0.0001, t);
		cg.gain.exponentialRampToValueAtTime(0.2, t + 0.0012);
		cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
		click.connect(cg);
		if (midNode) cg.connect(midNode);
		click.start(t);
		click.stop(t + 0.04);
	}

	/** 808 + saw + sub-octave sin — “grave estourado” */
	function playBass(t: number, st: number, dur: number) {
		if (!ctx || !subNode) return;
		const freq = semitoneToHz(st);
		const d = Math.max(dur, STEP * 0.6);

		const sub = ctx.createOscillator();
		const s2 = ctx.createOscillator();
		const s3 = ctx.createOscillator();
		const lp = ctx.createBiquadFilter();
		const ws = ctx.createWaveShaper();
		const g = ctx.createGain();

		sub.type = "sine";
		sub.frequency.setValueAtTime(freq * 0.5, t);
		sub.frequency.exponentialRampToValueAtTime(freq * 0.5 * 0.99, t + d);

		s2.type = "sine";
		s2.frequency.setValueAtTime(freq, t);
		s2.frequency.exponentialRampToValueAtTime(freq * 0.987, t + d * 0.9);

		s3.type = "sawtooth";
		s3.frequency.setValueAtTime(freq * 1.0, t);
		s3.frequency.exponentialRampToValueAtTime(freq * 0.99, t + d * 0.5);

		lp.type = "lowpass";
		lp.Q.value = 2.2;
		lp.frequency.setValueAtTime(420, t);
		lp.frequency.exponentialRampToValueAtTime(90, t + d * 0.85);

		ws.curve = distortionCurve(18);
		ws.oversample = "4x";

		const gsub = ctx.createGain();
		const gmid = ctx.createGain();
		gsub.gain.value = 0.62;
		gmid.gain.value = 0.5;

		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.85, t + 0.015);
		g.gain.setValueAtTime(0.78, t + d * 0.55);
		g.gain.exponentialRampToValueAtTime(0.0001, t + d);

		sub.connect(gsub);
		s2.connect(gsub);
		s3.connect(lp);
		lp.connect(ws);
		ws.connect(gmid);
		gsub.connect(g);
		gmid.connect(g);
		if (subNode) g.connect(subNode);
		sub.start(t);
		s2.start(t);
		s3.start(t);
		sub.stop(t + d + 0.04);
		s2.stop(t + d + 0.04);
		s3.stop(t + d + 0.04);
	}

	/** Fogo — snare+body */
	function playClap(t: number) {
		if (!ctx || !midNode || !noiseBuf) return;
		const src = ctx.createBufferSource();
		const hp = ctx.createBiquadFilter();
		const bp = ctx.createBiquadFilter();
		const g = ctx.createGain();
		src.buffer = noiseBuf;
		hp.type = "highpass";
		hp.frequency.value = 400;
		bp.type = "bandpass";
		bp.frequency.value = 1600;
		bp.Q.value = 0.6;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.5, t + 0.002);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
		src.connect(hp);
		hp.connect(bp);
		bp.connect(g);
		if (midNode) g.connect(midNode);
		src.start(t);
		src.stop(t + 0.18);
	}

	/** Muted lead — 7th/9th color */
	function playPluck(t: number) {
		if (!ctx || !midNode) return;
		const f = semitoneToHz(12 + 2);
		const o = ctx.createOscillator();
		const o2 = ctx.createOscillator();
		const g = ctx.createGain();
		const p = ctx.createBiquadFilter();
		o.type = "triangle";
		o2.type = "triangle";
		o.frequency.setValueAtTime(f, t);
		o2.frequency.setValueAtTime(f * 1.5, t);
		p.type = "lowpass";
		p.frequency.setValueAtTime(2800, t);
		p.frequency.exponentialRampToValueAtTime(200, t + 0.1);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.18, t + 0.001);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
		o.connect(p);
		o2.connect(p);
		p.connect(g);
		if (midNode) g.connect(midNode);
		o.start(t);
		o2.start(t);
		o.stop(t + 0.16);
		o2.stop(t + 0.16);
	}

	function playHat(t: number, open: boolean) {
		if (!ctx || !midNode || !noiseBuf) return;
		const src = ctx.createBufferSource();
		const hp = ctx.createBiquadFilter();
		const g = ctx.createGain();
		src.buffer = open ? (airBuf ?? noiseBuf) : noiseBuf;
		hp.type = "highpass";
		hp.frequency.value = open ? 5000 : 7000;
		const peak = open ? 0.38 : 0.2;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(peak, t + 0.0012);
		g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.1 : 0.045));
		src.connect(hp);
		hp.connect(g);
		if (midNode) g.connect(midNode);
		src.start(t);
		src.stop(t + 0.12);
	}

	function bassNoteDuration(idx: number) {
		for (let i = 1; i < PATTERN_LEN; i++) {
			const next = BASS[(idx + i) % PATTERN_LEN];
			if (next !== undefined && next !== SILENT) {
				return Math.min(STEP * i, STEP * 4.5);
			}
		}
		return STEP * 4.5;
	}

	function schedule() {
		if (!ctx || !running) return;
		while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
			const idx = step % PATTERN_LEN;
			const k = KICK[idx] ?? 0;
			const b = BASS[idx];
			const c = BELL[idx] ?? 0;
			const h = HAT[idx] ?? 0;
			const cl = CLAP[idx] ?? 0;
			if (k === 1) playKick(nextStepTime);
			if (b !== undefined && b !== SILENT) {
				playBass(nextStepTime, b, bassNoteDuration(idx));
			}
			if (c === 1) playPluck(nextStepTime);
			if (cl === 1) playClap(nextStepTime);
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
		nextStepTime = c.currentTime + 0.08;
		step = 0;
		intervalId = window.setInterval(schedule, 22);
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
					master.gain.setValueAtTime(muted ? 0 : 0.64, ctx.currentTime);
				}
			}, 200);
		}
	}

	function setMuted(m: boolean) {
		muted = m;
		if (master && ctx) {
			master.gain.cancelScheduledValues(ctx.currentTime);
			master.gain.setTargetAtTime(
				m ? 0 : running ? 0.64 : 0,
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
