<script>
	import { reveal } from '$lib/actions/reveal.js';
	import { stats, site } from '$lib/content.js';

	// floating product chips over the visual
	const chips = [
		{ t: 'Parting line', ok: true, c: '#17b8a6', bg: '#e3f7f4', pos: 'c1' },
		{ t: '±0.01 mm cavity', c: '#6c5ce7', bg: '#efecfd', pos: 'c2' },
		{ t: 'STL ready', c: '#ff7a66', bg: '#ffeee9', pos: 'c3' },
		{ t: '2 · 4 · 6-part', c: '#3b82f6', bg: '#e9f1ff', pos: 'c4' }
	];
</script>

<section class="hero" id="start">
	<div class="container grid">
		<div class="copy">
			<p class="eyebrow" use:reveal>3D printing · casting · moulds</p>
			<h1 use:reveal={{ delay: 60 }}>
				Turn any 3D model into a <span class="mark">print-ready mould</span>.
			</h1>
			<p class="lede" use:reveal={{ delay: 140 }}>
				Upload a model, tune the split in a live 3D studio, and export STL for FDM or resin — parting
				line, keys, sprue and vents all done for you. Powered by <b>{site.poweredBy}</b>.
				<span class="aside">(Yes, it's a mold generator too.)</span>
			</p>
			<div class="actions" use:reveal={{ delay: 220 }}>
				<a class="btn btn-accent" href="/studio" style="--btn: var(--violet)">Open the studio →</a>
				<a class="btn btn-outline" href="#how">See how it works</a>
			</div>
			<p class="trust" use:reveal={{ delay: 300 }}>Free · no login · runs in your browser</p>

			<ul class="stats" use:reveal={{ delay: 360 }}>
				{#each stats as s}
					<li><span class="big">{s.big}</span><span class="lab">{s.label}</span></li>
				{/each}
			</ul>
		</div>

		<div class="stage" aria-hidden="true">
			<div class="card">
				<svg viewBox="0 0 460 420" class="scene">
					<!-- soft shadow under the mould -->
					<ellipse cx="230" cy="372" rx="150" ry="20" fill="#14161f" opacity="0.06" />

					<!-- flexible silicone mould (wobbles gently) -->
					<g class="mould">
						<rect x="52" y="214" width="356" height="150" rx="40" fill="#8fe0d0" stroke="#14161f" stroke-width="1.6" />
						<rect x="52" y="214" width="356" height="34" rx="24" fill="#a7e9dc" />
						<ellipse cx="230" cy="228" rx="66" ry="18" fill="#4fc3af" stroke="#14161f" stroke-width="1.2" />
						<ellipse cx="230" cy="226" rx="46" ry="11" fill="#3aae9b" />
					</g>

					<!-- the cast, lifting out (bobs) -->
					<g class="cast">
						<path d="M230 150 L276 186 L262 250 L230 272 L198 250 L184 186 Z" fill="#ff7a66" stroke="#14161f" stroke-width="1.8" />
						<path d="M230 150 L184 186 L230 206 L276 186 Z" fill="#ffffff" opacity="0.34" />
						<path d="M184 186 L230 206 L230 272 L198 250 Z" fill="#14161f" opacity="0.12" />
					</g>

					<!-- sparkles -->
					<g class="spark s1" fill="#f6b93b"><path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" /></g>
					<g class="spark s2" fill="#ec6ec9"><path d="M9 0C10 5 13 8 18 9C13 10 10 13 9 18C8 13 5 10 0 9C5 8 8 5 9 0Z" /></g>
					<g class="spark s3" fill="#6c5ce7"><path d="M8 0C9 5 11 7 16 8C11 9 9 11 8 16C7 11 5 9 0 8C5 7 7 5 8 0Z" /></g>
				</svg>
			</div>

			{#each chips as ch, i}
				<span class="chip {ch.pos}" style="--c: {ch.c}; --bg: {ch.bg}; --d: {i}">
					{#if ch.ok}<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6" /></svg>{:else}<span class="pip"></span>{/if}
					{ch.t}
				</span>
			{/each}
		</div>
	</div>
</section>

<style>
	.hero {
		padding-block: clamp(40px, 6vw, 84px) var(--space-section);
	}
	.grid {
		display: grid;
		grid-template-columns: 1.02fr 1fr;
		gap: clamp(32px, 5vw, 64px);
		align-items: center;
	}

	h1 {
		font-size: clamp(2.6rem, 5.8vw, 4.4rem);
		font-weight: 700;
		margin-bottom: 22px;
	}
	.lede {
		font-size: 1.14rem;
		color: var(--slate);
		max-width: 40ch;
		margin-bottom: 28px;
	}
	.lede b {
		color: var(--ink);
	}
	.aside {
		color: var(--slate-2);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-bottom: 16px;
	}
	.trust {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		color: var(--slate-2);
		margin-bottom: 34px;
	}
	.stats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, auto);
		gap: 26px;
	}
	.stats li {
		display: flex;
		flex-direction: column;
	}
	.big {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--ink);
		letter-spacing: -0.02em;
	}
	.lab {
		font-size: 0.76rem;
		color: var(--slate-2);
	}

	/* ---- visual ---- */
	.stage {
		position: relative;
	}
	.card {
		position: relative;
		border-radius: 28px;
		background: var(--cloud);
		border: 1.5px solid var(--line);
		box-shadow: var(--shadow-lg);
		padding: 16px;
		animation: floatcard 7s ease-in-out infinite;
	}
	@keyframes floatcard {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}
	.scene {
		width: 100%;
		height: auto;
	}

	.mould {
		transform-origin: 230px 300px;
		animation: flex 3.6s ease-in-out infinite;
	}
	@keyframes flex {
		0%,
		100% {
			transform: scaleX(1) scaleY(1);
		}
		50% {
			transform: scaleX(1.015) scaleY(0.985);
		}
	}
	.cast {
		transform-origin: center;
		animation: lift 3.6s ease-in-out infinite;
	}
	@keyframes lift {
		0%,
		100% {
			transform: translateY(6px);
		}
		50% {
			transform: translateY(-8px);
		}
	}
	.spark {
		animation: twinkle 2.6s ease-in-out infinite;
		transform-box: fill-box;
		transform-origin: center;
	}
	.s1 {
		transform: translate(300px, 120px);
	}
	.s2 {
		transform: translate(120px, 150px);
		animation-delay: 0.7s;
	}
	.s3 {
		transform: translate(330px, 250px);
		animation-delay: 1.3s;
	}
	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 1;
		}
	}

	.chip {
		position: absolute;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--c);
		background: var(--bg);
		border: 1.5px solid var(--c);
		padding: 7px 12px;
		border-radius: 999px;
		box-shadow: var(--shadow-md);
		white-space: nowrap;
		animation: floaty 5s ease-in-out infinite;
		animation-delay: calc(var(--d) * 0.5s);
	}
	.chip .pip {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--c);
	}
	.c1 {
		top: 8%;
		left: -4%;
	}
	.c2 {
		top: 24%;
		right: -6%;
	}
	.c3 {
		bottom: 20%;
		right: -3%;
	}
	.c4 {
		bottom: 8%;
		left: 2%;
	}
	@keyframes floaty {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-9px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card,
		.mould,
		.cast,
		.spark,
		.chip {
			animation: none;
		}
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
			text-align: center;
		}
		.copy {
			order: 1;
		}
		.stage {
			order: 2;
			max-width: 480px;
			margin-inline: auto;
		}
		.lede {
			margin-inline: auto;
		}
		.actions,
		.stats {
			justify-content: center;
		}
		.stats {
			display: inline-grid;
			text-align: left;
		}
	}
	@media (max-width: 480px) {
		.stats {
			grid-template-columns: repeat(2, auto);
			gap: 18px 26px;
		}
		.chip {
			font-size: 0.72rem;
			padding: 5px 9px;
		}
	}
</style>