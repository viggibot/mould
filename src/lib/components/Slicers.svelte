<script>
	import { slicers } from '$lib/content.js';
	import { reveal } from '$lib/actions/reveal.js';
</script>

<section class="slicers">
	<div class="container inner" use:reveal>
		<p class="lead">Exports clean STLs that slice in</p>
		<ul class="row">
			{#each slicers as s}
				<li>{s}</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.slicers {
		padding-block: clamp(20px, 4vw, 36px);
		border-block: 1px solid var(--line);
		background: var(--cloud);
	}
	.inner {
		display: flex;
		align-items: center;
		gap: 28px;
		flex-wrap: wrap;
		justify-content: center;
	}
	.lead {
		font-family: var(--font-mono);
		font-size: 0.74rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--slate-2);
	}
	.row {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 12px 28px;
		align-items: center;
	}
	.row li {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.05rem;
		color: var(--ink);
		opacity: 0.72;
		transition: opacity 0.15s ease;
	}
	.row li:hover {
		opacity: 1;
	}
</style>