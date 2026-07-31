<script>
	import { useCases, accents, accentTints } from '$lib/content.js';
	import { reveal } from '$lib/actions/reveal.js';
</script>

<section class="uses" id="uses">
	<div class="container">
		<header class="head" use:reveal>
			<p class="eyebrow" style="--tint: var(--coral-t); --tint-ink: var(--coral)">Use cases</p>
			<h2>What people make with it</h2>
			<p class="sub">Anywhere you'd pour a material into a negative, a generated mould gets you there faster.</p>
		</header>

		<ul class="grid">
			{#each useCases as u, i}
				<li class="card" style="--c: {accents[i % accents.length]}; --t: {accentTints[i % accentTints.length]}" use:reveal={{ delay: (i % 3) * 80 }}>
					<span class="num">{String(i + 1).padStart(2, '0')}</span>
					<h3>{u.title}</h3>
					<p>{u.body}</p>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.uses {
		padding-block: var(--space-section);
	}
	.head {
		max-width: 640px;
		margin-bottom: 44px;
	}
	.head h2 {
		font-size: clamp(2rem, 3.8vw, 2.9rem);
		margin-bottom: 14px;
	}
	.sub {
		font-size: 1.08rem;
		color: var(--slate);
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 18px;
	}
	.card {
		background: #fff;
		border: 1.5px solid var(--line);
		border-radius: var(--radius);
		padding: 26px 24px 28px;
		border-top: 4px solid var(--c);
		transition: transform 0.18s ease, box-shadow 0.2s ease;
	}
	.card:hover {
		transform: translateY(-5px);
		box-shadow: var(--shadow-md);
	}
	.num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 11px;
		font-family: var(--font-mono);
		font-size: 0.86rem;
		font-weight: 700;
		color: var(--c);
		background: var(--t);
		margin-bottom: 16px;
	}
	.card h3 {
		font-size: 1.2rem;
		margin-bottom: 9px;
	}
	.card p {
		color: var(--slate);
		font-size: 0.98rem;
	}

	@media (max-width: 860px) {
		.grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 560px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>