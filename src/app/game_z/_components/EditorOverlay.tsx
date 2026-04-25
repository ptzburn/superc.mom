"use client";

type Props = {
	stage: string;
};

export function EditorOverlay({ stage }: Props) {
	return (
		<div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black/70 backdrop-blur-[2px]">
			<div className="relative">
				{/* spinning conic ring */}
				<div
					className="h-[120px] w-[120px] animate-spin rounded-full"
					style={{
						background:
							"conic-gradient(from 0deg, transparent 0deg, transparent 200deg, #c4b5fd 260deg, #67e8f9 320deg, #fda4af 360deg)",
						animationDuration: "1.6s",
						mask: "radial-gradient(circle, transparent 52px, black 53px)",
						WebkitMask: "radial-gradient(circle, transparent 52px, black 53px)",
					}}
				/>
				{/* inner pulsing core */}
				<div className="absolute inset-0 flex items-center justify-center">
					<div
						className="h-[90px] w-[90px] animate-pulse rounded-full"
						style={{
							background:
								"radial-gradient(circle at 30% 30%, rgba(196,181,253,.4), rgba(0,0,0,.85) 65%)",
							boxShadow: "0 0 40px rgba(167,139,250,.4)",
						}}
					/>
				</div>
				<div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-white/80 uppercase tracking-[.3em]">
					AI
				</div>
			</div>

			<div className="text-center">
				<div className="font-mono text-[10px] text-white/50 uppercase tracking-[.4em]">
					Editor
				</div>
				<div className="mt-2 bg-gradient-to-r from-violet-300 via-cyan-200 to-orange-200 bg-clip-text font-semibold text-[15px] text-transparent">
					{stage}
				</div>
			</div>

			{/* live bar */}
			<div className="flex h-[3px] w-[180px] overflow-hidden rounded-full bg-white/10">
				<div
					className="h-full w-1/2 rounded-full bg-gradient-to-r from-violet-400 via-cyan-300 to-orange-300"
					style={{
						animation: "editor-shimmer 1.6s ease-in-out infinite",
					}}
				/>
			</div>

			<style>{`
				@keyframes editor-shimmer {
					0% { transform: translateX(-100%); }
					100% { transform: translateX(220%); }
				}
			`}</style>
		</div>
	);
}
