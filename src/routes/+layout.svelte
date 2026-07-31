<script>
	import { page } from '$app/stores';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
	let isStudio = $derived($page.url.pathname.startsWith('/studio'));
</script>

{#if isStudio}
	{@render children?.()}
{:else}
	<a class="skip-link" href="#main">Skip to content</a>
	<Navbar />
	<main id="main">
		{@render children?.()}
	</main>
	<Footer />
{/if}

<style>
	/* ---- Design tokens (flat, multi-colour, no gradients) ----------------- */
	:global(:root) {
		--ink: #14161f; /* near-black navy */
		--ink-2: #1e2130;
		--paper: #ffffff;
		--cloud: #f5f6fa; /* soft cool neutral band */
		--line: #e7e9f0;
		--line-2: #d8dbe6;
		--slate: #545a6b;
		--slate-2: #808798;

		/* curated flat accent palette */
		--violet: #6c5ce7;
		--blue: #3b82f6;
		--coral: #ff7a66;
		--teal: #17b8a6;
		--pink: #ec6ec9;
		--amber: #f6b93b;

		--violet-t: #efecfd;
		--blue-t: #e9f1ff;
		--coral-t: #ffeee9;
		--teal-t: #e3f7f4;
		--pink-t: #fcebf7;
		--amber-t: #fdf1da;

		--font-display: 'Space Grotesk', 'Inter', system-ui, sans-serif;
		--font-body: 'Inter', system-ui, -apple-system, sans-serif;
		--font-mono: ui-monospace, 'SFMono-Regular', 'JetBrains Mono', 'Menlo', monospace;

		--maxw: 1180px;
		--pad-x: clamp(20px, 5vw, 44px);
		--space-section: clamp(64px, 9vw, 120px);
		--radius: 22px;
		--radius-sm: 14px;
		--shadow-sm: 0 1px 2px rgba(20, 22, 31, 0.06);
		--shadow-md: 0 18px 40px -20px rgba(20, 22, 31, 0.24);
		--shadow-lg: 0 30px 60px -26px rgba(20, 22, 31, 0.3);
	}

	/* ---- Reset ------------------------------------------------------------ */
	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}
	:global(html) {
		scroll-behavior: smooth;
		-webkit-text-size-adjust: 100%;
	}
	:global(body) {
		margin: 0;
		background: var(--paper);
		color: var(--slate);
		font-family: var(--font-body);
		font-size: 17px;
		line-height: 1.6;
		-webkit-font-smoothing: antialiased;
		text-rendering: optimizeLegibility;
		overflow-x: hidden;
	}
	:global(h1, h2, h3, h4) {
		font-family: var(--font-display);
		color: var(--ink);
		line-height: 1.05;
		letter-spacing: -0.02em;
		margin: 0;
	}
	:global(p) {
		margin: 0;
	}
	:global(a) {
		color: inherit;
		text-decoration: none;
	}
	:global(img, svg) {
		display: block;
		max-width: 100%;
	}
	:global(:focus-visible) {
		outline: 3px solid var(--violet);
		outline-offset: 2px;
		border-radius: 4px;
	}

	/* ---- Shared helpers --------------------------------------------------- */
	:global(.container) {
		width: 100%;
		max-width: var(--maxw);
		margin-inline: auto;
		padding-inline: var(--pad-x);
	}

	/* soft-tinted pill label; components set --tint / --tint-ink */
	:global(.eyebrow) {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--tint-ink, var(--violet));
		background: var(--tint, var(--violet-t));
		padding: 6px 12px;
		border-radius: 999px;
		margin: 0 0 18px;
	}
	:global(.eyebrow::before) {
		content: '';
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: currentColor;
	}

	/* marker-highlight for a word inside a heading (warm amber by default) */
	:global(.mark) {
		background: var(--mark, var(--amber));
		color: var(--ink);
		padding: 0.02em 0.22em;
		border-radius: 6px;
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}

	/* buttons */
	:global(.btn) {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 0.98rem;
		padding: 13px 24px;
		border-radius: 999px;
		border: 1.5px solid transparent;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			background 0.18s ease,
			color 0.18s ease,
			border-color 0.18s ease;
	}
	:global(.btn-ink) {
		background: var(--ink);
		color: #fff;
	}
	:global(.btn-ink:hover) {
		transform: translateY(-2px);
		background: #000;
	}
	:global(.btn-accent) {
		background: var(--btn, var(--violet));
		color: #fff;
	}
	:global(.btn-accent:hover) {
		transform: translateY(-2px);
		filter: brightness(1.05);
	}
	:global(.btn-outline) {
		background: transparent;
		color: var(--ink);
		border-color: var(--ink);
	}
	:global(.btn-outline:hover) {
		transform: translateY(-2px);
		background: var(--ink);
		color: #fff;
	}

	/* circular arrow button used on cards */
	:global(.arrow) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		border: 1.5px solid currentColor;
		flex: none;
		transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
	}

	.skip-link {
		position: absolute;
		left: 12px;
		top: -60px;
		background: var(--ink);
		color: #fff;
		padding: 10px 16px;
		border-radius: 8px;
		z-index: 100;
		transition: top 0.2s ease;
	}
	.skip-link:focus {
		top: 12px;
	}
	main {
		display: block;
		position: relative;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(html) {
			scroll-behavior: auto;
		}
		:global(*) {
			animation-duration: 0.001ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.001ms !important;
		}
	}
</style>