<script>
	import { reveal } from '$lib/actions/reveal.js';
	import { site } from '$lib/content.js';
</script>

<section class="cta-wrap">
	<div class="container">
		<div class="panel" use:reveal>
			<!-- flat multi-colour confetti, no gradient -->
			<svg class="sp sp1" width="30" height="30" viewBox="0 0 24 24" fill="#f6b93b"><path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" /></svg>
			<svg class="sp sp2" width="20" height="20" viewBox="0 0 24 24" fill="#ec6ec9"><path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" /></svg>
			<svg class="sp sp3" width="16" height="16" viewBox="0 0 24 24" fill="#6c5ce7"><path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" /></svg>
			<span class="dot d1"></span>
			<span class="dot d2"></span>
			<span class="dot d3"></span>

			<div class="inner">
				<p class="eyebrow" style="--tint: var(--coral-t); --tint-ink: var(--coral)">Ready when you are</p>
				<h2>Make your first mould in the <span class="mark">next five minutes</span></h2>
				<p class="lede">Upload a model, tune the split, export STL. No sign-up, no cost.</p>
				<div class="actions">
					<a class="btn btn-accent big" href="/mould" style="--btn: var(--coral)">Open the generator →</a>
					<a class="btn btn-outline" href="/signup">Create an account</a>
				</div>
				<p class="by">Powered by {site.poweredBy}</p>
			</div>
		</div>
	</div>
</section>

<style>
	.cta-wrap {
		padding-block: var(--space-section);
	}
	.panel {
		position: relative;
		overflow: hidden;
		border-radius: 30px;
		padding: clamp(52px, 6vw, 92px) clamp(24px, 5vw, 64px);
		text-align: center;
		background: #fff;
		border: 2px solid var(--ink);
		box-shadow: 10px 10px 0 var(--ink);
	}
	.inner {
		position: relative;
		z-index: 1;
	}
	.panel .eyebrow {
		margin-bottom: 16px;
	}
	.panel h2 {
		color: var(--ink);
		font-size: clamp(1.9rem, 4vw, 3rem);
		margin-bottom: 14px;
	}
	.lede {
		color: var(--slate);
		font-size: 1.14rem;
		margin-bottom: 28px;
	}
	.actions {
		display: flex;
		gap: 12px;
		justify-content: center;
		flex-wrap: wrap;
	}
	.big {
		font-size: 1.05rem;
		padding: 15px 32px;
	}
	.by {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--slate-2);
		margin-top: 22px;
	}

	.sp {
		position: absolute;
		z-index: 0;
	}
	.sp1 {
		top: 34px;
		left: 7%;
		animation: twinkle 2.6s ease-in-out infinite;
	}
	.sp2 {
		bottom: 40px;
		right: 10%;
		animation: twinkle 2.6s ease-in-out infinite 0.7s;
	}
	.sp3 {
		top: 48%;
		left: 13%;
		animation: twinkle 2.6s ease-in-out infinite 1.3s;
	}
	.dot {
		position: absolute;
		border-radius: 50%;
		z-index: 0;
	}
	.d1 {
		width: 16px;
		height: 16px;
		background: var(--violet);
		top: 26%;
		right: 8%;
		animation: floaty 5s ease-in-out infinite;
	}
	.d2 {
		width: 12px;
		height: 12px;
		background: var(--teal);
		bottom: 24%;
		left: 22%;
		animation: floaty 6s ease-in-out infinite 0.5s;
	}
	.d3 {
		width: 10px;
		height: 10px;
		background: var(--blue);
		top: 22%;
		left: 40%;
		animation: floaty 5.5s ease-in-out infinite 0.3s;
	}
	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.35;
			transform: scale(0.9);
		}
		50% {
			opacity: 1;
			transform: scale(1.1);
		}
	}
	@keyframes floaty {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sp,
		.dot {
			animation: none;
		}
	}
	@media (max-width: 560px) {
		.panel {
			box-shadow: 6px 6px 0 var(--ink);
		}
	}
</style>