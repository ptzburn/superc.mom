import {
	ALLY_RADIUS,
	ARENA_H,
	ARENA_W,
	BRAWL_OUT,
	BRAWL_OUT_SOFT,
	BRAWL_OUTW,
	BR_FONT,
	PLAYER_GOP_SKIN,
	PLAYER_RADIUS,
} from "./constants";
import { getActiveTheme } from "./theme";
import type {
	Ally,
	Bullet,
	DrawItem,
	GameRuntime,
	Obstacle,
	Particle,
	Player,
	Vec,
	Zombie,
} from "./types";
import { clamp } from "./utils";
import { obstacleBottomY } from "./world";

/** Lighter on top/forward, darker on bottom — reads as 3D on an ellipse (top-down). */
function createBlobGradient(
	ctx: CanvasRenderingContext2D,
	ox: number,
	oy: number,
	rx: number,
	ry: number,
	light: string,
	mid: string,
	dark: string,
) {
	const g = ctx.createRadialGradient(
		ox - rx * 0.4,
		oy - ry * 0.5,
		Math.min(rx, ry) * 0.08,
		ox,
		oy,
		Math.max(rx, ry) * 1.05,
	);
	g.addColorStop(0, light);
	g.addColorStop(0.5, mid);
	g.addColorStop(1, dark);
	return g;
}

/** Top-down polymer handgun: barrel along +x from origin. `L` = overall length. */
function drawHandgunTopDown(ctx: CanvasRenderingContext2D, L: number) {
	const sw = L * 0.14;
	const s0 = L * 0.08;
	const s1 = L * 0.66;
	const mGrad = ctx.createLinearGradient(0, -sw, 0, sw);
	mGrad.addColorStop(0, "#d0d8e0");
	mGrad.addColorStop(0.35, "#7a8694");
	mGrad.addColorStop(0.7, "#3a4048");
	mGrad.addColorStop(1, "#101418");
	ctx.beginPath();
	ctx.roundRect(s0, -sw, s1 - s0, sw * 2, L * 0.025);
	ctx.fillStyle = mGrad;
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 0.85;
	ctx.stroke();
	for (let i = 0; i < 3; i++) {
		const x = s0 + 4 + i * 3.5;
		ctx.beginPath();
		ctx.moveTo(x, -sw * 0.55);
		ctx.lineTo(x + 0.6, -sw * 0.15);
		ctx.strokeStyle = "rgba(0,0,0,0.28)";
		ctx.lineWidth = 0.4;
		ctx.stroke();
	}
	ctx.beginPath();
	ctx.ellipse(s1, 0, L * 0.04, sw * 0.55, 0, 0, Math.PI * 2);
	const mug = ctx.createRadialGradient(s1, 0, 0, s1, 0, L * 0.05);
	mug.addColorStop(0, "#2a2a2a");
	mug.addColorStop(0.5, "#0a0a0a");
	mug.addColorStop(1, "#000000");
	ctx.fillStyle = mug;
	ctx.fill();
	ctx.beginPath();
	ctx.arc(s1 + L * 0.03, 0, L * 0.018, 0, Math.PI * 2);
	ctx.fillStyle = "rgba(0,0,0,0.75)";
	ctx.fill();
	ctx.fillStyle = "#0a0a0a";
	ctx.fillRect(s1 - 0.3, -sw * 0.85, 1, sw * 0.4);
	ctx.beginPath();
	ctx.moveTo(s0, sw);
	ctx.lineTo(s0 - L * 0.12, L * 0.2);
	ctx.lineTo(s0 - L * 0.04, L * 0.32);
	ctx.lineTo(s0 + L * 0.2, L * 0.12);
	ctx.closePath();
	const fgrad = ctx.createLinearGradient(0, 0, 0, L * 0.3);
	fgrad.addColorStop(0, "#3a3d42");
	fgrad.addColorStop(1, "#0c0d10");
	ctx.fillStyle = fgrad;
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(s0 + L * 0.3, L * 0.1, L * 0.1, 0, Math.PI);
	ctx.strokeStyle = "rgba(0,0,0,0.5)";
	ctx.lineWidth = 0.6;
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(s0 + L * 0.3, L * 0.12);
	ctx.quadraticCurveTo(s0 + L * 0.22, L * 0.16, s0 + L * 0.2, L * 0.1);
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 0.5;
	ctx.stroke();
	ctx.beginPath();
	ctx.roundRect(s0 - L * 0.2, L * 0.1, L * 0.2, L * 0.2, 2);
	const gg = ctx.createLinearGradient(0, L * 0.1, 0, L * 0.32);
	gg.addColorStop(0, "#181818");
	gg.addColorStop(1, "#050505");
	ctx.fillStyle = gg;
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 0.7;
	ctx.stroke();
	ctx.fillStyle = "#2a2a2a";
	ctx.fillRect(s0 - L * 0.12, L * 0.24, L * 0.1, 1.2);
	ctx.strokeStyle = "rgba(255,255,255,0.15)";
	ctx.lineWidth = 0.3;
	ctx.beginPath();
	ctx.moveTo(s0 + L * 0.1, sw);
	ctx.lineTo(s0 + L * 0.45, sw);
	ctx.stroke();
}

