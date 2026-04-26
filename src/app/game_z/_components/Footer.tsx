"use client";

const stack = [
	"vanilla canvas",
	"PIXI",
	"Web Audio",
	"MediaRecorder",
	"zero servers",
];

export function Footer() {
	return (
		<footer className="border-white/[0.06] border-t pt-10">
			<div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
				<div className="flex items-center gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 ring-1 ring-white/20">
						<div className="h-2.5 w-2.5 rounded-sm bg-black/80" />
					</div>
					<div>
						<div className="font-semibold text-sm text-white">Brrawl Edits</div>
						<div className="font-mono text-[10px] text-white/40 uppercase tracking-[.2em]">
							runs entirely in your browser
						</div>
					</div>
				</div>
				<ul className="flex flex-wrap items-center gap-2">
					{stack.map((s) => (
						<li
							className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-white/65 tracking-wide"
							key={s}
						>
							<span className="h-1 w-1 rounded-full bg-emerald-300" />
							{s}
						</li>
					))}
				</ul>
			</div>
			<div className="mt-8 text-[11px] text-white/30">
				A hackathon demo · the entire pipeline ships zero bytes to a server.
			</div>
		</footer>
	);
}
