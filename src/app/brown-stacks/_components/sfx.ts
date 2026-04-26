export type SfxKind =
	| "playerShoot"
	| "allyShoot"
	| "zombieHit"
	| "zombieKill"
	| "playerHurt";

export type SfxEngine = {
	play: (kind: SfxKind) => void;
	setMuted: (muted: boolean) => void;
	ensureStarted: () => void;
	dispose: () => void;
};

const MIN_GAP: Record<SfxKind, number> = {
	playerShoot: 0.04,
	allyShoot: 0.04,
	zombieHit: 0.025,
	zombieKill: 0.035,
	playerHurt: 0.4,
};

function getAudioCtor(): typeof AudioContext | undefined {
	if (typeof window === "undefined") return undefined;
	if (typeof AudioContext !== "undefined") return AudioContext;
	const w = window as { webkitAudioContext?: typeof AudioContext };
	return w.webkitAudioContext;
}

export function createSfxEngine(): SfxEngine {
	let ctx: AudioContext | null = null;
	let master: GainNode | null = null;
	let noiseBuf: AudioBuffer | null = null;
	let muted = false;
	const lastTimes: Map<SfxKind, number> = new Map();

	function ensureContext() {
		if (ctx) return ctx;
		const Ctor = getAudioCtor();
		if (!Ctor) return null;
		ctx = new Ctor();
		master = ctx.createGain();
		master.gain.value = muted ? 0 : 0.6;
		master.connect(ctx.destination);
		const len = Math.floor(ctx.sampleRate * 0.5);
		const buf = ctx.createBuffer(1, len, ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
		noiseBuf = buf;
		return ctx;
	}

	function ensureStarted() {
		const c = ensureContext();
		if (!c) return;
		if (c.state === "suspended") void c.resume();
	}

	function noiseBurst(t: number, dur: number, peak: number) {
		if (!ctx || !noiseBuf) return null;
		const src = ctx.createBufferSource();
		src.buffer = noiseBuf;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		src.connect(g);
		src.start(t);
		src.stop(t + dur + 0.02);
		return g;
	}

	function playerShoot(t: number) {
		if (!ctx || !master) return;
		const ng = noiseBurst(t, 0.06, 0.45);
		if (ng) {
			const hp = ctx.createBiquadFilter();
			hp.type = "highpass";
			hp.frequency.value = 1400;
			ng.disconnect();
			ng.connect(hp).connect(master);
		}
		const osc = ctx.createOscillator();
		const og = ctx.createGain();
		osc.type = "square";
		osc.frequency.setValueAtTime(240, t);
		osc.frequency.exponentialRampToValueAtTime(55, t + 0.07);
		og.gain.setValueAtTime(0.0001, t);
		og.gain.exponentialRampToValueAtTime(0.38, t + 0.003);
		og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
		osc.connect(og).connect(master);
		osc.start(t);
		osc.stop(t + 0.1);
	}

	function allyShoot(t: number) {
		if (!ctx || !master) return;
		const ng = noiseBurst(t, 0.045, 0.22);
		if (ng) {
			const hp = ctx.createBiquadFilter();
			hp.type = "highpass";
			hp.frequency.value = 2000;
			ng.disconnect();
			ng.connect(hp).connect(master);
		}
		const osc = ctx.createOscillator();
		const og = ctx.createGain();
		osc.type = "square";
		osc.frequency.setValueAtTime(300, t);
		osc.frequency.exponentialRampToValueAtTime(85, t + 0.05);
		og.gain.setValueAtTime(0.0001, t);
		og.gain.exponentialRampToValueAtTime(0.18, t + 0.003);
		og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
		osc.connect(og).connect(master);
		osc.start(t);
		osc.stop(t + 0.08);
	}

	function zombieHit(t: number) {
		if (!ctx || !master) return;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(190, t);
		osc.frequency.exponentialRampToValueAtTime(70, t + 0.05);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.28, t + 0.003);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
		osc.connect(g).connect(master);
		osc.start(t);
		osc.stop(t + 0.1);
	}

	function zombieKill(t: number) {
		if (!ctx || !master) return;
		const ng = noiseBurst(t, 0.2, 0.5);
		if (ng) {
			const lp = ctx.createBiquadFilter();
			lp.type = "lowpass";
			lp.frequency.setValueAtTime(2200, t);
			lp.frequency.exponentialRampToValueAtTime(280, t + 0.18);
			ng.disconnect();
			ng.connect(lp).connect(master);
		}
		const osc = ctx.createOscillator();
		const og = ctx.createGain();
		osc.type = "sawtooth";
		osc.frequency.setValueAtTime(130, t);
		osc.frequency.exponentialRampToValueAtTime(42, t + 0.16);
		og.gain.setValueAtTime(0.0001, t);
		og.gain.exponentialRampToValueAtTime(0.32, t + 0.005);
		og.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
		osc.connect(og).connect(master);
		osc.start(t);
		osc.stop(t + 0.22);
	}

	function playerHurt(t: number) {
		if (!ctx || !master) return;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		const lp = ctx.createBiquadFilter();
		osc.type = "sawtooth";
		osc.frequency.setValueAtTime(190, t);
		osc.frequency.exponentialRampToValueAtTime(55, t + 0.22);
		lp.type = "lowpass";
		lp.frequency.value = 700;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.42, t + 0.005);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
		osc.connect(lp).connect(g).connect(master);
		osc.start(t);
		osc.stop(t + 0.3);
	}

	function play(kind: SfxKind) {
		ensureStarted();
		if (!ctx || muted) return;
		const now = ctx.currentTime;
		const last = lastTimes.get(kind) ?? 0;
		if (now - last < MIN_GAP[kind]) return;
		lastTimes.set(kind, now);
		switch (kind) {
			case "playerShoot":
				playerShoot(now);
				break;
			case "allyShoot":
				allyShoot(now);
				break;
			case "zombieHit":
				zombieHit(now);
				break;
			case "zombieKill":
				zombieKill(now);
				break;
			case "playerHurt":
				playerHurt(now);
				break;
		}
	}

	function setMuted(m: boolean) {
		muted = m;
		if (master && ctx) {
			master.gain.cancelScheduledValues(ctx.currentTime);
			master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.04);
		}
	}

	function dispose() {
		if (ctx) {
			void ctx.close();
			ctx = null;
		}
	}

	return { play, setMuted, ensureStarted, dispose };
}
