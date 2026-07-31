<div class="fx" aria-hidden="true">
	<svg class="grid" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<pattern id="fx-dots" width="26" height="26" patternUnits="userSpaceOnUse">
				<circle cx="1" cy="1" r="1" fill="#94a3b8" opacity="0.28" />
			</pattern>
		</defs>
		<rect width="100%" height="100%" fill="url(#fx-dots)" />
	</svg>

	<span class="orb orb-a"></span>
	<span class="orb orb-b"></span>
	<span class="orb orb-c"></span>
</div>

<style>
	.fx {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
		background: #ffffff;
	}
	.grid {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		mask-image: radial-gradient(120% 90% at 50% 0%, #000 55%, transparent 100%);
	}
	.orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(70px);
		opacity: 0.5;
	}
	.orb-a {
		width: 46vw;
		height: 46vw;
		top: -12vw;
		right: -8vw;
		background: radial-gradient(circle at 30% 30%, #93c5fd, transparent 62%);
		animation: drift-a 26s ease-in-out infinite;
	}
	.orb-b {
		width: 40vw;
		height: 40vw;
		top: 44vh;
		left: -14vw;
		background: radial-gradient(circle at 40% 40%, #c4b5fd, transparent 62%);
		animation: drift-b 32s ease-in-out infinite;
	}
	.orb-c {
		width: 34vw;
		height: 34vw;
		bottom: -8vw;
		right: 8vw;
		background: radial-gradient(circle at 50% 50%, #a5f3fc, transparent 62%);
		animation: drift-c 30s ease-in-out infinite;
	}

	@keyframes drift-a {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		50% {
			transform: translate(-4vw, 4vh) scale(1.08);
		}
	}
	@keyframes drift-b {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		50% {
			transform: translate(5vw, -3vh) scale(1.1);
		}
	}
	@keyframes drift-c {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		50% {
			transform: translate(-3vw, -4vh) scale(1.06);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.orb {
			animation: none;
		}
	}
</style>