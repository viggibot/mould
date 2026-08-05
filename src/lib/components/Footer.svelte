<script>
	import { site } from '$lib/content.js';
	const year = new Date().getFullYear();
	const brand = 'Akritio'; // also set site.name = 'Akritio' in content.js
</script>

<footer class="footer">
	<span class="topline">
		<i style="background: var(--violet)"></i>
		<i style="background: var(--coral)"></i>
		<i style="background: var(--teal)"></i>
	</span>
	<div class="container">
		<div class="top">
			<div class="brand">
				<span class="wordmark">Akritio</span>
				<p>Akritio turns 3D models into print-ready casting moulds, right in your browser. A product of {site.poweredBy}.</p>
				<a class="mail" href="mailto:support@akritio.com">support@akritio.com</a>
				<span class="by">Powered by {site.poweredBy}</span>
			</div>

			<nav class="cols" aria-label="Footer">
				<div class="col">
					<h4>Product</h4>
					<a href="/mould">Open the generator</a>
					<a href="/pricing">Pricing</a>
					<a href="/docs">Docs</a>
					<a href="/contact">Contact</a>
				</div>
				<div class="col">
					<h4>Explore</h4>
					<a href="/#features">Features</a>
					<a href="/#how">How it works</a>
					<a href="/#uses">Use cases</a>
					<a href="/#faq">FAQ</a>
				</div>
				<div class="col">
					<h4>Legal</h4>
					<a href="/terms">Terms of Service</a>
					<a href="/privacy">Privacy Policy</a>
					<a href="/refunds">Refund Policy</a>
				</div>
			</nav>
		</div>

		<div class="bottom">
			<p class="seo">{brand} is an online mould generator (also spelled mold generator) for makers who cast in silicone, resin, plaster and concrete.</p>
			<p class="copyright">© {year} {brand} · a product of {site.poweredBy}.</p>
		</div>
	</div>
</footer>

<style>
	.footer {
		position: relative;
		background: var(--ink);
		color: #9aa0ae;
		padding-block: clamp(48px, 6vw, 72px) 32px;
	}
	.topline {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		display: flex;
	}
	.topline i {
		flex: 1;
	}
	.top {
		display: grid;
		grid-template-columns: 1.3fr 2fr;
		gap: 40px;
		padding-bottom: 40px;
		border-bottom: 1px solid #282c3a;
	}
	.wordmark {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.2rem;
		color: #fff;
	}
	.brand p {
		margin-top: 12px;
		max-width: 30ch;
		font-size: 0.95rem;
		line-height: 1.6;
	}
	.mail {
		display: inline-block;
		margin-top: 10px;
		font-size: 0.9rem;
		color: #c7cbd4;
		transition: color 0.15s ease;
	}
	.mail:hover {
		color: #fff;
	}
	.by {
		display: block;
		margin-top: 14px;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #fff;
		background: var(--coral);
		padding: 4px 11px;
		border-radius: 999px;
		width: fit-content;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 24px;
	}
	.col h4 {
		color: #e6e8ee;
		font-size: 0.78rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-family: var(--font-mono);
		font-weight: 500;
		margin-bottom: 14px;
	}
	.col a {
		display: block;
		font-size: 0.95rem;
		padding: 5px 0;
		color: #9aa0ae;
		transition: color 0.15s ease, padding-left 0.15s ease;
	}
	.col a:hover {
		color: #fff;
		padding-left: 4px;
	}
	.bottom {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
		flex-wrap: wrap;
		padding-top: 28px;
	}
	.seo {
		font-size: 0.85rem;
		max-width: 60ch;
		color: #6b7180;
	}
	.copyright {
		font-size: 0.85rem;
		color: #6b7180;
		white-space: nowrap;
	}
	@media (max-width: 760px) {
		.top {
			grid-template-columns: 1fr;
			gap: 32px;
		}
	}
	@media (max-width: 480px) {
		.cols {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>