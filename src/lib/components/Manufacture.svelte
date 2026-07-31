<script>
	import { manufacture, site } from '$lib/content.js';
	import { reveal } from '$lib/actions/reveal.js';

	const stepColors = ['#3b82f6', '#6c5ce7', '#ff7a66'];
	const stepTints = ['#e9f1ff', '#efecfd', '#ffeee9'];
</script>

<section class="mf" id="manufacture">
	<div class="container">
		<div class="panel" use:reveal>
			<div class="intro">
				<p class="eyebrow" style="--tint: #fff; --tint-ink: var(--coral)">Powered by {site.poweredBy}</p>
				<h2>{manufacture.title}</h2>
				<p class="body">{manufacture.body}</p>
				<a class="btn btn-accent" href="/mould" style="--btn: var(--coral)">Start in the studio →</a>
			</div>

			<ol class="steps">
				{#each manufacture.steps as s, i}
					<li style="--c: {stepColors[i]}; --t: {stepTints[i]}" use:reveal={{ delay: i * 100 }}>
						<span class="n">{i + 1}</span>
						<div>
							<h3>{s.t}</h3>
							<p>{s.d}</p>
						</div>
					</li>
				{/each}
			</ol>
		</div>
	</div>
</section>

<style>
	.mf {
		padding-block: var(--space-section);
	}
	.panel {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: clamp(28px, 5vw, 56px);
		align-items: center;
		background: var(--cloud);
		border: 1.5px solid var(--line);
		border-radius: 28px;
		padding: clamp(32px, 5vw, 56px);
	}
	.intro h2 {
		font-size: clamp(1.9rem, 3.6vw, 2.7rem);
		margin-bottom: 16px;
	}
	.body {
		font-size: 1.06rem;
		color: var(--slate);
		margin-bottom: 26px;
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 14px;
	}
	.steps li {
		display: flex;
		gap: 16px;
		align-items: flex-start;
		background: #fff;
		border: 1.5px solid var(--line);
		border-radius: 16px;
		padding: 18px 20px;
	}
	.n {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 11px;
		background: var(--t);
		color: var(--c);
		font-family: var(--font-mono);
		font-weight: 700;
		flex: none;
	}
	.steps h3 {
		font-size: 1.08rem;
		margin: 2px 0 4px;
	}
	.steps p {
		font-size: 0.95rem;
		color: var(--slate);
	}

	@media (max-width: 820px) {
		.panel {
			grid-template-columns: 1fr;
		}
	}
</style>