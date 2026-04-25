"use client";

import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
	dim?: boolean;
	haloMood?: "hype" | "menacing" | "cocky" | "comeback" | "idle";
};

const haloByMood: Record<NonNullable<Props["haloMood"]>, string> = {
	idle: "from-violet-500/40 via-cyan-400/30 to-orange-400/30",
	hype: "from-orange-500/60 via-fuchsia-500/40 to-yellow-300/40",
	menacing: "from-red-600/50 via-purple-700/40 to-slate-900/40",
	cocky: "from-cyan-400/60 via-violet-500/40 to-pink-400/40",
	comeback: "from-emerald-400/60 via-cyan-400/40 to-sky-500/40",
};

export function PhoneBezel({
	children,
	dim = false,
	haloMood = "idle",
}: Props) {
	return (
		<div className="relative mx-auto w-full max-w-[380px]">
			{/* halo glow */}
			<div
				aria-hidden
				className={`pointer-events-none absolute inset-0 -z-10 scale-[1.18] rounded-[80px] bg-gradient-to-br ${haloByMood[haloMood]} opacity-90 blur-[60px]`}
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10 scale-[1.05] rounded-[60px] bg-black/60 blur-2xl"
			/>

			{/* outer body — metallic */}
			<div
				className="relative rounded-[52px] p-[3px]"
				style={{
					background:
						"linear-gradient(140deg, #2a2a30 0%, #0a0a0c 30%, #1a1a20 55%, #050507 80%, #2a2a30 100%)",
					boxShadow:
						"0 30px 60px -20px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.05), inset 0 1px 0 rgba(255,255,255,.06)",
				}}
			>
				{/* inner bezel */}
				<div
					className="relative overflow-hidden rounded-[49px] p-[6px]"
					style={{
						background:
							"linear-gradient(160deg, #0a0a0d 0%, #050506 50%, #0a0a0d 100%)",
					}}
				>
					{/* screen */}
					<div
						className={`relative aspect-[9/16] w-full overflow-hidden rounded-[44px] bg-black transition-all duration-700 ${
							dim ? "brightness-[.35] saturate-[.6]" : ""
						}`}
					>
						{/* notch */}
						<div className="absolute top-[10px] left-1/2 z-30 h-[28px] w-[134px] -translate-x-1/2 rounded-full bg-black">
							<div className="absolute top-1/2 right-5 h-[8px] w-[8px] -translate-y-1/2 rounded-full bg-[#0a0a0d] ring-1 ring-white/10">
								<div className="absolute top-1/2 left-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/80" />
							</div>
						</div>
						{/* screen specular highlight */}
						<div
							aria-hidden
							className="pointer-events-none absolute inset-0 z-20 rounded-[44px]"
							style={{
								background:
									"linear-gradient(135deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,0) 28%, rgba(255,255,255,0) 70%, rgba(255,255,255,.04) 100%)",
							}}
						/>
						{children}
					</div>
				</div>

				{/* hairline side buttons */}
				<div className="absolute top-[120px] -left-[3px] h-[34px] w-[3px] rounded-l bg-gradient-to-b from-neutral-600 via-neutral-800 to-neutral-600" />
				<div className="absolute top-[180px] -left-[3px] h-[60px] w-[3px] rounded-l bg-gradient-to-b from-neutral-600 via-neutral-800 to-neutral-600" />
				<div className="absolute top-[260px] -left-[3px] h-[60px] w-[3px] rounded-l bg-gradient-to-b from-neutral-600 via-neutral-800 to-neutral-600" />
				<div className="absolute top-[200px] -right-[3px] h-[90px] w-[3px] rounded-r bg-gradient-to-b from-neutral-600 via-neutral-800 to-neutral-600" />
			</div>
		</div>
	);
}
