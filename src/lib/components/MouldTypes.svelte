<script>
	import { mouldTypes } from '$lib/content.js';
	import { reveal } from '$lib/actions/reveal.js';

	const fdm = mouldTypes.fdm;
	const sla = mouldTypes.sla;
	const chips = (s) => s.split(' · ');

	// Flat accent palette (rotated across cards)
	const C = {
		violet: ['#6c5ce7', '#efecfd'],
		blue: ['#3b82f6', '#e7f0fe'],
		coral: ['#ff7a66', '#ffede9'],
		teal: ['#17b8a6', '#e3f7f4'],
		pink: ['#ec6ec9', '#fdebf7'],
		amber: ['#f6b93b', '#fef4de']
	};

	// Every system the generator builds. `art` is drawn inline below.
	const systems = [
		{ id: 'box', group: 'Rigid', name: 'Two-part box', color: C.blue, free: true,
		  line: 'A solid block split into halves — or four / six radial pieces for side undercuts.',
		  uses: ['Candles', 'Soap', 'Wax', 'Plaster'] },
		{ id: 'adaptive', group: 'Silicone', name: 'Adapted box', color: C.violet,
		  line: 'A thin jacket that follows your model, with base, funnel, risers and bolt-on flange. Uses a fraction of the silicone of a square box.',
		  uses: ['Figures', 'Resin', 'Detail'] },
		{ id: 'tray', group: 'Silicone', name: 'Tray box', color: C.teal,
		  line: 'An open tray for flat-backed parts — nest the master, pour once.',
		  uses: ['Reliefs', 'Coins', 'Tiles'] },
		{ id: 'multipart', group: 'Silicone', name: 'Multi-part silicone', color: C.pink,
		  line: 'An enclosed jacket cut on two or three planes you place — the silicone comes out in keyed pieces along controlled parting lines.',
		  uses: ['Busts', 'Complex forms'] },
		{ id: 'core', group: 'Silicone', name: 'Inner cavity', color: C.amber,
		  line: 'For hollow casts: the jacket stays open at the mouth and a shape-matched, drafted core with a T-bar drops in — no core modelling. Bores in rings and tubes are plugged.',
		  uses: ['Vases', 'Planters', 'Rings'] },
		{ id: 'slip', group: 'Ceramics', name: 'Slip casting', color: C.coral,
		  line: 'An open case for pouring plaster moulds, with a shape-matched spare, a trimmed cast mouth and keyed plaster halves.',
		  uses: ['Ceramics', 'Plaster'] },
		{ id: 'direct_open', group: 'Direct print', name: 'Direct · open base', color: C.blue,
		  line: 'Print the mould itself and cast straight in — open base for easy pouring and release.',
		  uses: ['Resin', 'Wax', 'Plaster'] },
		{ id: 'direct_funnel', group: 'Direct print', name: 'Direct · top funnel', color: C.teal,
		  line: 'A closed printed mould with a built-in funnel and risers for a controlled fill.',
		  uses: ['Resin', 'Concrete'] },
		{ id: 'skin', group: 'Direct print', name: 'Printed mould · skin', color: C.violet,
		  line: 'A printed core and matching shell that form a flexible skin between them.',
		  uses: ['Masks', 'Latex'] },
		{ id: 'fixture', group: 'Utility', name: 'Fixture', color: C.amber,
		  line: 'A holder that grips the part for pad printing, painting, soldering or engraving.',
		  uses: ['Pad print', 'Engraving'] },
		{ id: 'shell', group: 'Utility', name: 'Protective shell', color: C.pink,
		  line: 'A fitted clamshell case with keyed halves for shipping and storage.',
		  uses: ['Shipping', 'Storage'] }
	];

	const capabilities = [
		'Split planes you place and rotate',
		'Flange keys + clamp holes',
		'Smart base keys',
		'Master seal + locator socket',
		'Foundation for rough bottoms',
		'Air-trap check + support pillars',
		'Silicone / plaster / cast volume estimate',
		'Branding + volume labels',
		'Mesh repair',
		'Every part as its own STL'
	];
</script>