export function render(ctx: CanvasRenderingContext2D, s: GameRuntime) {
	ctx.save();
	if (s.shakeTime > 0) {
		const m = s.shakeMag * (s.shakeTime / 0.18);
		ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
	}
	drawGround(ctx);

	const items: DrawItem[] = [];
	for (const a of s.allies) {
		if (a.alive) items.push({ y: a.pos.y, draw: () => drawAlly(ctx, a) });
		else items.push({ y: a.pos.y, draw: () => drawDeadAlly(ctx, a) });
	}
	items.push({ y: s.player.pos.y, draw: () => drawPlayer(ctx, s.player) });
	for (const z of s.zombies)
		items.push({ y: z.pos.y, draw: () => drawZombie(ctx, z) });
	for (const o of s.obstacles)
		items.push({ y: obstacleBottomY(o), draw: () => drawObstacle(ctx, o) });
	items.sort((a, b) => a.y - b.y);
	for (const it of items) it.draw();

	for (const b of s.bullets) drawBullet(ctx, b);
	for (const p of s.particles) drawParticle(ctx, p);

	for (const z of s.zombies) {
		drawHpBar(ctx, z.pos, z.hp, z.maxHp, z.radius + 8, 28, 4, "#ff4058");
	}
	for (const a of s.allies) {
		if (a.alive && a.hp < a.maxHp) {
			drawHpBar(ctx, a.pos, a.hp, a.maxHp, ALLY_RADIUS + 12, 28, 4, "#00e868");
		}
	}

	for (const t of s.texts) {
		ctx.globalAlpha = clamp(t.life / 0.6, 0, 1);
		ctx.fillStyle = t.color;
		ctx.font = "bold 13px ui-sans-serif, system-ui, sans-serif";
		ctx.textAlign = "center";
		ctx.fillText(t.text, t.pos.x, t.pos.y);
	}
	ctx.globalAlpha = 1;
	ctx.restore();

	drawVignette(ctx);
	if (s.bannerTime > 0 && s.bannerText && s.phase !== "gameover") {
		drawBanner(ctx, s.bannerText, s.bannerTime, s.bannerMaxTime);
	}
	drawCrosshair(ctx, s.mouse);
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle) {
	ctx.save();
	if (o.kind === "barrel") {
		ctx.beginPath();
		ctx.ellipse(
			o.x,
			o.y + o.r * 0.55,
			o.r * 0.95,
			o.r * 0.38,
			0,
			0,
			Math.PI * 2,
		);
		ctx.fillStyle = "rgba(0,0,0,0.28)";
		ctx.fill();
		const bg = ctx.createRadialGradient(
			o.x - o.r * 0.25,
			o.y - o.r * 0.2,
			0,
			o.x,
			o.y,
			o.r,
		);
		bg.addColorStop(0, "#e86850");
		bg.addColorStop(0.45, "#c84030");
		bg.addColorStop(1, "#781018");
		ctx.beginPath();
		ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
		ctx.fillStyle = bg;
		ctx.fill();
		ctx.strokeStyle = BRAWL_OUT;
		ctx.lineWidth = BRAWL_OUTW;
		ctx.stroke();
		ctx.strokeStyle = "rgba(255,255,255,0.28)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(o.x - o.r * 0.2, o.y - o.r * 0.2, o.r * 0.35, 0, Math.PI * 2);
		ctx.stroke();
		ctx.fillStyle = "#f0e8d8";
		ctx.fillRect(o.x - o.r * 0.55, o.y - o.r * 0.12, o.r * 1.1, o.r * 0.24);
		ctx.strokeStyle = BRAWL_OUT;
		ctx.lineWidth = BRAWL_OUT_SOFT;
		ctx.strokeRect(o.x - o.r * 0.55, o.y - o.r * 0.12, o.r * 1.1, o.r * 0.24);
		ctx.fillStyle = "#1a1a1a";
		ctx.font = `bold ${Math.max(8, o.r * 0.55)}px sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("!", o.x, o.y + o.r * 0.02);
	} else if (o.kind === "crate") {
		ctx.fillStyle = "rgba(0,0,0,0.3)";
		ctx.fillRect(o.x + 4, o.y + 6, o.w, o.h);
		const g = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
		g.addColorStop(0, "#d4a86a");
		g.addColorStop(0.5, "#9a6a35");
		g.addColorStop(1, "#5a3a1a");
		ctx.fillStyle = g;
		ctx.fillRect(o.x, o.y, o.w, o.h);
		ctx.strokeStyle = BRAWL_OUT;
		ctx.lineWidth = BRAWL_OUTW;
		ctx.strokeRect(o.x, o.y, o.w, o.h);
		const plank = 10;
		for (let py = o.y + plank; py < o.y + o.h - 2; py += plank) {
			ctx.beginPath();
			ctx.moveTo(o.x + 2, py);
			ctx.lineTo(o.x + o.w - 2, py);
			ctx.strokeStyle = "rgba(0,0,0,0.22)";
			ctx.lineWidth = 1.2;
			ctx.stroke();
		}
		ctx.strokeStyle = "rgba(255,255,255,0.2)";
		ctx.beginPath();
		ctx.moveTo(o.x + 3, o.y + 3);
		ctx.lineTo(o.x + o.w - 3, o.y + o.h - 3);
		ctx.stroke();
		for (const [dx, dy] of [
			[2, 2],
			[o.w - 2, 2],
		] as const) {
			ctx.fillStyle = "#5a5a5a";
			ctx.beginPath();
			ctx.arc(o.x + dx, o.y + dy, 3, 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = BRAWL_OUT;
			ctx.lineWidth = 0.8;
			ctx.stroke();
		}
	} else {
		ctx.fillStyle = "rgba(0,0,0,0.3)";
		ctx.fillRect(o.x + 2, o.y + 5, o.w, o.h);
		const g2 = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
		g2.addColorStop(0, "#b8a898");
		g2.addColorStop(0.4, "#8a7a6a");
		g2.addColorStop(1, "#4a3a2c");
		ctx.fillStyle = g2;
		ctx.fillRect(o.x, o.y, o.w, o.h);
		const isHoriz = o.w > o.h;
		const count = isHoriz
			? Math.max(2, Math.round(o.w / 28))
			: Math.max(2, Math.round(o.h / 28));
		for (let i = 1; i < count; i++) {
			ctx.beginPath();
			if (isHoriz) {
				const x = o.x + (o.w / count) * i;
				ctx.moveTo(x, o.y + 1);
				ctx.lineTo(x, o.y + o.h - 1);
			} else {
				const y = o.y + (o.h / count) * i;
				ctx.moveTo(o.x + 1, y);
				ctx.lineTo(o.x + o.w - 1, y);
			}
			ctx.strokeStyle = "rgba(0,0,0,0.2)";
			ctx.lineWidth = 1.1;
			ctx.stroke();
		}
		ctx.strokeStyle = BRAWL_OUT;
		ctx.lineWidth = BRAWL_OUTW;
		ctx.strokeRect(o.x, o.y, o.w, o.h);
	}
	ctx.restore();
}

function drawGround(ctx: CanvasRenderingContext2D) {
	const arenaImg = getActiveTheme()?.arena;
	if (arenaImg?.complete && arenaImg.naturalWidth > 0) {
		ctx.drawImage(arenaImg, 0, 0, ARENA_W, ARENA_H);
		ctx.fillStyle = "rgba(6, 18, 42, 0.18)";
		ctx.fillRect(0, 0, ARENA_W, ARENA_H);
		const rim = ctx.createLinearGradient(0, 0, ARENA_W, ARENA_H);
		rim.addColorStop(0, "#fff6c8");
		rim.addColorStop(0.3, "#f0c850");
		rim.addColorStop(0.5, "#d8a020");
		rim.addColorStop(0.7, "#f0c850");
		rim.addColorStop(1, "#fff6c8");
		ctx.strokeStyle = rim;
		ctx.lineWidth = 7;
		ctx.strokeRect(2, 2, ARENA_W - 4, ARENA_H - 4);
		return;
	}
	const cx = ARENA_W / 2;
	const cy = ARENA_H / 2;
	const g = ctx.createRadialGradient(
		cx * 0.9,
		cy * 0.75,
		40,
		cx,
		cy,
		Math.max(ARENA_W, ARENA_H) * 0.72,
	);
	g.addColorStop(0, "#9fe860");
	g.addColorStop(0.35, "#6dd23e");
	g.addColorStop(0.7, "#4ab028");
	g.addColorStop(1, "#2d7818");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, ARENA_W, ARENA_H);
	for (let i = 0; i < 90; i++) {
		const x = ((i * 127 + i * i * 0.1) | 0) % (ARENA_W - 24);
		const y = ((i * 83 + 37) | 0) % (ARENA_H - 24);
		const rad = 5 + (i % 6) * 2.2;
		ctx.globalAlpha = 0.1 + (i % 5) * 0.04;
		ctx.beginPath();
		ctx.arc(12 + x, 12 + y, rad, 0, Math.PI * 2);
		ctx.fillStyle = i % 3 === 0 ? "#1a5a0c" : "#b8f070";
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	for (let i = 0; i < 16; i++) {
		const bx = 40 + ((i * 97) % (ARENA_W - 100));
		const by = 30 + ((i * 71 + i * 7) % (ARENA_H - 80));
		ctx.beginPath();
		ctx.ellipse(bx, by, 22 + (i % 4) * 5, 16 + (i % 3) * 3, 0, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(25, 90, 18, 0.22)";
		ctx.fill();
	}
	const step = 48;
	for (let x = 0; x < ARENA_W; x += step) {
		for (let y = 0; y < ARENA_H; y += step) {
			const tx = x + 1;
			const ty = y + 1;
			ctx.beginPath();
			ctx.moveTo(tx, ty);
			ctx.lineTo(tx + step * 0.4, ty);
			ctx.lineTo(tx + step * 0.2, ty + step * 0.4);
			ctx.closePath();
			ctx.fillStyle = "rgba(255,255,255,0.035)";
			ctx.fill();
		}
	}
	const rim = ctx.createLinearGradient(0, 0, ARENA_W, ARENA_H);
	rim.addColorStop(0, "#fff6c8");
	rim.addColorStop(0.3, "#f0c850");
	rim.addColorStop(0.5, "#d8a020");
	rim.addColorStop(0.7, "#f0c850");
	rim.addColorStop(1, "#fff6c8");
	ctx.strokeStyle = rim;
	ctx.lineWidth = 7;
	ctx.strokeRect(2, 2, ARENA_W - 4, ARENA_H - 4);
	ctx.strokeStyle = "rgba(255,255,255,0.55)";
	ctx.lineWidth = 1.2;
	ctx.strokeRect(5, 5, ARENA_W - 10, ARENA_H - 10);
	ctx.strokeStyle = "rgba(20, 50, 120, 0.35)";
	ctx.lineWidth = 2;
	ctx.strokeRect(9, 9, ARENA_W - 18, ARENA_H - 18);
}

/** Your team: **elephant** mascot + red/white cap (+x = facing). */
function drawGOPBrawler(
	ctx: CanvasRenderingContext2D,
	pos: Vec,
	angle: number,
	r: number,
	bodyDark: string,
	bodyLight: string,
	capRed: string,
	capPanel: string,
	hitFlash: number,
) {
	const earIn = `rgba(255,200,210,0.9)`;
	ctx.save();
	ctx.translate(pos.x, pos.y);
	const sh = ctx.createRadialGradient(0, r * 0.65, 0, 0, r * 0.75, r * 0.95);
	sh.addColorStop(0, "rgba(20, 40, 80, 0.35)");
	sh.addColorStop(1, "rgba(40, 100, 160, 0.06)");
	ctx.beginPath();
	ctx.ellipse(0, r * 0.7, r * 0.88, r * 0.34, 0, 0, Math.PI * 2);
	ctx.fillStyle = sh;
	ctx.fill();
	ctx.rotate(angle);
	const txW = r * 0.52;
	const tyH = r * 0.48;
	ctx.beginPath();
	ctx.ellipse(0, 0, txW, tyH, 0, 0, Math.PI * 2);
	ctx.fillStyle = createBlobGradient(
		ctx,
		0,
		-tyH * 0.15,
		txW,
		tyH,
		bodyLight,
		bodyDark,
		"rgba(0,0,0,0.45)",
	);
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = BRAWL_OUTW;
	ctx.stroke();
	for (const dx of [-0.32, 0.22] as const) {
		for (const sy of [-1, 1] as const) {
			ctx.beginPath();
			ctx.ellipse(
				dx * r,
				sy * (tyH * 0.75),
				r * 0.12,
				r * 0.16,
				0,
				0,
				Math.PI * 2,
			);
			const fg = createBlobGradient(
				ctx,
				dx * r,
				sy * (tyH * 0.75),
				r * 0.12,
				r * 0.16,
				"#4a4a4a",
				"#1a1a1a",
				"rgba(0,0,0,0.5)",
			);
			ctx.fillStyle = fg;
			ctx.fill();
			ctx.strokeStyle = BRAWL_OUT;
			ctx.lineWidth = 0.7;
			ctx.stroke();
		}
	}
	const hx = r * 0.38;
	const hy = 0.02 * r;
	for (const sign of [-1, 1] as const) {
		ctx.beginPath();
		ctx.ellipse(
			hx * 0.4,
			sign * (r * 0.4),
			r * 0.2,
			r * 0.32,
			sign * 0.1,
			0,
			Math.PI * 2,
		);
		ctx.fillStyle = createBlobGradient(
			ctx,
			hx * 0.4,
			sign * (r * 0.4),
			r * 0.2,
			r * 0.32,
			bodyLight,
			bodyDark,
			"rgba(0,0,0,0.35)",
		);
		ctx.fill();
		ctx.strokeStyle = BRAWL_OUT;
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.beginPath();
		ctx.ellipse(
			hx * 0.38,
			sign * (r * 0.38),
			r * 0.1,
			r * 0.18,
			sign * 0.12,
			0,
			Math.PI * 2,
		);
		ctx.fillStyle = earIn;
		ctx.fill();
	}
	ctx.beginPath();
	ctx.ellipse(hx, hy, r * 0.22, r * 0.2, 0, 0, Math.PI * 2);
	ctx.fillStyle = createBlobGradient(
		ctx,
		hx,
		hy - r * 0.1,
		r * 0.22,
		r * 0.2,
		bodyLight,
		bodyDark,
		"rgba(0,0,0,0.25)",
	);
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = BRAWL_OUTW;
	ctx.stroke();
	const trunkG = ctx.createLinearGradient(hx, hy, hx + r * 0.7, hy);
	trunkG.addColorStop(0, bodyLight);
	trunkG.addColorStop(0.55, bodyDark);
	trunkG.addColorStop(1, "#0a0a0a");
	ctx.beginPath();
	ctx.moveTo(hx + r * 0.1, hy);
	ctx.quadraticCurveTo(
		hx + r * 0.48,
		hy - r * 0.12,
		hx + r * 0.68,
		hy + r * 0.06,
	);
	ctx.strokeStyle = trunkG;
	ctx.lineWidth = 4.2;
	ctx.lineCap = "round";
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(hx + r * 0.1, hy + r * 0.1, r * 0.1, 0.1, 0.9);
	ctx.strokeStyle = "rgba(255,250,240,0.95)";
	ctx.lineWidth = 1.2;
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(hx + r * 0.1, hy - r * 0.1, r * 0.1, -0.9, -0.1);
	ctx.stroke();
	for (const sy of [-1, 1] as const) {
		ctx.beginPath();
		ctx.arc(hx + r * 0.12, hy + sy * (r * 0.05), 1.1, 0, Math.PI * 2);
		ctx.fillStyle = "#0a0a0a";
		ctx.fill();
	}
	const capG = ctx.createLinearGradient(
		hx - r * 0.1,
		hy - r * 0.55,
		hx + r * 0.35,
		hy - r * 0.1,
	);
	capG.addColorStop(0, "#ff3a2a");
	capG.addColorStop(0.6, capRed);
	capG.addColorStop(1, "#4a0000");
	ctx.beginPath();
	ctx.moveTo(hx - r * 0.18, hy - r * 0.1);
	ctx.lineTo(hx - r * 0.1, hy - r * 0.58);
	ctx.lineTo(hx + r * 0.2, hy - r * 0.62);
	ctx.lineTo(hx + r * 0.38, hy - r * 0.12);
	ctx.lineTo(hx + r * 0.05, hy - 0.02 * r);
	ctx.closePath();
	ctx.fillStyle = capG;
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 1.1;
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(hx + r * 0.02, hy - r * 0.05);
	ctx.lineTo(hx + r * 0.1, hy - r * 0.5);
	ctx.lineTo(hx + r * 0.36, hy - r * 0.2);
	ctx.closePath();
	ctx.fillStyle = capPanel;
	ctx.fill();
	ctx.stroke();
	const capFont = `bold ${Math.max(3.2, r * 0.055)}px ui-sans-serif, sans-serif`;
	ctx.save();
	ctx.translate(hx + r * 0.18, hy - r * 0.32);
	ctx.rotate(-0.12);
	ctx.font = capFont;
	ctx.fillStyle = "#102878";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText("MAGA", 0, 0);
	ctx.restore();
	ctx.save();
	ctx.translate(r * 0.4, r * 0.1);
	ctx.rotate(0.05);
	drawHandgunTopDown(ctx, r * 0.95);
	ctx.restore();
	if (hitFlash > 0) {
		ctx.globalAlpha = clamp(hitFlash / 0.15, 0, 1) * 0.6;
		ctx.beginPath();
		ctx.ellipse(0, 0, txW * 1.15, tyH * 1.15, 0, 0, Math.PI * 2);
		ctx.fillStyle = "#ffffff";
		ctx.fill();
		ctx.globalAlpha = 1;
	}
	ctx.restore();
}

function drawVigilante(ctx: CanvasRenderingContext2D, a: Ally) {
	const allyImg = getActiveTheme()?.ally;
	if (allyImg?.complete && allyImg.naturalWidth > 0) {
		drawSprite(ctx, allyImg, a.pos, a.angle, ALLY_RADIUS, a.hitFlash);
		return;
	}
	drawGOPBrawler(
		ctx,
		a.pos,
		a.angle,
		ALLY_RADIUS,
		a.armor,
		a.armorHighlight,
		a.cape,
		a.capeInner,
		a.hitFlash,
	);
}

function drawSprite(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	pos: Vec,
	angle: number,
	radius: number,
	hitFlash: number,
) {
	ctx.save();
	ctx.translate(pos.x, pos.y);
	ctx.beginPath();
	ctx.ellipse(
		0,
		radius * 0.7,
		radius * 0.85,
		radius * 0.32,
		0,
		0,
		Math.PI * 2,
	);
	const sh = ctx.createRadialGradient(
		0,
		radius * 0.6,
		0,
		0,
		radius * 0.7,
		radius,
	);
	sh.addColorStop(0, "rgba(0,0,0,0.45)");
	sh.addColorStop(1, "rgba(0,0,0,0.05)");
	ctx.fillStyle = sh;
	ctx.fill();
	ctx.rotate(angle);
	const d = radius * 2.8;
	ctx.drawImage(img, -d * 0.5, -d * 0.5, d, d);
	if (hitFlash > 0) {
		ctx.globalCompositeOperation = "source-atop";
		ctx.globalAlpha = clamp(hitFlash / 0.1, 0, 1) * 0.65;
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(-d * 0.5, -d * 0.5, d, d);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
	}
	ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player) {
	drawGOPBrawler(
		ctx,
		p.pos,
		p.angle,
		PLAYER_RADIUS,
		PLAYER_GOP_SKIN.armor,
		PLAYER_GOP_SKIN.armorHighlight,
		PLAYER_GOP_SKIN.cape,
		PLAYER_GOP_SKIN.capeInner,
		p.hitFlash,
	);
	ctx.beginPath();
	ctx.arc(p.pos.x, p.pos.y, PLAYER_RADIUS + 8, 0, Math.PI * 2);
	ctx.strokeStyle = "rgba(255,255,255,0.95)";
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(p.pos.x, p.pos.y, PLAYER_RADIUS + 6, 0, Math.PI * 2);
	ctx.strokeStyle = "rgba(0,200,255,0.95)";
	ctx.lineWidth = 2;
	ctx.stroke();
}

function drawAlly(ctx: CanvasRenderingContext2D, a: Ally) {
	drawVigilante(ctx, a);
}

function drawDeadAlly(ctx: CanvasRenderingContext2D, a: Ally) {
	const r = ALLY_RADIUS;
	ctx.save();
	ctx.translate(a.pos.x, a.pos.y);
	ctx.rotate(a.angle);
	const tw = r * 0.52;
	const th = r * 0.48;
	ctx.beginPath();
	ctx.ellipse(0, 0, tw * 0.9, th * 0.85, 0.2, 0, Math.PI * 2);
	ctx.fillStyle = createBlobGradient(
		ctx,
		0,
		0,
		tw,
		th,
		"rgba(90,100,120,0.85)",
		"rgba(40,48,60,0.9)",
		"rgba(0,0,0,0.5)",
	);
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = BRAWL_OUTW;
	ctx.stroke();
	for (const s of [1, -1] as const) {
		ctx.beginPath();
		ctx.ellipse(0, s * r * 0.3, r * 0.2, r * 0.1, 0, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(50,50,60,0.4)";
		ctx.fill();
	}
	const ox = r * 0.35;
	const oy = 0;
	ctx.beginPath();
	ctx.ellipse(ox, oy, r * 0.22, r * 0.2, 0, 0, Math.PI * 2);
	ctx.fillStyle = "rgba(60, 58, 65, 0.45)";
	ctx.fill();
	const cr = -r * 0.55;
	const cyy = 0.15 * r;
	ctx.beginPath();
	ctx.ellipse(cr, cyy, r * 0.4, r * 0.22, 0.1, 0, Math.PI * 2);
	ctx.fillStyle = createBlobGradient(
		ctx,
		cr,
		cyy,
		r * 0.4,
		r * 0.22,
		"#ff4040",
		"#a81010",
		"rgba(0,0,0,0.45)",
	);
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = BRAWL_OUTW;
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(cr - r * 0.35, cyy);
	ctx.lineTo(cr + r * 0.2, cyy - r * 0.1);
	ctx.strokeStyle = "rgba(0,0,0,0.3)";
	ctx.lineWidth = 0.5;
	ctx.stroke();
	ctx.restore();
}

function drawZombie(ctx: CanvasRenderingContext2D, z: Zombie) {
	const enemyImg = getActiveTheme()?.enemy;
	if (enemyImg?.complete && enemyImg.naturalWidth > 0) {
		const sm = z.type === "brute" ? 1.15 : z.type === "runner" ? 0.9 : 1;
		const angle = Math.atan2(z.vel.y, z.vel.x);
		drawSprite(ctx, enemyImg, z.pos, angle, z.radius * sm, z.hitFlash);
		if (z.type === "brute") {
			ctx.save();
			ctx.translate(z.pos.x, z.pos.y);
			ctx.strokeStyle = "rgba(255,200,80,0.75)";
			ctx.lineWidth = 2.5;
			ctx.setLineDash([5, 4]);
			ctx.beginPath();
			ctx.arc(0, 0, z.radius * 1.18, 0, Math.PI * 2);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.restore();
		}
		return;
	}
	ctx.save();
	ctx.translate(z.pos.x, z.pos.y);
	ctx.beginPath();
	ctx.ellipse(
		0,
		z.radius * 0.7,
		z.radius * 0.85,
		z.radius * 0.35,
		0,
		0,
		Math.PI * 2,
	);
	const zs = ctx.createRadialGradient(
		0,
		z.radius * 0.6,
		0,
		0,
		z.radius * 0.7,
		z.radius,
	);
	zs.addColorStop(0, "rgba(0,0,0,0.5)");
	zs.addColorStop(1, "rgba(0,0,0,0.1)");
	ctx.fillStyle = zs;
	ctx.fill();

	const angle = Math.atan2(z.vel.y, z.vel.x);
	ctx.rotate(angle);

	const sm = z.type === "brute" ? 1.15 : z.type === "runner" ? 0.9 : 1;
	const suit =
		z.type === "brute"
			? { main: "#0d3a7a", light: "#2a5ab8" }
			: z.type === "runner"
				? { main: "#1050a0", light: "#3a7ee0" }
				: { main: "#1248a0", light: "#3888e8" };
	const puffy = z.radius * 0.9 * sm;
	const sLight = suit.light;
	const tw = puffy * 0.5;
	const th = puffy * 0.46;
	ctx.beginPath();
	ctx.ellipse(0, 0, tw, th, 0, 0, Math.PI * 2);
	ctx.fillStyle = createBlobGradient(
		ctx,
		0,
		0,
		tw,
		th,
		sLight,
		suit.main,
		"rgba(0,0,0,0.4)",
	);
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = BRAWL_OUTW;
	ctx.stroke();
	const sg = ctx.createLinearGradient(0, -puffy * 0.2, 0, puffy * 0.3);
	sg.addColorStop(0, "#4080e0");
	sg.addColorStop(0.5, "#2050a0");
	sg.addColorStop(1, "#102860");
	ctx.fillStyle = sg;
	ctx.beginPath();
	ctx.moveTo(0, -puffy * 0.1);
	ctx.lineTo(-puffy * 0.2, puffy * 0.22);
	ctx.lineTo(puffy * 0.2, puffy * 0.22);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 0.6;
	ctx.stroke();
	for (const dx of [-0.3, 0.24] as const) {
		for (const sy of [-1, 1] as const) {
			ctx.beginPath();
			ctx.ellipse(
				dx * puffy,
				sy * (th * 0.78),
				puffy * 0.08,
				puffy * 0.1,
				0,
				0,
				Math.PI * 2,
			);
			ctx.fillStyle = createBlobGradient(
				ctx,
				dx * puffy,
				sy * (th * 0.78),
				puffy * 0.08,
				puffy * 0.1,
				"#2a2a2a",
				suit.main,
				"rgba(0,0,0,0.35)",
			);
			ctx.fill();
			ctx.strokeStyle = BRAWL_OUT;
			ctx.lineWidth = 0.55;
			ctx.stroke();
		}
	}
	ctx.beginPath();
	ctx.moveTo(-tw * 0.8, 0.05 * puffy);
	ctx.quadraticCurveTo(-puffy * 0.7, puffy * 0.1, -puffy * 0.85, 0.18 * puffy);
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 1.1;
	ctx.lineCap = "round";
	ctx.stroke();
	const fcx = puffy * 0.4;
	const fcy = 0.01 * puffy;
	ctx.beginPath();
	ctx.ellipse(fcx, fcy, puffy * 0.2, puffy * 0.1, 0, 0, Math.PI * 2);
	ctx.fillStyle = createBlobGradient(
		ctx,
		fcx,
		fcy,
		puffy * 0.2,
		puffy * 0.1,
		"#d0a890",
		"#805858",
		"rgba(0,0,0,0.3)",
	);
	ctx.fill();
	ctx.stroke();
	for (const sign of [-1, 1] as const) {
		ctx.beginPath();
		ctx.ellipse(
			fcx * 0.4,
			fcy - sign * puffy * 0.2,
			puffy * 0.08,
			puffy * 0.22,
			sign * 0.15,
			0,
			Math.PI * 2,
		);
		ctx.fillStyle = createBlobGradient(
			ctx,
			fcx * 0.4,
			fcy,
			puffy * 0.08,
			puffy * 0.22,
			"#1a1a1a",
			"#0a0a0a",
			"rgba(0,0,0,0.4)",
		);
		ctx.fill();
		ctx.strokeStyle = BRAWL_OUT;
		ctx.lineWidth = 0.6;
		ctx.stroke();
	}
	for (const sy of [-1, 1] as const) {
		ctx.beginPath();
		ctx.arc(fcx, fcy + sy * (puffy * 0.03), 0.9, 0, Math.PI * 2);
		ctx.fillStyle = "#0a0a0a";
		ctx.fill();
	}
	ctx.beginPath();
	ctx.ellipse(
		fcx + puffy * 0.18,
		fcy,
		puffy * 0.07,
		puffy * 0.06,
		0,
		0,
		Math.PI * 2,
	);
	ctx.fillStyle = "rgba(24, 24, 28, 0.85)";
	ctx.fill();
	ctx.save();
	ctx.translate(puffy * 0.38, puffy * 0.08);
	ctx.rotate(0.04);
	drawHandgunTopDown(ctx, puffy * 0.88);
	ctx.restore();

	if (z.type === "brute") {
		ctx.strokeStyle = "rgba(255,200,80,0.75)";
		ctx.lineWidth = 2.5;
		ctx.setLineDash([5, 4]);
		ctx.beginPath();
		ctx.ellipse(0, 0, tw * 1.12, th * 1.1, 0, 0, Math.PI * 2);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	if (z.hitFlash > 0) {
		ctx.globalAlpha = clamp(z.hitFlash / 0.1, 0, 1) * 0.7;
		ctx.beginPath();
		ctx.ellipse(0, 0, tw * 1.1, th * 1.1, 0, 0, Math.PI * 2);
		ctx.fillStyle = "#ffffff";
		ctx.fill();
		ctx.globalAlpha = 1;
	}
	ctx.restore();
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
	const angle = Math.atan2(b.vel.y, b.vel.x);
	const isPl = b.team === "player";
	ctx.save();
	ctx.translate(b.pos.x, b.pos.y);
	ctx.rotate(angle);
	ctx.shadowColor = isPl
		? "rgba(255, 220, 80, 0.9)"
		: "rgba(140, 200, 255, 0.9)";
	ctx.shadowBlur = 8;
	const bg = ctx.createLinearGradient(-6, -1.5, 6, 1.5);
	if (isPl) {
		bg.addColorStop(0, "rgba(255,255,255,0.95)");
		bg.addColorStop(0.4, "#ffe26a");
		bg.addColorStop(0.7, "#c9a020");
		bg.addColorStop(1, "rgba(80,50,0,0.6)");
	} else {
		bg.addColorStop(0, "rgba(255,255,255,0.9)");
		bg.addColorStop(0.45, "#a8d8ff");
		bg.addColorStop(0.75, "#4a8ec8");
		bg.addColorStop(1, "rgba(20,30,60,0.55)");
	}
	ctx.fillStyle = bg;
	ctx.fillRect(-6, -1.5, 12, 3);
	ctx.strokeStyle = BRAWL_OUT;
	ctx.lineWidth = 1.2;
	ctx.strokeRect(-6.5, -2, 13, 4);
	ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
	const a = clamp(p.life / p.maxLife, 0, 1);
	ctx.globalAlpha = a;
	ctx.fillStyle = p.color;
	ctx.beginPath();
	ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = 1;
}

function drawHpBar(
	ctx: CanvasRenderingContext2D,
	pos: Vec,
	hp: number,
	maxHp: number,
	yOffset: number,
	width: number,
	height: number,
	color: string,
) {
	const frac = clamp(hp / maxHp, 0, 1);
	const cy = pos.y - yOffset + height / 2;
	const x0 = pos.x - width / 2;
	const x1 = pos.x + width / 2;
	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.beginPath();
	ctx.lineWidth = height + 4;
	ctx.strokeStyle = "#f4c84a";
	ctx.moveTo(x0, cy);
	ctx.lineTo(x1, cy);
	ctx.stroke();
	ctx.beginPath();
	ctx.lineWidth = height;
	ctx.strokeStyle = "#0c1a36";
	ctx.moveTo(x0, cy);
	ctx.lineTo(x1, cy);
	ctx.stroke();
	if (frac > 0.001) {
		const xm = x0 + (x1 - x0) * frac;
		const grd = ctx.createLinearGradient(x0, cy, xm, cy);
		grd.addColorStop(0, color);
		grd.addColorStop(1, "rgba(255,255,255,0.25)");
		ctx.beginPath();
		ctx.lineWidth = height - 2;
		ctx.strokeStyle = grd;
		ctx.moveTo(x0, cy);
		ctx.lineTo(xm, cy);
		ctx.stroke();
	}
	ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D) {
	const grad = ctx.createRadialGradient(
		ARENA_W / 2,
		ARENA_H / 2,
		ARENA_H * 0.4,
		ARENA_W / 2,
		ARENA_H / 2,
		Math.max(ARENA_W, ARENA_H) * 0.75,
	);
	grad.addColorStop(0, "rgba(0,0,0,0)");
	grad.addColorStop(1, "rgba(0,40,80,0.06)");
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, ARENA_W, ARENA_H);
}

function drawBanner(
	ctx: CanvasRenderingContext2D,
	text: string,
	time: number,
	maxTime: number,
) {
	const t = clamp(time / maxTime, 0, 1);
	const fade = t > 0.7 ? (1 - t) / 0.3 : t < 0.2 ? t / 0.2 : 1;
	ctx.globalAlpha = clamp(fade, 0, 1);
	const bw = Math.min(520, ARENA_W - 48);
	const bh = 108;
	const bx = (ARENA_W - bw) / 2;
	const by = ARENA_H / 2 - bh / 2;
	const panel = ctx.createLinearGradient(bx, by, bx, by + bh);
	panel.addColorStop(0, "rgba(40,100,200,0.88)");
	panel.addColorStop(0.5, "rgba(25,70,180,0.9)");
	panel.addColorStop(1, "rgba(15,40,120,0.92)");
	ctx.fillStyle = panel;
	ctx.beginPath();
	ctx.moveTo(bx + 18, by);
	ctx.lineTo(bx + bw - 18, by);
	ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 18);
	ctx.lineTo(bx + bw, by + bh - 18);
	ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 18, by + bh);
	ctx.lineTo(bx + 18, by + bh);
	ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 18);
	ctx.lineTo(bx, by + 18);
	ctx.quadraticCurveTo(bx, by, bx + 18, by);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = "#f6d86a";
	ctx.lineWidth = 5;
	ctx.stroke();
	ctx.font = BR_FONT;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	const tx = ARENA_W / 2;
	const ty = ARENA_H / 2 + 3;
	for (let i = 6; i >= 1; i -= 1) {
		ctx.strokeStyle = i % 2 === 0 ? "#0a1c40" : "#102850";
		ctx.lineWidth = i;
		ctx.strokeText(text, tx, ty);
	}
	const txtGrad = ctx.createLinearGradient(0, ty - 28, 0, ty + 28);
	txtGrad.addColorStop(0, "#fff8c0");
	txtGrad.addColorStop(0.5, "#ffd030");
	txtGrad.addColorStop(1, "#e09000");
	ctx.fillStyle = txtGrad;
	ctx.fillText(text, tx, ty);
	ctx.globalAlpha = 1;
}

function drawCrosshair(ctx: CanvasRenderingContext2D, mouse: Vec) {
	ctx.save();
	ctx.translate(mouse.x, mouse.y);
	const ray = (x0: number, y0: number, x1: number, y1: number) => {
		ctx.beginPath();
		ctx.strokeStyle = "rgba(0,0,0,0.5)";
		ctx.lineWidth = 3;
		ctx.moveTo(x0, y0);
		ctx.lineTo(x1, y1);
		ctx.stroke();
		ctx.beginPath();
		ctx.strokeStyle = "#7ee8ff";
		ctx.lineWidth = 1.5;
		ctx.moveTo(x0, y0);
		ctx.lineTo(x1, y1);
		ctx.stroke();
	};
	ray(-22, 0, -9, 0);
	ray(9, 0, 22, 0);
	ray(0, -22, 0, -9);
	ray(0, 9, 0, 22);
	ctx.beginPath();
	ctx.arc(0, 0, 4, 0, Math.PI * 2);
	ctx.fillStyle = "#b8f4ff";
	ctx.fill();
	ctx.strokeStyle = "rgba(0,0,0,0.45)";
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.restore();
}
