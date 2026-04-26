import type { EditPlan } from "~/lib/ai-editor/types";
import type { ViralMoment } from "~/lib/ai-editor/viral";

export function StatPill({
	emoji,
	label,
	value,
}: {
	emoji: string;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-center gap-1.5 rounded-full border-2 border-[#f0c84a] bg-gradient-to-b from-[#4a9ef8] to-[#1a58c4] px-2.5 py-1.5 pl-1.5 font-extrabold text-white text-xs shadow-[0_3px_0_#0c2a55] sm:gap-2 sm:px-3.5 sm:py-2 sm:text-sm">
			<span
				aria-hidden
				className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0c2a55] bg-gradient-to-b from-white/25 to-white/5 text-base sm:h-8 sm:w-8"
			>
				{emoji}
			</span>
			<span className="text-[#b8dfff] text-[10px] sm:text-xs">{label}</span>
			<span className="min-w-[1.5rem] text-right text-[#fff6a0] tabular-nums sm:min-w-[2rem]">
				{value}
			</span>
		</div>
	);
}

export function ThemeField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<label className="block">
			<span className="mb-0.5 block font-bold text-[#bfe4ff] text-[10px] uppercase tracking-wider">
				{label}
			</span>
			<textarea
				className="block w-full resize-none rounded-md border border-[#143252] bg-[#06192e] px-2 py-1.5 font-medium text-[12px] text-white outline-none placeholder:text-[#6a8cb0] focus:border-[#5aa8ff]"
				maxLength={500}
				onChange={(e) => onChange(e.target.value)}
				rows={2}
				value={value}
			/>
		</label>
	);
}

export function HelpRow({ k, d }: { k: string; d: string }) {
	return (
		<div className="flex items-baseline justify-between gap-2 rounded-lg border border-white/10 bg-[#0a2a50]/50 px-2 py-1.5 sm:px-3">
			<span className="shrink-0 text-[#ffe066] text-xs tracking-wide sm:text-sm">
				{k}
			</span>
			<span className="text-[#8ec0f0] text-xs sm:text-sm">{d}</span>
		</div>
	);
}

export function Overlay({ children }: { children: React.ReactNode }) {
	return (
		<div className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-lg bg-black/75 px-4 py-6 backdrop-blur-sm">
			{children}
		</div>
	);
}