<section class="types" id="types">
	<div class="container">
		<header class="head" use:reveal>
			<p class="eyebrow" style="--tint: var(--teal-t); --tint-ink: var(--teal)">Mould systems</p>
			<h2>The right mould for <span class="mark">every model</span></h2>
			<p class="sub">
				Pick a starting point, then tune its splits, pour, keys and base in the live preview. Every system
				is built from your model's real shape — not a box around it.
			</p>
		</header>

		<div class="grid">
			{#each systems as s, i (s.id)}
				<a class="sys" href="/mould" style="--c: {s.color[0]}; --t: {s.color[1]}" use:reveal={{ delay: (i % 3) * 80 }}>
					<div class="art">
						<svg viewBox="0 0 120 80" width="100%" height="100%" aria-hidden="true">
							{#if s.id === 'box'}
								<rect x="22" y="18" width="34" height="46" rx="4" fill="var(--t)" stroke="#14161f" stroke-width="1.5" />
								<rect x="64" y="18" width="34" height="46" rx="4" fill="var(--t)" stroke="#14161f" stroke-width="1.5" />
								<path d="M56 30c-8 2-8 22 0 24" fill="var(--c)" />
								<path d="M64 30c8 2 8 22 0 24" fill="var(--c)" />
								<circle cx="39" cy="24" r="2" fill="#14161f" /><circle cx="81" cy="24" r="2" fill="#fff" stroke="#14161f" />
							{:else if s.id === 'adaptive'}
								<rect x="18" y="62" width="84" height="8" rx="2" fill="#14161f" />
								<path d="M58 14c-16 0-26 12-26 26s6 22 26 22" fill="none" stroke="var(--c)" stroke-width="5" />
								<path d="M62 14c16 0 26 12 26 26s-6 22-26 22" fill="none" stroke="var(--c)" stroke-width="5" />
								<ellipse cx="60" cy="42" rx="14" ry="16" fill="var(--t)" stroke="#14161f" stroke-width="1.5" />
								<path d="M54 6h12l-3 8h-6z" fill="var(--c)" />
							{:else if s.id === 'tray'}
								<path d="M16 34h88v26a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" fill="var(--t)" stroke="#14161f" stroke-width="1.5" />
								<path d="M26 60c4-14 16-14 20 0M50 60c4-18 20-18 24 0M78 60c3-12 12-12 16 0" fill="var(--c)" />
								<path d="M16 34h88" stroke="var(--c)" stroke-width="4" />
							{:else if s.id === 'multipart'}
								<path d="M56 14a26 26 0 0 0-24 24h24z" fill="var(--c)" stroke="#14161f" stroke-width="1.5" />
								<path d="M64 14a26 26 0 0 1 24 24H64z" fill="var(--t)" stroke="#14161f" stroke-width="1.5" />
								<path d="M32 46a26 26 0 0 0 24 24V46z" fill="var(--t)" stroke="#14161f" stroke-width="1.5" />
								<path d="M88 46a26 26 0 0 1-24 24V46z" fill="var(--c)" stroke="#14161f" stroke-width="1.5" />
							{:else if s.id === 'core'}
								<path d="M22 70V14h8v40a14 14 0 0 0 28 0V14h8v56z" fill="var(--c)" stroke="#14161f" stroke-width="1.5" transform="translate(4 0)" />
								<path d="M40 14v38a10 10 0 0 0 20 0V14" fill="var(--t)" stroke="#14161f" stroke-width="1.5" transform="translate(4 0)" />
								<path d="M47 12h10l-1.5 38a3.5 3.5 0 0 1-7 0z" fill="#3b82f6" stroke="#14161f" stroke-width="1.2" transform="translate(-2 0)" />
								<rect x="24" y="6" width="68" height="6" rx="2" fill="#3b82f6" stroke="#14161f" stroke-width="1.2" transform="translate(-4 0)" />
								<circle cx="56" cy="9" r="5" fill="#3b82f6" stroke="#14161f" stroke-width="1.2" transform="translate(-4 0)" />
							{:else if s.id === 'slip'}
								<rect x="26" y="20" width="68" height="48" rx="6" fill="var(--t)" stroke="#14161f" stroke-width="1.5" />
								<path d="M48 20l-4-12h32l-4 12z" fill="var(--c)" />
								<path d="M48 28h24l-2 30a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6z" fill="#fff" stroke="#14161f" stroke-width="1.5" />
							{:else if s.id === 'direct_open'}
								<path d="M26 68V36a34 26 0 0 1 68 0v32" fill="none" stroke="var(--c)" stroke-width="8" />
								<path d="M40 68V38a20 16 0 0 1 40 0v30" fill="var(--t)" stroke="#14161f" stroke-width="1.5" />
								<path d="M18 68h24M78 68h24" stroke="#14161f" stroke-width="3" />
							{:else if s.id === 'direct_funnel'}
								<ellipse cx="60" cy="48" rx="34" ry="22" fill="var(--c)" stroke="#14161f" stroke-width="1.5" />
								<ellipse cx="60" cy="48" rx="24" ry="14" fill="var(--t)" />
								<path d="M50 6h20l-6 14h-8z" fill="#fff" stroke="#14161f" stroke-width="1.5" />
								<rect x="84" y="12" width="4" height="20" fill="#14161f" />
							{:else if s.id === 'skin'}
								<path d="M34 16c16-8 36-8 52 0v22c0 18-12 30-26 30S34 56 34 38z" fill="var(--c)" />
								<path d="M42 20c12-6 24-6 36 0v18c0 12-8 22-18 22s-18-10-18-22z" fill="var(--t)" stroke="#14161f" stroke-width="1.5" />
								<circle cx="52" cy="34" r="3" fill="#14161f" /><circle cx="68" cy="34" r="3" fill="#14161f" />
							{:else if s.id === 'fixture'}
								<rect x="14" y="46" width="92" height="22" rx="4" fill="var(--c)" stroke="#14161f" stroke-width="1.5" />
								<path d="M40 46a20 16 0 0 1 40 0" fill="#fff" stroke="#14161f" stroke-width="1.5" />
								<path d="M44 46c0-18 32-18 32 0" fill="var(--t)" stroke="#14161f" stroke-width="1.5" />
								<circle cx="24" cy="57" r="4" fill="#fff" /><circle cx="96" cy="57" r="4" fill="#fff" />
							{:else if s.id === 'shell'}
								<rect x="30" y="8" width="60" height="30" rx="14" fill="var(--c)" stroke="#14161f" stroke-width="1.5" transform="translate(0 -2)" />
								<rect x="30" y="44" width="60" height="30" rx="14" fill="var(--t)" stroke="#14161f" stroke-width="1.5" />
								<ellipse cx="60" cy="42" rx="12" ry="16" fill="#fff" stroke="#14161f" stroke-width="1.5" />
							{/if}
						</svg>
						<span class="grp">{s.group}</span>
						{#if s.free}<span class="free">Free</span>{/if}
					</div>
					<h3>{s.name}</h3>
					<p class="line">{s.line}</p>
					<p class="uses">{#each s.uses as u}<span>{u}</span>{/each}</p>
				</a>
			{/each}

			<div class="sys caps" use:reveal>
				<h3>Built into every system</h3>
				<ul>{#each capabilities as c}<li>{c}</li>{/each}</ul>
				<a class="go" href="/mould">Open the generator <span aria-hidden="true">→</span></a>
			</div>
		</div>

		<!-- ---------------- FDM vs resin ---------------- -->
		<header class="head head2" use:reveal>
			<p class="eyebrow" style="--tint: #efecfd; --tint-ink: #6c5ce7">FDM vs resin</p>
			<h2>The same mould, printed <span class="mark">two ways</span></h2>
			<p class="sub">
				How you print a generated mould decides its surface, size and cost. Here's what each method gives
				you, so you can match the print to the cast.
			</p>
		</header>

		<div class="cards">
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
	.head2 {
		margin-top: calc(var(--space-section) * 0.8);
	}
	.head h2 {
		font-size: clamp(2rem, 3.8vw, 2.9rem);
		margin-bottom: 16px;
	}
	.sub {
		font-size: 1.08rem;
		color: var(--slate);
	}

	/* ---------- systems grid ---------- */
	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 18px;
	}
	.sys {
		display: flex;
		flex-direction: column;
		background: #fff;
		border: 1.5px solid var(--line);
		border-radius: var(--radius);
		padding: 16px 18px 20px;
		color: inherit;
		text-decoration: none;
		transition: transform 0.18s ease, box-shadow 0.2s ease, border-color 0.18s ease;
	}
	a.sys:hover {
		transform: translateY(-4px);
		border-color: var(--c);
		box-shadow: var(--shadow-md);
	}
	.art {
		position: relative;
		height: 132px;
		border-radius: 12px;
		background: var(--t);
		border: 1.5px solid var(--line);
		margin-bottom: 14px;
		padding: 12px 20px 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.art svg {
		max-width: 190px;
	}
	.grp {
		position: absolute;
		top: 9px;
		left: 11px;
		font-family: var(--font-mono);
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--c);
		background: #fff;
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 2px 8px;
	}
	.free {
		position: absolute;
		top: 9px;
		right: 11px;
		font-size: 0.66rem;
		font-weight: 700;
		color: #fff;
		background: #14161f;
		border-radius: 999px;
		padding: 2px 8px;
	}
	.sys h3 {
		font-size: 1.12rem;
		margin-bottom: 6px;
	}
	.line {
		color: var(--slate);
		font-size: 0.92rem;
		line-height: 1.5;
		margin-bottom: 12px;
		flex: 1;
	}
	.uses {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin: 0;
	}
	.uses span {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--ink);
		background: var(--t);
		border: 1px solid var(--line);
		padding: 3px 8px;
		border-radius: 6px;
	}
	.caps {
		background: #14161f;
		border-color: #14161f;
		color: #fff;
	}
	.caps h3 {
		color: #fff;
		font-size: 1.12rem;
		margin-bottom: 12px;
	}
	.caps ul {
		list-style: none;
		padding: 0;
		margin: 0 0 18px;
		display: grid;
		gap: 7px;
		flex: 1;
	}
	.caps li {
		position: relative;
		padding-left: 18px;
		font-size: 0.9rem;
		color: #d7d9e0;
	}
	.caps li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 7px;
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background: #f6b93b;
	}
	.caps li:nth-child(3n + 2)::before {
		background: #17b8a6;
	}
	.caps li:nth-child(3n)::before {
		background: #ec6ec9;
	}
	.go {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		font-size: 0.92rem;
		color: #14161f;
		background: #ff7a66;
		border-radius: 999px;
		padding: 9px 16px;
		text-decoration: none;
		transition: transform 0.15s ease;
	}
	.go:hover {
		transform: translateX(3px);
	}

	/* ---------- FDM vs resin ---------- */
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
		a.sys:hover,
		.card:hover {
			transform: none;
		}
	}
	@media (max-width: 980px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (max-width: 760px) {
		.cards {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 560px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>