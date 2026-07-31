<script>
	import { faqs } from '$lib/content.js';
	import { reveal } from '$lib/actions/reveal.js';
</script>

<section class="faq" id="faq">
	<div class="container">
		<header class="head" use:reveal>
			<p class="eyebrow" style="--tint: var(--pink-t); --tint-ink: var(--pink)">FAQ</p>
			<h2>Mould or mold — <span class="mark">same tool</span></h2>
		</header>

		<div class="list">
			{#each faqs as f, i}
				<details use:reveal={{ delay: Math.min(i, 4) * 50 }}>
					<summary>
						<span>{f.q}</span>
						<span class="chev"></span>
					</summary>
					<div class="answer"><p>{f.a}</p></div>
				</details>
			{/each}
		</div>
	</div>
</section>

<style>
	.faq {
		padding-block: var(--space-section);
	}
	.head {
		margin-bottom: 34px;
	}
	.head h2 {
		font-size: clamp(2rem, 3.8vw, 2.9rem);
	}
	.list {
		max-width: 780px;
	}
	details {
		border: 1.5px solid var(--line);
		border-radius: var(--radius-sm);
		background: #fff;
		margin-bottom: 12px;
		transition: border-color 0.18s ease, box-shadow 0.18s ease;
	}
	details[open] {
		border-color: var(--violet);
		box-shadow: var(--shadow-md);
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 20px 22px;
		cursor: pointer;
		list-style: none;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.08rem;
		color: var(--ink);
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.chev {
		flex: none;
		width: 24px;
		height: 24px;
		border-radius: 8px;
		background: var(--violet-t);
		position: relative;
	}
	.chev::before,
	.chev::after {
		content: '';
		position: absolute;
		background: var(--violet);
		border-radius: 2px;
		transition: transform 0.22s ease;
	}
	.chev::before {
		top: 11px;
		left: 6px;
		width: 12px;
		height: 2px;
	}
	.chev::after {
		top: 6px;
		left: 11px;
		width: 2px;
		height: 12px;
	}
	details[open] .chev::after {
		transform: scaleY(0);
	}
	.answer {
		padding: 0 22px 22px;
		max-width: 68ch;
	}
	.answer p {
		color: var(--slate);
		font-size: 1.01rem;
	}
</style>