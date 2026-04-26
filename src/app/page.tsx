"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

const GAME_SLUG = "brown-stacks";

export default function Home() {
	return (
		<main className="min-h-screen bg-neutral-950 text-neutral-100">
			<Dashboard />
		</main>
	);
}

function Dashboard() {
	const [isAnalysing, setIsAnalysing] = useState(false);
	const [analyseError, setAnalyseError] = useState<string | null>(null);
	const [applyError, setApplyError] = useState<string | null>(null);
	const [applyNotice, setApplyNotice] = useState<string | null>(null);
	const [applyingSuggestionKey, setApplyingSuggestionKey] = useState<string | null>(null);

	const stats = api.dashboard.getStats.useQuery(
		{ gameSlug: GAME_SLUG },
		{ refetchInterval: 10_000 },
	);
	const sessions = api.dashboard.getRecentSessions.useQuery(
		{ gameSlug: GAME_SLUG },
		{ refetchInterval: 10_000 },
	);
	const analysis = api.dashboard.getLatestAnalysis.useQuery(
		{ gameSlug: GAME_SLUG },
		{ refetchInterval: 15_000 },
	);

	const runAnalysis = async () => {
		setIsAnalysing(true);
		setAnalyseError(null);
		try {
			const res = await fetch("/api/balance", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ gameSlug: GAME_SLUG }),
			});
			const data = (await res.json()) as { error?: string };
			if (!res.ok) throw new Error(data.error ?? "Analysis failed");
			await analysis.refetch();
		} catch (e) {
			setAnalyseError(e instanceof Error ? e.message : "Unknown error");
		} finally {
			setIsAnalysing(false);
		}
	};

	const applySuggestion = async (param: string, suggested: number | string, key: string) => {
		setApplyingSuggestionKey(key);
		setApplyError(null);
		setApplyNotice(null);
		try {
			const res = await fetch("/api/apply-suggestion", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					gameSlug: GAME_SLUG,
					param,
					suggested,
				}),
			});
			const data = (await res.json()) as { error?: string; updatedConstant?: string; updatedValue?: number };
			if (!res.ok) throw new Error(data.error ?? "Failed to apply suggestion");
			setApplyNotice(
				`Applied ${param} -> ${String(suggested)} (updated ${data.updatedConstant ?? "constant"}).`,
			);
		} catch (e) {
			setApplyError(e instanceof Error ? e.message : "Unknown error while applying suggestion");
		} finally {
			setApplyingSuggestionKey(null);
		}
	};

	const s = stats.data;

	const waveDistEntries = s?.waveDist
		? Object.entries(s.waveDist)
				.map(([wave, count]) => ({ wave: Number(wave), count: Number(count) }))
				.sort((a, b) => a.wave - b.wave)
		: [];
	const maxCount = waveDistEntries.reduce((m, e) => Math.max(m, e.count), 1);

	return (
		<div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
			{/* Header */}
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Brown Stacks</h1>
					<p className="text-neutral-400 mt-1 text-sm">
						Wave-based arena shooter · AI balancing dashboard
					</p>
				</div>
				<Link
					href="/brown-stacks"
					className="rounded-lg bg-emerald-600 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-500 transition"
				>
					▶ Play Game
				</Link>
			</div>

			{/* Stat cards */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatCard label="Total Sessions" value={s?.totalSessions ?? 0} />
				<StatCard label="Avg Wave Reached" value={s ? s.avgWave.toFixed(1) : "—"} />
				<StatCard label="Avg Kills" value={s ? s.avgKills.toFixed(1) : "—"} />
				<StatCard label="Avg Session" value={s ? `${Math.round(s.avgDuration)}s` : "—"} />
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{/* Wave distribution */}
				<section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
					<h2 className="font-semibold text-neutral-200 mb-4">Where Players Die</h2>
					{waveDistEntries.length === 0 ? (
						<p className="text-neutral-500 text-sm">No sessions recorded yet — play a game!</p>
					) : (
						<div className="space-y-2">
							{waveDistEntries.map(({ wave, count }) => (
								<div key={wave} className="flex items-center gap-3 text-sm">
									<span className="w-16 text-neutral-400 shrink-0">Wave {wave}</span>
									<div className="flex-1 bg-neutral-800 rounded-full h-5 overflow-hidden">
										<div
											className="h-full rounded-full transition-all bg-gradient-to-r from-red-600 to-orange-500"
											style={{ width: `${(count / maxCount) * 100}%` }}
										/>
									</div>
									<span className="w-8 text-right text-neutral-300 tabular-nums">{count}</span>
								</div>
							))}
						</div>
					)}
				</section>

				{/* Recent sessions */}
				<section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
					<h2 className="font-semibold text-neutral-200 mb-4">Recent Sessions</h2>
					{!sessions.data?.length ? (
						<p className="text-neutral-500 text-sm">No sessions yet.</p>
					) : (
						<table className="w-full text-sm">
							<thead>
								<tr className="text-neutral-500 text-left border-b border-neutral-800">
									<th className="pb-2 font-medium">Wave</th>
									<th className="pb-2 font-medium">Kills</th>
									<th className="pb-2 font-medium">Duration</th>
									<th className="pb-2 font-medium text-right">Time</th>
								</tr>
							</thead>
							<tbody>
								{sessions.data.map((s) => (
									<tr key={s.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
										<td className="py-1.5 font-semibold text-white">{s.waveReached}</td>
										<td className="py-1.5 text-neutral-300">{s.kills}</td>
										<td className="py-1.5 text-neutral-300">{s.durationSeconds}s</td>
										<td className="py-1.5 text-neutral-500 text-right">
											{s.createdAt ? new Date(s.createdAt).toLocaleTimeString() : "—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</section>
			</div>

			{/* AI Analysis */}
			<section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
				<div className="flex items-center justify-between mb-5">
					<div>
						<h2 className="font-semibold text-neutral-200">AI Balancing Analysis</h2>
						{analysis.data?.createdAt && (
							<p className="text-neutral-500 text-xs mt-0.5">
								Last run: {new Date(analysis.data.createdAt).toLocaleString()}
							</p>
						)}
					</div>
					<button
						type="button"
						onClick={runAnalysis}
						disabled={isAnalysing || (s?.totalSessions ?? 0) === 0}
						className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
					>
						{isAnalysing ? "Analysing…" : "Run Analysis"}
					</button>
				</div>

				{analyseError && (
					<div className="mb-4 rounded-lg bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
						{analyseError}
					</div>
				)}
				{applyError && (
					<div className="mb-4 rounded-lg bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
						{applyError}
					</div>
				)}
				{applyNotice && (
					<div className="mb-4 rounded-lg bg-emerald-950 border border-emerald-800 px-4 py-3 text-sm text-emerald-300">
						{applyNotice}
					</div>
				)}

				{!analysis.data ? (
					<p className="text-neutral-500 text-sm">
						{(s?.totalSessions ?? 0) === 0
							? "Play some games first, then run an analysis."
							: "Click 'Run Analysis' to get AI-powered balance suggestions."}
					</p>
				) : (
					<div className="space-y-6">
						{/* Summary */}
						<p className="text-neutral-300 text-sm leading-relaxed">{analysis.data.summary}</p>

						<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
							{/* Problems */}
							{analysis.data.data.problems?.length > 0 && (
								<div>
									<h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Problems</h3>
									<ul className="space-y-2">
										{analysis.data.data.problems.map((p, i) => (
											<li key={i} className="flex gap-2 text-sm text-neutral-300">
												<span className="text-red-400 mt-0.5">●</span>
												{p}
											</li>
										))}
									</ul>
								</div>
							)}

							{/* Early game */}
							{analysis.data.data.earlyGame && (
								<div>
									<h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
										Early Game (Wave 1–3)
									</h3>
									<p className="text-sm text-neutral-300 leading-relaxed">{analysis.data.data.earlyGame}</p>
								</div>
							)}
						</div>

						{/* Suggestions */}
						{analysis.data.data.suggestions?.length > 0 && (
							<div>
								<div className="flex items-center justify-between mb-3">
									<h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Suggested Tweaks</h3>
									{analysis.data.data.estimatedRetentionGain && (
										<span className="rounded-full bg-emerald-900 px-3 py-0.5 text-xs font-semibold text-emerald-300">
											Est. {analysis.data.data.estimatedRetentionGain} retention
										</span>
									)}
								</div>
								<div className="space-y-3">
									{analysis.data.data.suggestions.map((s, i) => {
										const key = `${s.param}-${i}`;
										const isApplying = applyingSuggestionKey === key;
										return (
										<div key={i} className="rounded-lg bg-neutral-800 p-4">
											<div className="flex items-start justify-between gap-4">
												<div>
													<div className="flex items-center gap-2 mb-1">
														<code className="text-violet-300 text-sm font-mono font-bold">{s.param}</code>
														<span className="text-neutral-500 text-sm">{s.current} → <span className="text-white font-semibold">{s.suggested}</span></span>
													</div>
													<p className="text-neutral-400 text-sm">{s.reason}</p>
												</div>
												<div className="flex flex-col items-end gap-2">
													<span className="shrink-0 rounded-full bg-emerald-900/60 px-2 py-0.5 text-xs text-emerald-300 whitespace-nowrap">{s.impact}</span>
													<button
														type="button"
														onClick={() => applySuggestion(s.param, s.suggested, key)}
														disabled={isApplying}
														className="rounded-md border border-violet-600/60 bg-violet-900/30 px-2.5 py-1 text-xs font-semibold text-violet-200 hover:bg-violet-900/50 disabled:opacity-50"
													>
														{isApplying ? "Applying..." : "Apply"}
													</button>
												</div>
											</div>
										</div>
									);
									})}
								</div>
							</div>
						)}
					</div>
				)}
			</section>
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
			<p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">{label}</p>
			<p className="text-2xl font-bold text-white tabular-nums">{value}</p>
		</div>
	);
}
