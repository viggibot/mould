<script>
	import { reveal } from '$lib/actions/reveal.js';
	import { site } from '$lib/content.js';

	let { data } = $props(); // { currency: 'INR' | 'USD' } from +page.server.js

	// selected currency starts from server detection, user can switch
	let currency = $state(data?.currency ?? 'USD');

	const symbols = { INR: '₹', USD: '$' };

	// EDIT: set your real prices per currency. Separate prices, not a conversion.
	const plans = [
		{
			name: 'Free',
			tagline: 'Try the full studio',
			accent: 'var(--teal)',
			price: { INR: 0, USD: 0 },
			cta: 'Start free',
			href: '/mould',
			featured: false,
			soon: false,
			features: [
				'Full 3D mould studio',
				'STL · OBJ · 3MF · STEP upload',
				'Up to 3 mould exports / month',
				'Block & 2-part moulds',
				'Watermark-free STL'
			]
		},
		{
			name: 'Pro',
			tagline: 'For makers shipping regularly',
			accent: 'var(--violet)',
			price: { INR: 680, USD: 9 }, // EDIT USD price
			cta: 'Subscribe to Pro',
			href: '/signup?plan=pro',
			featured: true,
			soon: false,
			features: [
				'Everything in Free',
				'Unlimited mould exports',
				'Multi-part radial (4 & 6-part) moulds',
				'Silicone jacket moulds',
				'±0.01 mm cavity precision',
				'Priority email support'
			]
		},
		{
			name: 'Studio',
			tagline: 'Built-in STL editor & more',
			accent: 'var(--coral)',
			price: null, // coming soon
			cta: 'Coming soon',
			href: null,
			featured: false,
			soon: true,
			features: [
				'Everything in Pro',
				'Built-in STL editor',
				'Team seats',
				'Batch mould generation',
				'Shared project library'
			]
		}
	];

	function display(p) {
		if (p.soon) return 'Soon';
		const v = p.price[currency];
		return v === 0 ? 'Free' : `${symbols[currency]}${v}`;
	}
</script>

<svelte:head>
	<title>Pricing — Akritio</title>
	<meta
		name="description"
		content="Akritio pricing. Start free or subscribe to Pro for unlimited casting-mould exports. Cancel anytime."
	/>
</svelte:head>

