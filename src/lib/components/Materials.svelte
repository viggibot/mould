<script>
	import { materials, accents } from '$lib/content.js';
	import { reveal } from '$lib/actions/reveal.js';
</script>

<section class="materials">
	<div class="container" use:reveal>
		<p class="label"><span class="eyebrow" style="--tint: var(--teal-t); --tint-ink: var(--teal)">Cast in anything</span></p>
		<ul class="chips">
			{#each materials as m, i}
				<li style="--c: {accents[i % accents.length]}; --i: {i}"><span class="pip"></span>{m}</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.materials {
		padding-block: clamp(30px, 5vw, 48px);
	}
	.label {
		text-align: center;
		margin-bottom: 20px;
	}
	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
	}
	.chips li {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 0.84rem;
		color: var(--ink);
		background: #fff;
		border: 1.5px solid var(--line-2);
		padding: 8px 15px;
		border-radius: 999px;
		transition: transform 0.16s ease, border-color 0.16s ease;
		animation: pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
		animation-delay: calc(var(--i) * 55ms);
	}
	.chips li:hover {
		transform: translateY(-3px);
		border-color: var(--c);
	}
	.pip {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--c);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.9);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.chips li {
			animation: none;
		}
	}
</style>