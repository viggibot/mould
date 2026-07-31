<script>
	// Akritio — mould generator, powered by Navi3D Studio
</script>

<header class="nav">
	<div class="container inner">
		<a class="brand" href="/" aria-label="Akritio home">
			<svg class="mark" width="32" height="32" viewBox="0 0 30 30" aria-hidden="true">
				<rect x="1" y="1" width="28" height="28" rx="8" fill="#14161f" />
				<line x1="15" y1="4" x2="15" y2="26" stroke="#6c5ce7" stroke-width="1.8" stroke-dasharray="2.5 2.5" />
				<path d="M9.5 20 A5.5 6.5 0 0 1 9.5 8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
				<path d="M20.5 8 A5.5 6.5 0 0 1 20.5 20" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
				<circle cx="15" cy="14" r="2.6" fill="#ff7a66" />
			</svg>
			<span class="brand-txt">
				<span class="wordmark">Akritio</span>
				<span class="powered">powered by Navi3D Studio</span>
			</span>
		</a>

		<nav class="links" aria-label="Primary">
			<a href="/docs">Documentation</a>
			<a href="/contact">Contact</a>
		</nav>

		<div class="right">
			<a class="login" href="/login" aria-label="Log in">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="8" r="4" />
					<path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
				</svg>
			</a>
			<a class="btn btn-ink cta" href="/mould">Open the generator</a>
		</div>
	</div>
</header>

<style>
	.nav {
		position: sticky;
		top: 0;
		z-index: 50;
		background: rgba(255, 255, 255, 0.84);
		backdrop-filter: saturate(160%) blur(12px);
		-webkit-backdrop-filter: saturate(160%) blur(12px);
		border-bottom: 1px solid var(--line);
	}
	.inner {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 24px;
		height: 72px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 11px;
		justify-self: start;
	}
	.mark {
		flex: none;
		transition: transform 0.3s ease;
	}
	.brand:hover .mark {
		transform: rotate(-8deg);
	}
	.brand-txt {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}
	.wordmark {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.28rem;
		letter-spacing: -0.01em;
		color: var(--ink);
	}
	.powered {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--slate-2);
	}

	.links {
		display: flex;
		gap: 30px;
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--slate);
		justify-self: center;
	}
	.links a {
		position: relative;
		padding: 4px 0;
		transition: color 0.15s ease;
	}
	.links a::after {
		content: '';
		position: absolute;
		left: 0;
		bottom: -2px;
		width: 0;
		height: 3px;
		background: var(--violet);
		border-radius: 2px;
		transition: width 0.2s ease;
	}
	.links a:hover {
		color: var(--ink);
	}
	.links a:hover::after {
		width: 100%;
	}

	.right {
		display: flex;
		align-items: center;
		gap: 14px;
		justify-self: end;
	}
	.login {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1.5px solid var(--line-2);
		color: var(--ink);
		flex: none;
		transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
	}
	.login:hover {
		background: var(--ink);
		border-color: var(--ink);
		color: #fff;
		transform: translateY(-2px);
	}
	.cta {
		flex: none;
		padding: 10px 18px;
		font-size: 0.92rem;
	}

	@media (max-width: 720px) {
		.links {
			display: none;
		}
	}
	@media (max-width: 460px) {
		.cta {
			display: none;
		}
	}
</style>