<section class="pricing">
	<div class="container">
		<header class="head">
			<p class="eyebrow" use:reveal>Pricing</p>
			<h1 use:reveal={{ delay: 60 }}>
				Start free. <span class="mark">Go Pro when you scale.</span>
			</h1>
			<p class="lede" use:reveal={{ delay: 140 }}>
				Every plan runs the full mould studio in your browser. Upgrade to Pro for unlimited exports
				and multi-part moulds.
			</p>

			<div class="cur" use:reveal={{ delay: 200 }} role="group" aria-label="Currency">
				<button class:active={currency === 'INR'} onclick={() => (currency = 'INR')} type="button">
					₹ INR
				</button>
				<button class:active={currency === 'USD'} onclick={() => (currency = 'USD')} type="button">
					$ USD
				</button>
			</div>
		</header>

		<div class="cards" use:reveal={{ delay: 260 }}>
			{#each plans as p}
				<article class="card" class:featured={p.featured} class:soon={p.soon} style="--accent: {p.accent}">
					{#if p.featured}<span class="badge">Most popular</span>{/if}
					{#if p.soon}<span class="badge soon-badge">Coming soon</span>{/if}

					<h2 class="plan">{p.name}</h2>
					<p class="tag">{p.tagline}</p>

					<div class="price">
						<span class="amount">{display(p)}</span>
						{#if !p.soon && p.price[currency] !== 0}
							<span class="per">/ mo</span>
						{/if}
					</div>

					{#if p.soon}
						<p class="billed">Launching soon</p>
					{:else if p.price[currency] !== 0}
						<p class="billed">Billed monthly · cancel anytime</p>
					{:else}
						<p class="billed">No card required</p>
					{/if}

					{#if p.soon}
						<span class="btn plan-cta btn-disabled" aria-disabled="true">{p.cta}</span>
					{:else}
						<a class="btn plan-cta" class:btn-accent={p.featured} class:btn-outline={!p.featured}
							href={p.href} style="--btn: {p.accent}">
							{p.cta}
						</a>
					{/if}

					<ul class="feat">
						{#each p.features as f}
							<li>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
									stroke={p.accent} stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
									<path d="M4 12l5 5L20 6" />
								</svg>
								<span>{f}</span>
							</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>

		<p class="terms" use:reveal>
			Paid subscriptions renew automatically each month. You can cancel anytime from your account
			dashboard — access continues until the end of the paid period. Prices shown in your region's
			currency. See our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
		</p>
	</div>
</section>

<style>
	.pricing {
		padding-block: clamp(48px, 6vw, 90px) var(--space-section);
	}

	.head {
		max-width: 640px;
		margin: 0 auto clamp(36px, 5vw, 56px);
		text-align: center;
	}
	.eyebrow {
		margin-inline: auto;
	}
	h1 {
		font-size: clamp(2.2rem, 4.6vw, 3.4rem);
		font-weight: 700;
		margin-bottom: 18px;
	}
	.lede {
		font-size: 1.12rem;
		color: var(--slate);
		max-width: 46ch;
		margin: 0 auto 28px;
	}

	/* currency switch */
	.cur {
		display: inline-flex;
		gap: 4px;
		padding: 5px;
		border: 1.5px solid var(--line-2);
		border-radius: 999px;
		background: var(--cloud);
	}
	.cur button {
		border: none;
		background: transparent;
		font: inherit;
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--slate);
		padding: 9px 20px;
		border-radius: 999px;
		cursor: pointer;
		transition: background 0.16s ease, color 0.16s ease;
	}
	.cur button.active {
		background: var(--ink);
		color: #fff;
	}

	/* cards */
	.cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 22px;
		align-items: start;
	}
	.card {
		position: relative;
		background: #fff;
		border: 1.5px solid var(--line);
		border-radius: 24px;
		padding: 30px 26px;
		box-shadow: var(--shadow-md);
	}
	.card.featured {
		border: 2px solid var(--ink);
		box-shadow: 8px 8px 0 var(--ink);
	}
	.card.soon {
		background: var(--cloud);
	}
	.badge {
		position: absolute;
		top: -13px;
		left: 50%;
		transform: translateX(-50%);
		font-family: var(--font-mono);
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #fff;
		background: var(--violet);
		padding: 5px 13px;
		border-radius: 999px;
		white-space: nowrap;
	}
	.soon-badge {
		background: var(--coral);
	}
	.plan {
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--ink);
	}
	.tag {
		color: var(--slate-2);
		font-size: 0.92rem;
		margin-top: 4px;
		margin-bottom: 18px;
	}
	.price {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.amount {
		font-family: var(--font-display);
		font-size: 2.6rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--ink);
	}
	.card.soon .amount {
		color: var(--slate-2);
	}
	.per {
		color: var(--slate-2);
		font-size: 1rem;
		font-weight: 600;
	}
	.billed {
		font-size: 0.82rem;
		color: var(--slate-2);
		margin-top: 4px;
		margin-bottom: 22px;
	}
	.plan-cta {
		display: block;
		width: 100%;
		text-align: center;
		margin-bottom: 24px;
	}
	.btn-disabled {
		background: var(--line-2);
		color: var(--slate-2);
		cursor: not-allowed;
		pointer-events: none;
	}
	.feat {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 12px;
	}
	.feat li {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		font-size: 0.94rem;
		color: var(--slate);
		line-height: 1.45;
	}
	.feat svg {
		flex: none;
		margin-top: 2px;
	}

	.terms {
		max-width: 60ch;
		margin: clamp(32px, 4vw, 48px) auto 0;
		text-align: center;
		font-size: 0.88rem;
		line-height: 1.6;
		color: var(--slate-2);
	}
	.terms a {
		color: var(--slate);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.terms a:hover {
		color: var(--ink);
	}

	@media (max-width: 880px) {
		.cards {
			grid-template-columns: 1fr;
			max-width: 440px;
			margin-inline: auto;
		}
		.card.featured {
			box-shadow: 6px 6px 0 var(--ink);
		}
	}
	@media (max-width: 420px) {
		.cur button {
			padding: 8px 14px;
			font-size: 0.85rem;
		}
	}
</style>