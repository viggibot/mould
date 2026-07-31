<script>
	let { title, updated, toc = [], children } = $props();
</script>

<main class="legal">
	<header class="head">
		<span class="dot d1" style="background: var(--violet)"></span>
		<span class="dot d2" style="background: var(--coral)"></span>
		<span class="dot d3" style="background: var(--teal)"></span>
		<span class="star" aria-hidden="true">✦</span>
		<div class="container">
			<span class="eyebrow">Legal</span>
			<h1>{title}</h1>
			<p class="updated">Last updated <b>{updated}</b></p>
		</div>
	</header>

	<div class="container body">
		{#if toc.length}
			<aside class="toc">
				<h2>On this page</h2>
				<nav aria-label="On this page">
					{#each toc as item}
						<a href={`#${item.id}`}>{item.label}</a>
					{/each}
				</nav>
			</aside>
		{/if}

		<article class="content">
			{@render children()}
		</article>
	</div>
</main>

<style>
	.legal {
		background: #fff;
		color: var(--ink);
	}

	/* ---- header ---- */
	.head {
		position: relative;
		overflow: hidden;
		padding-block: clamp(48px, 7vw, 88px) clamp(32px, 4vw, 48px);
		border-bottom: 1px solid #e9eaee;
	}
	.eyebrow {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #fff;
		background: var(--ink);
		padding: 4px 11px;
		border-radius: 999px;
	}
	.head h1 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(2rem, 5vw, 3.1rem);
		line-height: 1.05;
		margin: 16px 0 10px;
		letter-spacing: -0.02em;
	}
	.updated {
		font-size: 0.95rem;
		color: #6b7180;
	}
	.updated b {
		color: var(--ink);
		font-weight: 600;
	}
	.dot {
		position: absolute;
		border-radius: 50%;
		opacity: 0.9;
	}
	.d1 { width: 14px; height: 14px; top: 28px; right: 12%; }
	.d2 { width: 9px;  height: 9px;  top: 64px; right: 8%; }
	.d3 { width: 18px; height: 18px; bottom: 26px; right: 18%; }
	.star {
		position: absolute;
		top: 40%;
		right: 5%;
		font-size: 1.4rem;
		color: var(--amber);
	}

	/* ---- layout ---- */
	.body {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: clamp(32px, 5vw, 64px);
		padding-block: clamp(40px, 5vw, 64px) clamp(56px, 8vw, 96px);
		align-items: start;
	}
	.toc {
		position: sticky;
		top: 96px;
	}
	.toc h2 {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #6b7180;
		font-weight: 500;
		margin-bottom: 12px;
	}
	.toc nav {
		display: flex;
		flex-direction: column;
		border-left: 2px solid #e9eaee;
	}
	.toc a {
		font-size: 0.9rem;
		color: #6b7180;
		padding: 6px 0 6px 14px;
		margin-left: -2px;
		border-left: 2px solid transparent;
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.toc a:hover {
		color: var(--ink);
		border-left-color: var(--coral);
	}

	/* ---- content (children are rendered here, so target with :global) ---- */
	.content {
		max-width: 68ch;
	}
	.content :global(section) {
		scroll-margin-top: 96px;
		padding-block: 8px 28px;
	}
	.content :global(h2) {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(1.3rem, 2.6vw, 1.65rem);
		letter-spacing: -0.01em;
		margin: 18px 0 12px;
	}
	.content :global(h3) {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.05rem;
		margin: 20px 0 8px;
	}
	.content :global(p) {
		font-size: 1rem;
		line-height: 1.7;
		color: #33363f;
		margin: 0 0 14px;
	}
	.content :global(ul) {
		margin: 0 0 16px;
		padding-left: 0;
		list-style: none;
	}
	.content :global(li) {
		position: relative;
		padding-left: 22px;
		line-height: 1.65;
		color: #33363f;
		margin-bottom: 8px;
	}
	.content :global(li)::before {
		content: "";
		position: absolute;
		left: 0;
		top: 0.6em;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--teal);
	}
	.content :global(a) {
		color: var(--blue);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.content :global(.mark) {
		background: linear-gradient(transparent 60%, var(--amber) 60%);
		/* flat marker: it's a solid band, not a gradient fill — reads as a highlighter */
		padding: 0 2px;
		font-weight: 600;
		color: var(--ink);
	}
	.content :global(.note) {
		border: 2px solid var(--ink);
		box-shadow: 6px 6px 0 var(--ink);
		border-radius: 12px;
		padding: 16px 18px;
		margin: 8px 0 20px;
		font-size: 0.95rem;
	}

	@media (max-width: 860px) {
		.body {
			grid-template-columns: 1fr;
		}
		.toc {
			position: static;
		}
		.toc nav {
			flex-flow: row wrap;
			border-left: none;
		}
		.toc a {
			border-left: none;
			padding: 4px 10px;
			border: 1px solid #e9eaee;
			border-radius: 999px;
			margin: 0 6px 6px 0;
		}
		.toc a:hover {
			border-color: var(--coral);
		}
	}
</style>