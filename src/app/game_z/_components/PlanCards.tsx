"use client";

import type { EditPlan, EditPlanMood } from "./types";

type Props = {
	plan: EditPlan | null;
};

const moodTheme: Record<
	EditPlanMood,
	{ label: string; gradient: string; ring: string }
> = {
	hype: {
		label: "HYPE",
		gradient: "from-orange-400 via-fuchsia-400 to-yellow-300",
		ring: "ring-orange-400/40",
	},
	menacing: {
		label: "MENACING",
		gradient: "from-red-500 via-purple-500 to-slate-300",
		ring: "ring-red-500/40",
	},
	cocky: {
		label: "COCKY",
		gradient: "from-cyan-300 via-violet-400 to-pink-300",
		ring: "ring-cyan-400/40",
	},
	comeback: {
		label: "COMEBACK",
		gradient: "from-emerald-300 via-cyan-300 to-sky-400",
		ring: "ring-emerald-400/40",
	},
};

const transitionLabel: Record<
	NonNullable<EditPlan["shots"][number]["transition"]>,
	string
> = {
	cut: "Hard cut",
	whip: "Whip pan",
	flash: "Flash frame",
	glitch: "Glitch",
};

export function PlanCards({ plan }: Props) {
	const empty = !plan;
	const mood = plan ? moodTheme[plan.mood] : moodTheme.cocky;

	return (
		<section className="relative">
			<div className="mb-6 flex items-end justify-between">
				<div>
					<div className="font-mono text-[10px] text-white/40 uppercase tracking-[.3em]">
						04 / decision-log
					</div>
					<h2 className="mt-2 font-semibold text-2xl text-white tracking-tight md:text-3xl">
						AI editor decisions
					</h2>
					<p className="mt-1 max-w-lg text-sm text-white/50">
						Every choice the model made, parsed straight from the EditPlan it
						shipped back. No hidden prompts.
					</p>
				</div>
				{plan && (
					<div className="hidden items-center gap-2 font-mono text-[10px] text-white/40 uppercase tracking-[.25em] md:flex">
						<div className="h-[6px] w-[6px] animate-pulse rounded-full bg-emerald-400" />
						{plan.shots.length} shots queued
					</div>
				)}
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-12">
				{/* Mood */}
				<Card className="md:col-span-4">
					<Eyebrow>mood</Eyebrow>
					<div className="mt-4">
						{empty ? (
							<Skeleton className="h-9 w-32" />
						) : (
							<div
								className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${mood.gradient} px-3 py-1.5 ring-1 ${mood.ring}`}
							>
								<div className="h-1.5 w-1.5 rounded-full bg-black/70" />
								<span className="font-bold text-[11px] text-black tracking-[.2em]">
									{mood.label}
								</span>
							</div>
						)}
					</div>
					<p className="mt-3 text-sm text-white/45">
						Determines color grade, music tempo, and caption style across the
						whole edit.
					</p>
				</Card>

				{/* Audio */}
				<Card className="md:col-span-4">
					<Eyebrow>audio</Eyebrow>
					<div className="mt-4 flex items-center gap-3">
						<div className="flex h-10 items-end gap-[3px]">
							{[7, 13, 9, 16, 11, 18, 8, 14, 10].map((h, i) => (
								<div
									className="w-[3px] rounded-full bg-gradient-to-t from-violet-400/40 to-cyan-300"
									// biome-ignore lint/suspicious/noArrayIndexKey: visual only
									key={i}
									style={{
										height: `${h * 1.6}px`,
										animation: empty
											? undefined
											: `bar-pulse ${0.6 + i * 0.07}s ease-in-out infinite alternate`,
									}}
								/>
							))}
						</div>
						<div className="min-w-0 flex-1">
							{empty ? (
								<Skeleton className="h-4 w-full" />
							) : (
								<div className="truncate font-medium text-sm text-white">
									{plan.audio}
								</div>
							)}
							<div className="mt-1 font-mono text-[10px] text-white/35 uppercase tracking-wider">
								track · selected
							</div>
						</div>
					</div>
				</Card>

				{/* Hook */}
				<Card className="md:col-span-4">
					<Eyebrow>hook</Eyebrow>
					<div className="mt-3">
						{empty ? (
							<Skeleton className="h-12 w-full" />
						) : (
							<div className="font-semibold text-[15px] text-white leading-snug">
								"{plan.hook}"
							</div>
						)}
					</div>
					<p className="mt-3 text-sm text-white/45">
						First two seconds. Decides if a viewer scrolls.
					</p>
				</Card>

				{/* Shots — span full */}
				<Card className="md:col-span-12">
					<div className="mb-4 flex items-end justify-between">
						<Eyebrow>shot list</Eyebrow>
						<span className="font-mono text-[10px] text-white/35 uppercase tracking-wider">
							{plan ? `${plan.shots.length} entries` : "—"}
						</span>
					</div>
					{empty && (
						<div className="space-y-2">
							{[0, 1, 2].map((i) => (
								<Skeleton className="h-14 w-full" key={i} />
							))}
						</div>
					)}
					{plan && (
						<ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
							{plan.shots.map((shot, i) => (
								<li
									className="group relative flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-violet-400/30 hover:bg-white/[0.04]"
									// biome-ignore lint/suspicious/noArrayIndexKey: index is stable
									key={i}
								>
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/30 to-cyan-400/20 font-mono text-[11px] text-white/80 ring-1 ring-white/10">
										{String(i + 1).padStart(2, "0")}
									</div>
									<div className="min-w-0 flex-1">
										<div className="line-clamp-2 font-medium text-[13px] text-white leading-snug">
											{shot.caption}
										</div>
										<div className="mt-2 flex flex-wrap items-center gap-1.5">
											<Pill>event #{shot.eventIndex}</Pill>
											<Pill>{shot.lengthMs}ms</Pill>
											<Pill accent>
												{shot.transition
													? transitionLabel[shot.transition]
													: "Hard cut"}
											</Pill>
										</div>
									</div>
								</li>
							))}
						</ol>
					)}
				</Card>

				{/* Outro */}
				<Card className="md:col-span-12">
					<Eyebrow>outro</Eyebrow>
					<div className="mt-3">
						{empty ? (
							<Skeleton className="h-6 w-2/3" />
						) : (
							<div className="text-base text-white/85 italic">
								"{plan.outro}"
							</div>
						)}
					</div>
				</Card>
			</div>

			<style>{`
				@keyframes bar-pulse {
					from { transform: scaleY(.55); }
					to   { transform: scaleY(1); }
				}
			`}</style>
		</section>
	);
}

function Card({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 backdrop-blur-sm ${className}`}
			style={{
				boxShadow:
					"inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px -12px rgba(0,0,0,.6)",
			}}
		>
			{children}
		</div>
	);
}

function Eyebrow({ children }: { children: React.ReactNode }) {
	return (
		<div className="font-mono text-[10px] text-white/35 uppercase tracking-[.3em]">
			{children}
		</div>
	);
}

function Pill({
	children,
	accent,
}: {
	children: React.ReactNode;
	accent?: boolean;
}) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider ${
				accent
					? "bg-violet-400/15 text-violet-200 ring-1 ring-violet-300/20"
					: "bg-white/[0.06] text-white/60 ring-1 ring-white/[0.08]"
			}`}
		>
			{children}
		</span>
	);
}

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded-md bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] ${className}`}
		/>
	);
}
