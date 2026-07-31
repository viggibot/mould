<script>
	import { steps, accents } from '$lib/content.js';
	import { reveal } from '$lib/actions/reveal.js';
</script>

<section class="how" id="how">
	<div class="container">
		<header class="head" use:reveal>
			<p class="eyebrow" style="--tint: var(--blue-t); --tint-ink: var(--blue)">How it works</p>
			<h2>From file to mould in <span class="mark">three steps</span></h2>
		</header>

		<div class="rail">
			<span class="line"></span>
			<ol class="steps">
				{#each steps as s, i}
					<li class="step" style="--c: {accents[i % accents.length]}" use:reveal={{ delay: i * 120 }}>
						<span class="node">{s.n}</span>
						<h3>{s.title}</h3>
						<p>{s.body}</p>
					</li>
				{/each}
			</ol>
		</div>
	</div>
</section>

<style>
	.how {
		padding-block: var(--space-section);
		background: var(--cloud);
		border-block: 1px solid var(--line);
	}
	.head {
		margin-bottom: 52px;
	}
	.head h2 {
		font-size: clamp(2rem, 3.8vw, 2.9rem);
	}
	.rail {
		position: relative;
	}
	.line {
		position: absolute;
		top: 23px;
		left: 4%;
		right: 4%;
		height: 2px;
		background: var(--line-2);
		transform: scaleX(0);
		transform-origin: left;
		animation: draw 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) 0.3s forwards;
	}
	@keyframes draw {
		to {
			transform: scaleX(1);
		}
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 26px;
	}
	.step {
		position: relative;
	}
	.node {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--c);
		font-family: var(--font-mono);
		font-size: 0.92rem;
		font-weight: 700;
		color: #fff;
		margin-bottom: 18px;
		position: relative;
		z-index: 1;
	}
	.step h3 {
		font-size: 1.34rem;
		margin: 0 0 10px;
	}
	.step p {
		color: var(--slate);
		font-size: 1rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.line {
			transform: scaleX(1);
			animation: none;
		}
	}
	@media (max-width: 780px) {
		.line {
			left: 24px;
			top: 24px;
			bottom: 24px;
			right: auto;
			width: 2px;
			height: auto;
			transform-origin: top;
		}
		@keyframes draw {
			to {
				transform: scaleY(1);
			}
		}
		.steps {
			grid-template-columns: 1fr;
			gap: 28px;
		}
		.step {
			padding-left: 68px;
		}
		.node {
			position: absolute;
			left: 0;
			top: 0;
			margin: 0;
		}
	}
</style>