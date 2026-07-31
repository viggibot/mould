<script>
	import { mouldTypes } from '$lib/content.js';
	import { reveal } from '$lib/actions/reveal.js';

	const fdm = mouldTypes.fdm;
	const sla = mouldTypes.sla;
	const chips = (s) => s.split(' · ');
</script>

<section class="types" id="types">
	<div class="container">
		<header class="head" use:reveal>
			<p class="eyebrow" style="--tint: var(--teal-t); --tint-ink: var(--teal)">FDM vs resin</p>
			<h2>The same mould, printed <span class="mark">two ways</span></h2>
			<p class="sub">
				How you print a generated mould decides its surface, size and cost. Here's what each method
				gives you, so you can match the print to the cast.
			</p>
		</header>

		<div class="cards">
			<!-- FDM (teal) -->
			<article class="card" style="--c: #17b8a6; --t: #e3f7f4" use:reveal>
				<div class="preview">
					<svg viewBox="0 0 200 150" width="100%" height="100%">
						<defs><clipPath id="fdm-clip"><path d="M100 34 L138 62 L124 112 L100 128 L76 112 L62 62 Z" /></clipPath></defs>
						<path d="M100 34 L138 62 L124 112 L100 128 L76 112 L62 62 Z" fill="#c7ede6" stroke="#14161f" stroke-width="1.5" />
						<g clip-path="url(#fdm-clip)" stroke="#8fd6ca" stroke-width="1.2">
							{#each Array(14) as _, i}<line x1="60" y1={36 + i * 7} x2="140" y2={36 + i * 7} />{/each}
						</g>
						<rect class="scan" x="60" y="30" width="80" height="4" fill="#17b8a6" clip-path="url(#fdm-clip)" />
					</svg>
					<span class="tag">layer lines</span>
				</div>
				<h3>{fdm.name}</h3>
				<p class="tagline">{fdm.tagline}</p>
				<p class="pchips">{#each chips(fdm.printIn) as c}<span>{c}</span>{/each}</p>
				<p class="surface">{fdm.surface}</p>
				<ul class="best">{#each fdm.bestFor as b}<li>{b}</li>{/each}</ul>
				<p class="watch"><b>Watch:</b> {fdm.watch}</p>
			</article>

			<!-- Resin (violet) -->
			<article class="card" style="--c: #6c5ce7; --t: #efecfd" use:reveal={{ delay: 120 }}>
				<div class="preview">
					<svg viewBox="0 0 200 150" width="100%" height="100%">
						<defs><clipPath id="sla-clip"><path d="M100 34 L138 62 L124 112 L100 128 L76 112 L62 62 Z" /></clipPath></defs>
						<path d="M100 34 L138 62 L124 112 L100 128 L76 112 L62 62 Z" fill="#ddd6fb" stroke="#14161f" stroke-width="1.5" />
						<g clip-path="url(#sla-clip)"><rect class="sheen" x="-40" y="20" width="24" height="120" fill="#ffffff" opacity="0.7" transform="skewX(-18)" /></g>
					</svg>
					<span class="tag">smooth finish</span>
				</div>
				<h3>{sla.name}</h3>
				<p class="tagline">{sla.tagline}</p>
				<p class="pchips">{#each chips(sla.printIn) as c}<span>{c}</span>{/each}</p>
				<p class="surface">{sla.surface}</p>
				<ul class="best">{#each sla.bestFor as b}<li>{b}</li>{/each}</ul>
				<p class="watch"><b>Watch:</b> {sla.watch}</p>
			</article>
		</div>

		<p class="rule" use:reveal>{mouldTypes.rule}</p>
	</div>
</section>

<style>
	.types {
		padding-block: var(--space-section);
	}
	.head {
		max-width: 660px;
		margin-bottom: 44px;
	}
	.head h2 {
		font-size: clamp(2rem, 3.8vw, 2.9rem);
		margin-bottom: 16px;
	}
	.sub {
		font-size: 1.08rem;
		color: var(--slate);
	}
	.cards {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}
	.card {
		background: #fff;
		border: 1.5px solid var(--line);
		border-top: 4px solid var(--c);
		border-radius: var(--radius);
		padding: 22px 24px 26px;
		transition: transform 0.18s ease, box-shadow 0.2s ease;
	}
	.card:hover {
		transform: translateY(-5px);
		box-shadow: var(--shadow-md);
	}
	.preview {
		position: relative;
		height: 168px;
		border-radius: 14px;
		background: var(--t);
		border: 1.5px solid var(--line);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 18px;
		overflow: hidden;
	}
	.tag {
		position: absolute;
		bottom: 10px;
		right: 12px;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--c);
	}
	.scan {
		animation: scan 3.4s ease-in-out infinite;
	}
	@keyframes scan {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(92px);
		}
	}
	.sheen {
		animation: sweep 3.8s ease-in-out infinite;
	}
	@keyframes sweep {
		0% {
			transform: translateX(0) skewX(-18deg);
		}
		55%,
		100% {
			transform: translateX(230px) skewX(-18deg);
		}
	}
	.card h3 {
		font-size: 1.34rem;
	}
	.tagline {
		color: #fff;
		background: var(--c);
		display: inline-block;
		font-weight: 600;
		font-size: 0.82rem;
		padding: 3px 11px;
		border-radius: 999px;
		margin: 8px 0 14px;
	}
	.pchips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 14px;
	}
	.pchips span {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--slate);
		background: var(--cloud);
		border: 1px solid var(--line);
		padding: 4px 9px;
		border-radius: 6px;
	}
	.surface {
		color: var(--slate);
		font-size: 0.97rem;
		margin-bottom: 16px;
	}
	.best {
		list-style: none;
		margin: 0 0 18px;
		padding: 0;
		display: grid;
		gap: 9px;
	}
	.best li {
		position: relative;
		padding-left: 26px;
		font-size: 0.96rem;
		color: var(--ink);
	}
	.best li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 3px;
		width: 16px;
		height: 16px;
		border-radius: 5px;
		background: var(--t);
		border: 1.5px solid var(--c);
	}
	.best li::after {
		content: '';
		position: absolute;
		left: 5px;
		top: 7px;
		width: 6px;
		height: 3px;
		border-left: 2px solid var(--c);
		border-bottom: 2px solid var(--c);
		transform: rotate(-45deg);
	}
	.watch {
		font-size: 0.9rem;
		color: var(--slate);
		border-left: 3px solid var(--c);
		padding: 4px 0 4px 14px;
	}
	.watch b {
		color: var(--ink);
	}
	.rule {
		margin-top: 30px;
		text-align: center;
		font-family: var(--font-display);
		font-size: clamp(1.1rem, 2vw, 1.4rem);
		font-weight: 600;
		color: var(--ink);
		max-width: 720px;
		margin-inline: auto;
	}

	@media (prefers-reduced-motion: reduce) {
		.scan,
		.sheen {
			animation: none;
		}
	}
	@media (max-width: 760px) {
		.cards {
			grid-template-columns: 1fr;
		}
	}
</style>