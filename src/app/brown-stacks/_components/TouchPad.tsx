"use client";

import { type PointerEvent, useEffect, useRef, useState } from "react";

/**
 * Twin-stick touch overlay.
 * - Touch on the LEFT half drives movement keys (W/A/S/D simulated).
 * - Touch on the RIGHT half sets aim direction + shooting.
 *
 * The widget is invisible until the first touch — then a base + thumb
 * appear at the touch origin. Multi-touch supported via PointerEvents.
 *
 * Caller hands us imperative setters for keys, mouse aim, and shooting flag.
 * Aim is expressed as { dx, dy } unit vector (range -1..1) and the consumer
 * remaps it to arena-space mouse coords using the player's position.
 */
export type TouchPadCallbacks = {
	setKeys: (keys: Set<string>) => void; // movement keys to add (others removed)
	setAim: (dir: { dx: number; dy: number; firing: boolean } | null) => void;
};

type Stick = {
	id: number;
	ox: number;
	oy: number;
	x: number;
	y: number;
};

const RADIUS = 64; // max stick travel in px
const DEAD_ZONE = 8;

export function TouchPad({ setKeys, setAim }: TouchPadCallbacks) {
	const [leftStick, setLeftStick] = useState<Stick | null>(null);
	const [rightStick, setRightStick] = useState<Stick | null>(null);
	const rootRef = useRef<HTMLDivElement | null>(null);

	// Convert left stick offset → directional keys. WASD-equivalent.
	useEffect(() => {
		const set = new Set<string>();
		if (leftStick) {
			const dx = leftStick.x - leftStick.ox;
			const dy = leftStick.y - leftStick.oy;
			const m = Math.hypot(dx, dy);
			if (m > DEAD_ZONE) {
				const ux = dx / m;
				const uy = dy / m;
				if (ux > 0.4) set.add("d");
				if (ux < -0.4) set.add("a");
				if (uy > 0.4) set.add("s");
				if (uy < -0.4) set.add("w");
			}
		}
		setKeys(set);
	}, [leftStick, setKeys]);

	// Convert right stick offset → aim + firing flag.
	useEffect(() => {
		if (!rightStick) {
			setAim(null);
			return;
		}
		const dx = rightStick.x - rightStick.ox;
		const dy = rightStick.y - rightStick.oy;
		const m = Math.hypot(dx, dy);
		if (m < DEAD_ZONE) {
			setAim({ dx: 0, dy: 0, firing: false });
			return;
		}
		const ux = dx / m;
		const uy = dy / m;
		setAim({ dx: ux, dy: uy, firing: true });
	}, [rightStick, setAim]);

	const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
		const root = rootRef.current;
		if (!root) return;
		const rect = root.getBoundingClientRect();
		const halfX = rect.left + rect.width / 2;
		const stick: Stick = {
			id: e.pointerId,
			ox: e.clientX,
			oy: e.clientY,
			x: e.clientX,
			y: e.clientY,
		};
		if (e.clientX < halfX) {
			if (leftStick) return;
			setLeftStick(stick);
		} else {
			if (rightStick) return;
			setRightStick(stick);
		}
		(e.target as Element).setPointerCapture?.(e.pointerId);
	};

	const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
		if (leftStick && e.pointerId === leftStick.id) {
			setLeftStick({ ...leftStick, x: e.clientX, y: e.clientY });
		} else if (rightStick && e.pointerId === rightStick.id) {
			setRightStick({ ...rightStick, x: e.clientX, y: e.clientY });
		}
	};

	const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
		if (leftStick && e.pointerId === leftStick.id) setLeftStick(null);
		if (rightStick && e.pointerId === rightStick.id) setRightStick(null);
	};

	return (
		<div
			ref={rootRef}
			className="absolute inset-0 z-30"
			style={{ touchAction: "none" }}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
		>
			{leftStick && <StickGlyph stick={leftStick} accent="#22d3ee" />}
			{rightStick && <StickGlyph stick={rightStick} accent="#FF0040" />}
		</div>
	);
}

function StickGlyph({ stick, accent }: { stick: Stick; accent: string }) {
	const dx = stick.x - stick.ox;
	const dy = stick.y - stick.oy;
	const m = Math.hypot(dx, dy);
	const clamped = m > RADIUS ? RADIUS / m : 1;
	const tx = dx * clamped;
	const ty = dy * clamped;
	return (
		<>
			{/* Base */}
			<div
				style={{
					position: "fixed",
					left: stick.ox - RADIUS,
					top: stick.oy - RADIUS,
					width: RADIUS * 2,
					height: RADIUS * 2,
					borderRadius: "50%",
					border: `2px solid ${accent}66`,
					background: `radial-gradient(circle at center, ${accent}10 0%, transparent 70%)`,
					boxShadow: `0 0 24px ${accent}40`,
					pointerEvents: "none",
				}}
			/>
			{/* Thumb */}
			<div
				style={{
					position: "fixed",
					left: stick.ox - 24 + tx,
					top: stick.oy - 24 + ty,
					width: 48,
					height: 48,
					borderRadius: "50%",
					background: accent,
					boxShadow: `0 0 32px ${accent}aa`,
					pointerEvents: "none",
				}}
			/>
		</>
	);
}
