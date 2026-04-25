"use client";

import { useEffect, useState } from "react";
import type { EditPlan } from "./types";

type Props = {
	plan: EditPlan | null;
	loading: boolean;
};

const SCRIPT = (plan: EditPlan | null) => {
	if (!plan) return [];
	return [
		"$ pnpm ai-editor --stream",
		"> parsing match telemetry...",
		"> running shot-selection model",
		`> mood       = "${plan.mood}"`,
		`> audio      = "${plan.audio}"`,
		`> hook       = "${plan.hook}"`,
		`> shots      = ${plan.shots.length} clips`,
		...plan.shots.flatMap((s, i) => [
			`>   [${String(i).padStart(2, "0")}] event=#${s.eventIndex} ${s.lengthMs}ms ${s.transition ?? "cut"}`,
			`>        "${s.caption}"`,
		]),
		`> outro      = "${plan.outro}"`,
		"> sealing edit-plan ✓",
	];
};

export function PlanStream({ plan, loading }: Props) {
	const lines = SCRIPT(plan);
	const [shown, setShown] = useState(0);

	useEffect(() => {
		if (!plan) {
			setShown(0);
			return;
		}
		setShown(0);
		const id = setInterval(() => {
			setShown((n) => {
				if (n >= lines.length) {
					clearInterval(id);
					return n;
				}
				return n + 1;
			});
		}, 90);
		return () => clearInterval(id);
	}, [plan, lines.length]);

	return (
		<div className="relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#08080c]/80 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] backdrop-blur">
			{/* terminal chrome */}
			<div className="flex items-center gap-2 border-white/5 border-b bg-white/[0.02] px-4 py-2.5">
				<div className="h-[10px] w-[10px] rounded-full bg-rose-400/70" />
				<div className="h-[10px] w-[10px] rounded-full bg-amber-300/70" />
				<div className="h-[10px] w-[10px] rounded-full bg-emerald-400/70" />
				<div className="ml-3 font-mono text-[10px] text-white/40 uppercase tracking-[.25em]">
					ai-editor :: stream
				</div>
				<div className="ml-auto flex items-center gap-1.5">
					<div
						className={`h-[6px] w-[6px] rounded-full ${
							loading
								? "animate-pulse bg-amber-300"
								: plan
									? "bg-emerald-400"
									: "bg-white/20"
						}`}
					/>
					<span className="font-mono text-[9px] text-white/40 uppercase tracking-wider">
						{loading ? "live" : plan ? "ready" : "idle"}
					</span>
				</div>
			</div>

			{/* body */}
			<div className="relative flex-1 overflow-y-auto p-5 font-mono text-[12px] leading-relaxed">
				{!plan && !loading && (
					<div className="text-white/30">
						{"// waiting for match..."}
						<br />
						{"// finish a round in the phone, the editor wakes up here."}
					</div>
				)}
				{loading && !plan && (
					<div className="text-cyan-300/70">
						<span>$ analyzing replay buffer</span>
						<span className="ml-1 inline-block w-[7px] animate-pulse bg-cyan-300/70 align-middle">
							{" "}
						</span>
					</div>
				)}
				{plan && (
					<div className="space-y-1">
						{lines.slice(0, shown).map((line, i) => (
							<div
								className={`opacity-0 ${colorize(line)}`}
								// biome-ignore lint/suspicious/noArrayIndexKey: stable per render
								key={`${i}-${line.slice(0, 12)}`}
								style={{
									animation: "plan-fade-in 240ms ease-out forwards",
								}}
							>
								{line}
							</div>
						))}
						{shown < lines.length && (
							<span className="ml-0.5 inline-block h-[14px] w-[7px] animate-pulse bg-violet-300/80 align-middle" />
						)}
					</div>
				)}
			</div>

			<style>{`
				@keyframes plan-fade-in {
					from { opacity: 0; transform: translateX(-4px); }
					to   { opacity: 1; transform: translateX(0); }
				}
			`}</style>
		</div>
	);
}

function colorize(line: string): string {
	if (line.startsWith("$")) return "text-cyan-300";
	if (line.includes("✓")) return "text-emerald-300";
	if (line.includes("=")) return "text-violet-200";
	if (line.startsWith(">  ")) return "text-white/60";
	if (line.startsWith(">")) return "text-orange-200/90";
	return "text-white/70";
}
