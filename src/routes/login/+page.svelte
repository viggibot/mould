<script>
	import { PUBLIC_API_BASE_URL } from '$env/static/public';

	const API = PUBLIC_API_BASE_URL;

	let email = $state('');
	let password = $state('');
	let show = $state(false);
	let loading = $state(false);
	let error = $state('');

	async function submit(e) {
		e.preventDefault();
		error = '';
		if (!email || !password) {
			error = 'Enter your email and password.';
			return;
		}
		loading = true;
		try {
			// TODO: point this at your auth endpoint
			const res = await fetch(`${API}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			const data = await res.json().catch(() => null);
			if (!res.ok || !data || data.status === 'error')
				throw new Error((data && data.message) || 'Those details did not match. Try again.');
			window.location.assign('/mould');
		} catch (err) {
			error = err && err.message ? err.message : 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}

	function oauth(provider) {
		// TODO: point this at your OAuth redirect
		window.location.assign(`${API}/auth/${provider}`);
	}
</script>

<svelte:head>
	<title>Log in — Mould Generator</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="auth">
	<!-- ===== brand panel ===== -->
	<aside class="brand">
		<svg class="sp sp1" width="26" height="26" viewBox="0 0 24 24" fill="#f6b93b"><path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" /></svg>
		<svg class="sp sp2" width="18" height="18" viewBox="0 0 24 24" fill="#ec6ec9"><path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" /></svg>

		<a class="logo" href="/">
			<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
				<rect x="1" y="1" width="28" height="28" rx="8" fill="#fff" />
				<line x1="15" y1="4" x2="15" y2="26" stroke="#6c5ce7" stroke-width="1.8" stroke-dasharray="2.5 2.5" />
				<path d="M9.5 20 A5.5 6.5 0 0 1 9.5 8" fill="none" stroke="#14161f" stroke-width="1.8" stroke-linecap="round" />
				<path d="M20.5 8 A5.5 6.5 0 0 1 20.5 20" fill="none" stroke="#14161f" stroke-width="1.8" stroke-linecap="round" />
				<circle cx="15" cy="14" r="2.6" fill="#ff7a66" />
			</svg>
			<span>Mould<b>Generator</b></span>
		</a>

		<div class="pitch">
			<h2>Design moulds. <br />Cast anything.</h2>
			<ul>
				<li><span class="bdot" style="background: var(--teal)"></span> Free to start — no card needed</li>
				<li><span class="bdot" style="background: var(--violet)"></span> CAD-exact ±0.01 mm cavities</li>
				<li><span class="bdot" style="background: var(--coral)"></span> Or let Navi3D print &amp; ship it</li>
			</ul>
		</div>

		<svg class="mould" viewBox="0 0 260 170" aria-hidden="true">
			<ellipse cx="130" cy="150" rx="86" ry="12" fill="#000" opacity="0.14" />
			<rect x="34" y="86" width="192" height="72" rx="22" fill="#8fe0d0" stroke="#0c2f2a" stroke-width="1.4" />
			<rect x="34" y="86" width="192" height="18" rx="14" fill="#a7e9dc" />
			<ellipse cx="130" cy="94" rx="38" ry="9" fill="#4fc3af" />
			<path d="M130 44 L158 66 L149 110 L130 122 L111 110 L102 66 Z" fill="#ff7a66" stroke="#0c2f2a" stroke-width="1.4" />
			<path d="M130 44 L102 66 L130 78 L158 66 Z" fill="#fff" opacity="0.34" />
		</svg>

		<span class="powered">Powered by Navi3D</span>
	</aside>

	<!-- ===== form side ===== -->
	<main class="panel">
		<a class="back" href="/">← Back to home</a>
		<div class="card">
			<h1>Welcome back</h1>
			<p class="sub">Log in to save your moulds and manage Navi3D print orders.</p>

			<form class="af-form" onsubmit={submit}>
				{#if error}<p class="af-error">{error}</p>{/if}

				<div class="af-field">
					<label class="af-label" for="email">Email</label>
					<div class="af-inwrap">
						<input class="af-input" id="email" type="email" autocomplete="email" placeholder="you@example.com" bind:value={email} />
					</div>
				</div>

				<div class="af-field">
					<div class="af-row">
						<label class="af-label" for="password">Password</label>
						<a class="af-link" href="/forgot">Forgot?</a>
					</div>
					<div class="af-inwrap">
						<input class="af-input" id="password" type={show ? 'text' : 'password'} autocomplete="current-password" placeholder="••••••••" bind:value={password} />
						<button class="af-eye" type="button" onclick={() => (show = !show)} aria-label={show ? 'Hide password' : 'Show password'}>
							{#if show}
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2l20 20M6.7 6.7A10.5 10.5 0 0 0 1 12s4 7 11 7a10.4 10.4 0 0 0 5.3-1.4M9.9 4.2A10.6 10.6 0 0 1 12 5c7 0 11 7 11 7a17.7 17.7 0 0 1-2.6 3.4M9.5 9.5a3 3 0 0 0 4.2 4.2" /></svg>
							{:else}
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" /><circle cx="12" cy="12" r="3" /></svg>
							{/if}
						</button>
					</div>
				</div>

				<button class="btn btn-accent af-btn" type="submit" style="--btn: var(--violet)" disabled={loading}>
					{loading ? 'Logging in…' : 'Log in'}
				</button>

				<div class="af-divider">or continue with</div>
				<div class="af-social">
					<button class="af-oauth" type="button" onclick={() => oauth('google')}>
						<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7C21.8 19 23 15.9 23 12.3Z" /><path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.8H1.7v3C3.6 21.3 7.5 24 12 24Z" /><path fill="#FBBC05" d="M5.6 14.6a7.2 7.2 0 0 1 0-4.6v-3H1.7a12 12 0 0 0 0 10.6l3.9-3Z" /><path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.5 0 3.6 2.7 1.7 6.6l3.9 3C6.5 6.8 9 4.8 12 4.8Z" /></svg>
						Google
					</button>
					<button class="af-oauth" type="button" onclick={() => oauth('github')}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="#14161f"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.9 10.9c.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" /></svg>
						GitHub
					</button>
				</div>

				<p class="af-switch">New here? <a class="af-link" href="/signup">Create an account</a></p>
			</form>
		</div>
	</main>
</div>

<style>
	.auth {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: grid;
		grid-template-columns: 1.05fr 1fr;
		background: var(--paper);
		font-family: var(--font-body);
		overflow: auto;
	}

	/* brand panel */
	.brand {
		position: relative;
		overflow: hidden;
		background: var(--ink);
		color: #fff;
		padding: clamp(32px, 4vw, 56px);
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.14rem;
		color: #fff;
	}
	.logo b {
		font-weight: 500;
		color: #8a90a0;
	}
	.pitch {
		margin-top: auto;
	}
	.pitch h2 {
		color: #fff;
		font-size: clamp(1.9rem, 3vw, 2.7rem);
		margin-bottom: 22px;
	}
	.pitch ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 12px;
	}
	.pitch li {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.98rem;
		color: #c7cbd6;
	}
	.bdot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: none;
	}
	.mould {
		width: 100%;
		max-width: 300px;
	}
	.powered {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #fff;
		background: var(--coral);
		align-self: flex-start;
		padding: 4px 11px;
		border-radius: 999px;
	}
	.sp {
		position: absolute;
		animation: twinkle 2.6s ease-in-out infinite;
	}
	.sp1 {
		top: 12%;
		right: 12%;
	}
	.sp2 {
		top: 40%;
		right: 24%;
		animation-delay: 0.8s;
	}
	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.35;
			transform: scale(0.9);
		}
		50% {
			opacity: 1;
			transform: scale(1.1);
		}
	}

	/* form side */
	.panel {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: clamp(24px, 4vw, 48px);
	}
	.back {
		position: absolute;
		top: 22px;
		left: 24px;
		font-size: 0.88rem;
		color: var(--slate-2);
	}
	.back:hover {
		color: var(--ink);
	}
	.card {
		width: 100%;
		max-width: 400px;
	}
	.card h1 {
		font-size: clamp(1.7rem, 3vw, 2.2rem);
		margin-bottom: 10px;
	}
	.sub {
		color: var(--slate);
		margin-bottom: 28px;
	}

	/* form controls (scoped to this page) */
	.af-form {
		display: grid;
		gap: 16px;
	}
	.af-field {
		display: grid;
		gap: 7px;
	}
	.af-label {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--ink);
	}
	.af-inwrap {
		position: relative;
		display: flex;
		align-items: center;
	}
	.af-input {
		width: 100%;
		font-family: inherit;
		font-size: 0.98rem;
		color: var(--ink);
		background: #fff;
		border: 1.5px solid var(--line-2);
		border-radius: 12px;
		padding: 13px 14px;
		transition: border-color 0.16s ease, box-shadow 0.16s ease;
	}
	.af-input::placeholder {
		color: #a9b0bd;
	}
	.af-input:focus {
		outline: none;
		border-color: var(--violet);
		box-shadow: 0 0 0 4px var(--violet-t);
	}
	.af-eye {
		position: absolute;
		right: 8px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--slate-2);
		padding: 6px;
		border-radius: 8px;
		display: inline-flex;
	}
	.af-eye:hover {
		color: var(--ink);
	}
	.af-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.af-link {
		color: var(--violet);
		font-weight: 600;
		font-size: 0.88rem;
	}
	.af-link:hover {
		text-decoration: underline;
	}
	.af-btn {
		width: 100%;
		justify-content: center;
		margin-top: 4px;
		font-size: 1rem;
		padding: 14px 24px;
	}
	.af-divider {
		display: flex;
		align-items: center;
		gap: 14px;
		color: var(--slate-2);
		font-size: 0.8rem;
		margin: 4px 0;
	}
	.af-divider::before,
	.af-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--line);
	}
	.af-social {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.af-oauth {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-family: inherit;
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--ink);
		background: #fff;
		border: 1.5px solid var(--line-2);
		border-radius: 12px;
		padding: 11px 14px;
		cursor: pointer;
		transition: border-color 0.16s ease, background 0.16s ease;
	}
	.af-oauth:hover {
		border-color: var(--ink);
		background: var(--cloud);
	}
	.af-switch {
		margin-top: 22px;
		text-align: center;
		font-size: 0.92rem;
		color: var(--slate);
	}
	.af-error {
		background: #fff0ee;
		border: 1.5px solid #ffc9bf;
		color: #b93a25;
		border-radius: 10px;
		padding: 11px 13px;
		font-size: 0.88rem;
	}

	@media (max-width: 860px) {
		.auth {
			grid-template-columns: 1fr;
			position: absolute;
			min-height: 100dvh;
		}
		.brand {
			display: none;
		}
		.back {
			position: static;
			margin-bottom: 20px;
			display: inline-block;
		}
		.panel {
			flex-direction: column;
			align-items: stretch;
			justify-content: flex-start;
			padding-top: 32px;
		}
		.card {
			margin-inline: auto;
		}
	}
</style>