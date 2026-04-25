"use client";

export function Background() {
	return (
		<>
			{/* base black */}
			<div aria-hidden className="fixed inset-0 -z-50 bg-[#050507]" />

			{/* dot grid */}
			<div
				aria-hidden
				className="fixed inset-0 -z-40 opacity-[.35]"
				style={{
					backgroundImage:
						"radial-gradient(rgba(255,255,255,.13) 1px, transparent 1px)",
					backgroundSize: "22px 22px",
					maskImage:
						"radial-gradient(ellipse 80% 65% at 50% 30%, black 35%, transparent 80%)",
					WebkitMaskImage:
						"radial-gradient(ellipse 80% 65% at 50% 30%, black 35%, transparent 80%)",
				}}
			/>

			{/* ambient orbs */}
			<div
				aria-hidden
				className="fixed -top-40 -left-40 -z-30 h-[520px] w-[520px] rounded-full opacity-60"
				style={{
					background:
						"radial-gradient(circle at 30% 30%, rgba(167,139,250,.6), transparent 60%)",
					filter: "blur(80px)",
					animation: "orb-drift-a 18s ease-in-out infinite alternate",
				}}
			/>
			<div
				aria-hidden
				className="fixed -top-20 -right-32 -z-30 h-[480px] w-[480px] rounded-full opacity-55"
				style={{
					background:
						"radial-gradient(circle at 60% 40%, rgba(34,211,238,.55), transparent 60%)",
					filter: "blur(85px)",
					animation: "orb-drift-b 22s ease-in-out infinite alternate",
				}}
			/>
			<div
				aria-hidden
				className="fixed top-[40%] left-[20%] -z-30 h-[420px] w-[420px] rounded-full opacity-45"
				style={{
					background:
						"radial-gradient(circle at 50% 50%, rgba(251,146,60,.55), transparent 60%)",
					filter: "blur(90px)",
					animation: "orb-drift-c 26s ease-in-out infinite alternate",
				}}
			/>

			{/* fine top vignette */}
			<div
				aria-hidden
				className="pointer-events-none fixed inset-x-0 top-0 -z-20 h-[260px]"
				style={{
					background:
						"linear-gradient(180deg, rgba(255,255,255,.02), transparent)",
				}}
			/>

			<style>{`
				@keyframes orb-drift-a {
					from { transform: translate3d(0,0,0) scale(1); }
					to   { transform: translate3d(60px, 30px, 0) scale(1.08); }
				}
				@keyframes orb-drift-b {
					from { transform: translate3d(0,0,0) scale(1); }
					to   { transform: translate3d(-40px, 60px, 0) scale(1.1); }
				}
				@keyframes orb-drift-c {
					from { transform: translate3d(0,0,0) scale(1); }
					to   { transform: translate3d(40px, -50px, 0) scale(1.05); }
				}
			`}</style>
		</>
	);
}
