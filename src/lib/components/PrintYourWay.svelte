<script>
	import { reveal } from '$lib/actions/reveal.js';
	import { site } from '$lib/content.js';

	// Akritio is a Navi3D product — this section boosts the platform. Point the
	// CTA at the Navi3D instant-quote flow (change if you have a deep link).
	const NAVI3D = site?.poweredBy ?? 'Navi3D';
	const NAVI3D_URL = 'https://navi3d.in';
</script>

<section class="pyw" id="print">
	<div class="container">
		<header class="head" use:reveal>
			<p class="eyebrow" style="--tint: var(--coral-t); --tint-ink: var(--coral)">Print &amp; ship</p>
			<h2>Made a mould? Print it <span class="mark">your way</span></h2>
			<p class="sub">
				Akritio hands you clean, print-ready STLs. Run them on your own printer — or let {NAVI3D}
				print and ship them for you. Same team that built Akritio, so the mould you designed is the
				mould you get.
			</p>
		</header>

		<div class="cards">
			<!-- Print it yourself -->
			<article class="card" style="--c: var(--violet); --t: var(--violet-t)" use:reveal>
				<span class="ic">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<rect x="5" y="9" width="14" height="7" rx="1.5" />
						<path d="M7 9V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5V9" />
						<path d="M8 16v4.5h8V16" />
						<circle cx="15.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
					</svg>
				</span>
				<h3>Print it yourself</h3>
				<p>Have an FDM or resin printer? Download the mould halves and slice them straight away — they're watertight and manifold, ready to run.</p>
				<ul class="pts">
					<li>Instant STL download</li>
					<li>FDM &amp; resin ready</li>
					<li>Slices clean in Cura, Prusa, Bambu &amp; Orca</li>
				</ul>
				<a class="btn btn-outline" href="/mould" style="--btn: var(--violet)">Open the studio →</a>
			</article>

			<!-- Print & ship with Navi3D (featured) -->
			<article class="card feat" style="--c: var(--coral); --t: var(--coral-t)" use:reveal={{ delay: 120 }}>
				<span class="badge">Powered by {NAVI3D}</span>
				<span class="ic">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M3 6h11v9H3z" />
						<path d="M14 9h3.5l3.5 3.5V15h-7z" />
						<circle cx="7" cy="18" r="1.7" />
						<circle cx="17" cy="18" r="1.7" />
					</svg>
				</span>
				<h3>Let {NAVI3D} print &amp; ship</h3>
				<p>No printer, or need production quality? Send your generated mould to {NAVI3D}'s Navi Mumbai farm — industrial FDM &amp; SLA, quality-checked and delivered.</p>
				<ul class="pts">
					<li>Industrial-grade FDM &amp; SLA</li>
					<li>Made in Navi Mumbai</li>
					<li>Tracked delivery across India</li>
				</ul>
				<a class="btn btn-accent" href={NAVI3D_URL} target="_blank" rel="noopener" style="--btn: var(--coral)">Print with {NAVI3D} →</a>
			</article>
		</div>

		<p class="foot" use:reveal>Designed in Akritio, printed anywhere — your bench or ours.</p>
	</div>
</section>

<style>
	.pyw {
		padding-block: var(--space-section);
		background: var(--cloud);
		border-block: 1px solid var(--line);
	}
	.head {
		max-width: 680px;
		margin-bottom: 40px;
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
		align-items: stretch;
	}
	.card {
		position: relative;
		background: #fff;
		border: 1.5px solid var(--line);
		border-radius: var(--radius);
		padding: 28px 26px 30px;
		display: flex;
		flex-direction: column;
		transition: transform 0.18s ease, box-shadow 0.2s ease, border-color 0.2s ease;
	}
	.card:hover {
		transform: translateY(-5px);
		box-shadow: var(--shadow-md);
		border-color: var(--c);
	}
	/* featured = the Navi3D card: bold outline + hard shadow, like the CTA panel */
	.card.feat {
		border: 2px solid var(--ink);
		box-shadow: 6px 6px 0 var(--ink);
	}
	.card.feat:hover {
		transform: translateY(-5px);
		box-shadow: 8px 8px 0 var(--ink);
		border-color: var(--ink);
	}
	.badge {
		position: absolute;
		top: -13px;
		left: 26px;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #fff;
		background: var(--c);
		padding: 5px 12px;
		border-radius: 999px;
		white-space: nowrap;
	}
	.ic {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 13px;
		background: var(--t);
		color: var(--c);
		flex: none;
		margin-bottom: 18px;
	}
	.card h3 {
		font-size: 1.28rem;
		margin: 0 0 9px;
	}
	.card > p {
		color: var(--slate);
		font-size: 0.99rem;
		margin: 0 0 16px;
	}
	.pts {
		list-style: none;
		margin: 0 0 24px;
		padding: 0;
		display: grid;
		gap: 9px;
	}
	.pts li {
		position: relative;
		padding-left: 26px;
		font-size: 0.95rem;
		color: var(--ink);
	}
	.pts li::before {
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
	.pts li::after {
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
	.card .btn {
		margin-top: auto;
		align-self: flex-start;
	}

	.foot {
		margin: 30px auto 0;
		text-align: center;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(1.05rem, 2vw, 1.35rem);
		color: var(--ink);
		max-width: 640px;
	}

	@media (max-width: 760px) {
		.cards {
			grid-template-columns: 1fr;
		}
		.card.feat {
			box-shadow: 5px 5px 0 var(--ink);
		}
	}
</style>