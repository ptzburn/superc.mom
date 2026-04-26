"use client";

const steps = [
	{
		n: 1,
		title: "Play a 90s match",
		body: "The game records canvas frames + audio in-browser. Every kill, dodge, and clutch becomes a structured event.",
		accent: "from-violet-400 to-fuchsia-400",
	},
	{
		n: 2,
		title: "AI watches the replay",
		body: "Events stream to /api/edit-plan. The model picks a mood, a hook line, the best shots, and a tempo to cut against.",
		accent: "from-cyan-300 to-violet-400",
	},
	{
		n: 3,
		title: "TikTok edit, ready",
		body: "Captions, transitions, audio bed. Render runs in the iframe via MediaRecorder. Drop the MP4 straight into your feed.",
		accent: "from-orange-300 to-pink-400",
	},
];

export function HowItWorks() {
	return (
		<section>
			<div className="mb-8 flex items-end justify-between">
				<div>
					<div className="font-mono text-[10px] text-white/40 uppercase tracking-[.3em]">
						05 / pipeline
					</div>
					<h2 className="mt-2 font-semibold text-2xl text-white tracking-tight md:text-3xl">
						How it works
					</h2>
				</div>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{steps.map((s, idx) => (
					<div
						className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-white/[0.005] p-6 transition hover:border-white/15"
						key={s.n}
						style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)" }}
					>
						{/* connector line */}
						{idx < steps.length - 1 && (
							<div
								aria-hidden
								className="absolute top-12 -right-3 hidden h-px w-6 bg-gradient-to-r from-white/20 to-transparent md:block"
							/>
						)}
						<div className="flex items-center gap-3">
							<div
								className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${s.accent} font-bold text-[15px] text-black ring-1 ring-white/30`}
								style={{ boxShadow: "0 8px 22px -6px rgba(167,139,250,.4)" }}
							>
								{s.n}
							</div>
							<div className="font-mono text-[10px] text-white/35 uppercase tracking-[.25em]">
								Step {s.n}
							</div>
						</div>
						<h3 className="mt-5 font-semibold text-lg text-white tracking-tight">
							{s.title}
						</h3>
						<p className="mt-2 text-sm text-white/55 leading-relaxed">
							{s.body}
						</p>
					</div>
				))}
			</div>
		</section>
	);
}
