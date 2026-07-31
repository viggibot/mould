<script>
	import { features, accents, accentTints } from '$lib/content.js';
	import { reveal } from '$lib/actions/reveal.js';

	const icons = [
		'<circle cx="12" cy="12" r="7.5"/><line x1="12" y1="2.5" x2="12" y2="21.5" stroke-dasharray="2.4 2.6"/>',
		'<circle cx="8.5" cy="12" r="2.6"/><circle cx="15.5" cy="12" r="3.4"/><line x1="8.5" y1="4" x2="8.5" y2="9"/><line x1="8.5" y1="15" x2="8.5" y2="20"/>',
		'<path d="M5 5h14l-4.5 6v8a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-8z"/>',
		'<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><rect x="8" y="8" width="8" height="8" rx="1.6"/>',
		'<rect x="3.5" y="8" width="11" height="11" rx="2.2"/><path d="M9.5 8V5.2a1.7 1.7 0 0 1 1.7-1.7H19a1.7 1.7 0 0 1 1.7 1.7v7.8A1.7 1.7 0 0 1 19 14.7h-2.7"/>',
		'<path d="M12 3v10"/><path d="M8 9l4 4 4-4"/><path d="M5 20h14"/>'
	];
	// which card is filled with its accent colour, for contrast (like the refs)
	const filled = 1;
</script>

<section class="features" id="features">
	<div class="container">
		<header class="head" use:reveal>
			<p class="eyebrow" style="--tint: var(--violet-t); --tint-ink: var(--violet)">Features</p>
			<h2>The hard parts of mould-making, <span class="mark">handled</span></h2>
			<p class="sub">
				Parting lines, keys, sprue, vents and shell thickness are what separate a mould that pours
				clean from one that traps air. Mould Generator sets them up for you.
			</p>
		</header>

		<ul class="grid">
			{#each features as f, i}
				<li
					class="card {i === filled ? 'fill' : ''}"
					style="--c: {accents[i % accents.length]}; --t: {accentTints[i % accentTints.length]}"
					use:reveal={{ delay: (i % 3) * 90 }}>
					<div class="top">
						<span class="icon">
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{@html icons[i]}</svg>
						</span>
						<a class="arrow" href="/studio" aria-label="Open the studio">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
						</a>
					</div>
					<h3>{f.title}</h3>
					<p>{f.body}</p>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.features {
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
		padding: 24px 24px 28px;
		transition: transform 0.18s ease, box-shadow 0.2s ease, border-color 0.2s ease;
	}
	.card:hover {
		transform: translateY(-6px);
		box-shadow: var(--shadow-md);
		border-color: var(--c);
	}
	.card.fill {
		background: var(--c);
		border-color: var(--c);
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 22px;
	}
	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 46px;
		height: 46px;
		border-radius: 13px;
		background: var(--t);
		color: var(--c);
		flex: none;
	}
	.card.fill .icon {
		background: rgba(255, 255, 255, 0.25);
		color: #fff;
	}
	.arrow {
		width: 40px;
		height: 40px;
		color: var(--ink);
	}
	.card.fill .arrow {
		color: #fff;
	}
	.arrow:hover {
		background: var(--c);
		color: #fff;
		transform: rotate(45deg);
	}
	.card.fill .arrow:hover {
		background: #fff;
		color: var(--c);
	}
	.card h3 {
		font-size: 1.2rem;
		margin-bottom: 9px;
	}
	.card.fill h3 {
		color: #fff;
	}
	.card p {
		color: var(--slate);
		font-size: 0.98rem;
	}
	.card.fill p {
		color: rgba(255, 255, 255, 0.9);
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