export function ViralVerdict({
	viralState,
	matchSummary,
	editState,
	videoState,
	onRequestEdit,
}: {
	viralState: { status: "idle" | "detecting" | "done"; moments: ViralMoment[] };
	matchSummary: { eventCount: number; snapshotCount: number; blobUrl: string | null };
	editState: { status: "idle" | "loading" | "done" | "error"; plan: EditPlan | null };
	videoState: {
		status: "idle" | "rendering" | "done" | "error";
		progress: number;
		blobUrl: string | null;
	};
	onRequestEdit: () => void;
}) {
	if (viralState.status === "detecting") {
		return (
			<div className="flex w-full items-center gap-3 rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-4">
				<div className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300" />
				<div className="flex-1 font-mono text-[11px]">
					<div className="text-amber-300 uppercase tracking-[.18em]">
						ml viral classifier
					</div>
					<div className="mt-1 text-neutral-400">
						scoring {matchSummary.eventCount} events against{" "}
						{matchSummary.snapshotCount} telemetry samples…
					</div>
				</div>
			</div>
		);
	}

	if (viralState.moments.length === 0) {
		return (
			<div className="flex w-full items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-4">
				<div className="h-2.5 w-2.5 rounded-full bg-neutral-500" />
				<div className="flex-1 font-mono text-[11px]">
					<div className="text-neutral-300 uppercase tracking-[.18em]">
						no viral moments detected
					</div>
					<div className="mt-1 text-neutral-500">
						Nothing in this match scored above the viral threshold. Try again
						— go for a clutch.
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
			{/* Detected viral moments */}
			<div className="overflow-hidden rounded-lg border border-emerald-700/60 bg-neutral-950">
				<div className="flex items-center justify-between border-emerald-800/50 border-b bg-emerald-950/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[.18em]">
					<span className="text-emerald-300">
						{viralState.moments.length} viral moment
						{viralState.moments.length === 1 ? "" : "s"}
					</span>
					<span className="text-neutral-400">classifier · llama-3.3-70b</span>
				</div>
				<div className="space-y-2 px-3 py-3">
					{viralState.moments.map((m) => (
						<div
							className="rounded bg-neutral-900 px-3 py-2 font-mono text-[11px]"
							key={m.eventIndex}
						>
							<div className="flex items-center justify-between gap-2">
								<span className="font-bold text-amber-300">{m.label}</span>
								<span className="text-emerald-300">{m.score}/100</span>
							</div>
							<div className="mt-1 text-neutral-400">{m.reason}</div>
						</div>
					))}
					{matchSummary.blobUrl && (
						<a
							className="mt-1 block rounded bg-neutral-900 px-3 py-2 text-center text-[10px] text-neutral-300 uppercase tracking-wider transition hover:bg-neutral-800"
							download="brrawl-match.webm"
							href={matchSummary.blobUrl}
						>
							download raw match webm
						</a>
					)}
					{editState.status === "idle" && (
						<button
							className="w-full rounded bg-amber-300 px-3 py-2 font-bold text-[12px] text-neutral-900 uppercase tracking-wider transition hover:bg-amber-200"
							onClick={onRequestEdit}
							type="button"
						>
							build the edit
						</button>
					)}
					{editState.status === "loading" && (
						<div className="rounded bg-neutral-900 px-3 py-2 text-center text-[10px] text-neutral-400 uppercase tracking-wider">
							asking model for plan…
						</div>
					)}
					{editState.status === "error" && (
						<div className="rounded bg-red-950/30 px-3 py-2 text-center text-[10px] text-red-300 uppercase tracking-wider">
							edit failed — see console
						</div>
					)}
					{videoState.status === "rendering" && (
						<div className="space-y-1.5 rounded bg-neutral-900 px-3 py-2">
							<div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
								<span className="text-neutral-400">rendering edit…</span>
								<span className="text-emerald-300">
									{Math.round(videoState.progress * 100)}%
								</span>
							</div>
							<div className="h-1 overflow-hidden rounded bg-neutral-800">
								<div
									className="h-full bg-amber-300 transition-[width] duration-200"
									style={{ width: `${videoState.progress * 100}%` }}
								/>
							</div>
						</div>
					)}
					{videoState.status === "error" && (
						<div className="rounded bg-red-950/30 px-3 py-2 text-center text-[10px] text-red-300 uppercase tracking-wider">
							render failed — see console
						</div>
					)}
				</div>
			</div>

			{/* Right column: rendered edit > edit plan > raw recording */}
			<div className="overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950">
				{videoState.status === "done" && videoState.blobUrl ? (
					<>
						<div className="flex items-center justify-between border-neutral-800 border-b bg-neutral-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[.18em]">
							<span className="text-amber-300">rendered edit</span>
							<span className="text-neutral-500">9:16 · webm</span>
						</div>
						<div className="flex w-full justify-center bg-black">
							<video
								autoPlay
								className="block max-h-[520px]"
								controls
								loop
								playsInline
								src={videoState.blobUrl}
							/>
						</div>
						<a
							className="block bg-amber-300 px-3 py-2 text-center font-bold text-[11px] text-neutral-900 uppercase tracking-wider transition hover:bg-amber-200"
							download="brrawl-edit.webm"
							href={videoState.blobUrl}
						>
							download edit .webm
						</a>
					</>
				) : editState.status === "done" && editState.plan ? (
					<>
						<div className="flex items-center justify-between border-neutral-800 border-b bg-neutral-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[.18em]">
							<span className="text-emerald-300">edit plan</span>
							<span className="text-neutral-500">
								{videoState.status === "rendering" ? "rendering…" : "ready"}
							</span>
						</div>
						<EditPlanCard plan={editState.plan} />
					</>
				) : (
					<>
						<div className="flex items-center justify-between border-neutral-800 border-b bg-neutral-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[.18em]">
							<span className="text-neutral-300">match recording</span>
							<span className="text-neutral-500">
								{matchSummary.blobUrl ? "captured" : "not captured"}
							</span>
						</div>
						{matchSummary.blobUrl ? (
							<video
								autoPlay
								className="block aspect-video w-full"
								loop
								muted
								playsInline
								src={matchSummary.blobUrl}
							/>
						) : (
							<div className="flex aspect-video w-full items-center justify-center text-neutral-500 text-xs">
								no recording captured
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

export function EditPlanCard({ plan }: { plan: EditPlan }) {
	return (
		<div className="space-y-3 px-4 py-4 font-mono text-[11px] text-neutral-200">
			<div className="grid grid-cols-2 gap-2">
				<div className="rounded bg-neutral-900 px-2 py-1.5">
					<div className="text-[9px] text-neutral-500 uppercase tracking-wider">
						mood
					</div>
					<div className="font-bold text-amber-300">{plan.mood}</div>
				</div>
				<div className="rounded bg-neutral-900 px-2 py-1.5">
					<div className="text-[9px] text-neutral-500 uppercase tracking-wider">
						audio
					</div>
					<div className="font-bold text-cyan-300">{plan.audio}</div>
				</div>
			</div>
			<div className="rounded bg-neutral-900 px-2 py-1.5">
				<div className="text-[9px] text-neutral-500 uppercase tracking-wider">
					hook
				</div>
				<div className="font-medium text-white">"{plan.hook}"</div>
			</div>
			<div className="space-y-1">
				<div className="text-[9px] text-neutral-500 uppercase tracking-wider">
					{plan.shots.length} shot{plan.shots.length === 1 ? "" : "s"}
				</div>
				{plan.shots.map((s, i) => (
					<div
						className="flex items-center gap-2 rounded bg-neutral-900 px-2 py-1.5"
						// biome-ignore lint/suspicious/noArrayIndexKey: stable order
						key={i}
					>
						<span className="text-neutral-500">#{i + 1}</span>
						<span className="flex-1 text-white">
							{s.caption.split(/\[([^\]]+)\]/g).map((part, j) =>
								j % 2 === 1 ? (
									// biome-ignore lint/suspicious/noArrayIndexKey: stable
									<span className="text-amber-300" key={j}>
										{part}
									</span>
								) : (
									// biome-ignore lint/suspicious/noArrayIndexKey: stable
									<span key={j}>{part}</span>
								),
							)}
						</span>
						<span className="text-[9px] text-neutral-500">
							{(s.lengthMs / 1000).toFixed(1)}s · {s.transition ?? "cut"}
						</span>
					</div>
				))}
			</div>
			<div className="rounded bg-neutral-900 px-2 py-1.5">
				<div className="text-[9px] text-neutral-500 uppercase tracking-wider">
					outro
				</div>
				<div className="font-medium text-white">"{plan.outro}"</div>
			</div>
		</div>
	);
}
