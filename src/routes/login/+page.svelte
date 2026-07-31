<script>
	import { site } from '$lib/content.js';
	// import { goto } from '$app/navigation'; // uncomment when wiring API redirect

	// ---------- Step machine ----------
	let step = $state('login'); // 'login' | 'forgot_init' | 'forgot_reset'

	// ---------- Form state ----------
	let email = $state('');
	let password = $state('');
	let newPassword = $state('');
	let otp = $state('');
	let showPw = $state(false);
	let remember = $state(true);
	let loading = $state(false);
	let error = $state('');
	let successMsg = $state('');

	function resetFormState() {
		error = '';
		successMsg = '';
		password = '';
		newPassword = '';
		otp = '';
		showPw = false;
	}

	// ============================================================
	// UI ONLY — no API wired. Replace each TODO with a real call.
	// ============================================================

	// 1. Standard login
	async function handleLogin(e) {
		e?.preventDefault();
		error = '';
		successMsg = '';
		if (!email || !password) {
			error = 'Enter your email and password to continue.';
			return;
		}
		loading = true;
		// TODO: POST to your auth API. On success -> goto('/mould').
		await new Promise((r) => setTimeout(r, 700)); // simulated latency
		loading = false;
		error = 'Auth API not connected yet — this is the UI only.';
	}

	// 2. Forgot password — request a code
	async function handleForgotInit(e) {
		e?.preventDefault();
		error = '';
		successMsg = '';
		if (!email) {
			error = 'Enter your email to reset your password.';
			return;
		}
		loading = true;
		// TODO: POST /auth/forgot-password { email }
		await new Promise((r) => setTimeout(r, 600));
		loading = false;
		step = 'forgot_reset';
		successMsg = `If an account exists, a 6-digit code was sent to ${email}.`;
	}

	// 3. Forgot password — verify code + set new password
	async function handleForgotReset(e) {
		e?.preventDefault();
		error = '';
		successMsg = '';
		if (!otp || otp.length !== 6) {
			error = 'Enter the 6-digit verification code.';
			return;
		}
		const strong =
			newPassword.length >= 8 &&
			/[A-Z]/.test(newPassword) &&
			/[a-z]/.test(newPassword) &&
			/[^A-Za-z0-9]/.test(newPassword);
		if (!strong) {
			error = 'Password must be 8+ characters with an uppercase, a lowercase and a special character.';
			return;
		}
		loading = true;
		// TODO: POST /auth/reset-password { email, otp, new_password }
		await new Promise((r) => setTimeout(r, 700));
		loading = false;
		resetFormState();
		step = 'login';
		successMsg = 'Password updated. You can now sign in.';
	}

	// 4. OAuth
	function oauth(provider) {
		error = '';
		// TODO: kick off `${provider}` OAuth flow
		error = `${provider} sign-in isn't wired yet — UI only.`;
	}

	function goForgot() {
		step = 'forgot_init';
		resetFormState();
	}
	function goLogin() {
		step = 'login';
		resetFormState();
	}
</script>

<svelte:head>
	<title>Sign in — {site.name}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="auth">
	<!-- ---------- Brand panel ---------- -->
	<section class="brandside" aria-hidden="true">
		<!-- accent dots + sparkles -->
		<span class="d d1"></span>
		<span class="d d2"></span>
		<span class="d d3"></span>
		<span class="d d4"></span>
		<span class="spark s1">✦</span>
		<span class="spark s2">✦</span>

		<!-- teal two-part mould -->
		<svg class="mould" viewBox="0 0 120 90" fill="none" aria-hidden="true">
			<rect x="6" y="10" width="48" height="70" rx="8" stroke="var(--teal)" stroke-width="4" />
			<rect x="66" y="10" width="48" height="70" rx="8" stroke="var(--teal)" stroke-width="4" />
			<path d="M30 26c8 0 8 12 0 12s-8 14 0 14" stroke="var(--teal)" stroke-width="4" stroke-linecap="round" />
			<path d="M90 26c-8 0-8 12 0 12s8 14 0 14" stroke="var(--teal)" stroke-width="4" stroke-linecap="round" />
		</svg>

		<!-- coral gem -->
		<svg class="gem" viewBox="0 0 80 80" aria-hidden="true">
			<path d="M20 12h40l16 20-36 40L4 32z" fill="var(--coral)" opacity="0.95" />
			<path d="M20 12 40 32 60 12M4 32h72M40 32 24 72M40 32l16 40" stroke="#14161f" stroke-width="2" fill="none" opacity="0.25" />
		</svg>

		<div class="brandcopy">
			<span class="wordmark">Mould<b>Generator</b></span>
			<p>Turn 3D models into print-ready moulds for casting — free, and it runs in your browser.</p>
			<span class="powered">Powered by {site.poweredBy}</span>
		</div>
	</section>

	<!-- ---------- Form panel ---------- -->
	<section class="formside">
		<header class="topbar">
			<span class="wordmark small">Mould<b>Generator</b></span>
			<a class="home" href="/" aria-label="Back to home">
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
				</svg>
			</a>
		</header>

		<div class="formwrap">
			<span class="badge"><i class="bdot"></i> Makers’ workshop</span>

			{#if successMsg}
				<div class="success" role="status">
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
					<span>{successMsg}</span>
				</div>
			{/if}

			{#if step === 'login'}
				<h1 class="headline">Let’s get you <mark class="mark">casting.</mark></h1>
				<p class="sub">Sign in to your {site.name} account to save moulds, track prints, and jump back into the generator.</p>

				<form class="form" onsubmit={handleLogin} novalidate>
					<label class="field">
						<span class="lab">Email</span>
						<input type="email" autocomplete="email" placeholder="you@studio.in" bind:value={email} disabled={loading} />
					</label>

					<label class="field">
						<span class="lab">Password</span>
						<div class="pw">
							<input type={showPw ? 'text' : 'password'} autocomplete="current-password" placeholder="••••••••" bind:value={password} disabled={loading} />
							<button type="button" class="ghost" onclick={() => (showPw = !showPw)}>{showPw ? 'Hide' : 'Show'}</button>
						</div>
					</label>

					<div class="row">
						<label class="check"><input type="checkbox" bind:checked={remember} disabled={loading} /><span>Keep me signed in</span></label>
						<button type="button" class="textlink" onclick={goForgot} disabled={loading}>Forgot password?</button>
					</div>

					{#if error}<p class="error" role="alert">{error}</p>{/if}

					<button class="submit" type="submit" disabled={loading}>
						<span>{loading ? 'Signing in…' : 'Sign in'}</span>
						<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
					</button>

					<div class="divider"><span>or continue with</span></div>

					<div class="oauths">
						<button type="button" class="oauth" onclick={() => oauth('Google')} disabled={loading}>
							<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1A6.2 6.2 0 1 1 16.2 7l2.7-2.6A10 10 0 1 0 22 12c0-.7-.07-1.2-.17-1.8z" /></svg>
							Google
						</button>
						<button type="button" class="oauth" onclick={() => oauth('GitHub')} disabled={loading}>
							<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" /></svg>
							GitHub
						</button>
					</div>
				</form>

				<p class="foot">New to {site.name}? <a class="textlink" href="/signup">Create an account</a></p>

			{:else if step === 'forgot_init'}
				<h1 class="headline">Reset your <mark class="mark">password.</mark></h1>
				<p class="sub">Enter your email and we’ll send a 6-digit code to reset your password.</p>

				<form class="form" onsubmit={handleForgotInit} novalidate>
					<label class="field">
						<span class="lab">Email</span>
						<input type="email" autocomplete="email" placeholder="you@studio.in" bind:value={email} disabled={loading} />
					</label>

					{#if error}<p class="error" role="alert">{error}</p>{/if}

					<button class="submit" type="submit" disabled={loading}>
						<span>{loading ? 'Sending code…' : 'Send reset code'}</span>
						<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
					</button>
				</form>

				<button type="button" class="backlink" onclick={goLogin} disabled={loading}>← Back to sign in</button>

			{:else if step === 'forgot_reset'}
				<h1 class="headline">Create a new <mark class="mark">password.</mark></h1>
				<p class="sub">Enter the code sent to <b>{email}</b> and choose a new password.</p>

				<form class="form" onsubmit={handleForgotReset} novalidate>
					<label class="field">
						<span class="lab">Verification code</span>
						<input class="otp" type="text" autocomplete="one-time-code" placeholder="Enter 6-digit code" bind:value={otp} maxlength="6" disabled={loading} />
					</label>

					<label class="field">
						<span class="lab">New password</span>
						<div class="pw">
							<input type={showPw ? 'text' : 'password'} autocomplete="new-password" placeholder="At least 8 characters" bind:value={newPassword} disabled={loading} />
							<button type="button" class="ghost" onclick={() => (showPw = !showPw)}>{showPw ? 'Hide' : 'Show'}</button>
						</div>
					</label>

					{#if error}<p class="error" role="alert">{error}</p>{/if}

					<button class="submit" type="submit" disabled={loading}>
						<span>{loading ? 'Updating…' : 'Update password'}</span>
						<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
					</button>
				</form>

				<button type="button" class="backlink" onclick={goLogin} disabled={loading}>← Back to sign in</button>
			{/if}
		</div>
	</section>
</div>

<style>
	.auth {
		/* self-contained palette + fonts so it renders correctly regardless of globals */
		--ink: #14161f;
		--violet: #6c5ce7;
		--blue: #3b82f6;
		--coral: #ff7a66;
		--teal: #17b8a6;
		--pink: #ec6ec9;
		--amber: #f6b93b;
		--muted: #6b7180;
		--line: #e9eaee;
		--fd: 'Space Grotesk', system-ui, sans-serif;
		--fb: 'Inter', system-ui, sans-serif;
		--fm: 'Space Grotesk', ui-monospace, monospace;

		display: grid;
		grid-template-columns: 1.05fr 1fr;
		min-height: 100vh;
		font-family: var(--fb);
		color: var(--ink);
		background: #fff;
	}

	/* ---------- brand panel (flat, no gradients) ---------- */
	.brandside {
		position: relative;
		overflow: hidden;
		margin: 0.9rem 0 0.9rem 0.9rem;
		border-radius: 1.4rem;
		background: var(--ink);
	}
	.brandcopy {
		position: absolute;
		left: 2.2rem;
		right: 2.2rem;
		bottom: 2.2rem;
		z-index: 3;
		color: #fff;
	}
	.wordmark {
		font-family: var(--fd);
		font-weight: 700;
		font-size: 1.35rem;
		color: #fff;
		letter-spacing: -0.02em;
	}
	.wordmark b {
		font-weight: 500;
		color: #8b90a0;
	}
	.brandcopy p {
		margin: 0.7rem 0 0;
		max-width: 30ch;
		color: rgba(255, 255, 255, 0.72);
		font-size: 0.95rem;
		line-height: 1.55;
	}
	.powered {
		display: inline-block;
		margin-top: 1rem;
		font-family: var(--fm);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #fff;
		background: var(--coral);
		padding: 4px 11px;
		border-radius: 999px;
	}
	.mould {
		position: absolute;
		z-index: 2;
		width: 190px;
		top: 16%;
		left: 12%;
		opacity: 0.9;
	}
	.gem {
		position: absolute;
		z-index: 2;
		width: 92px;
		top: 30%;
		right: 16%;
		transform: rotate(8deg);
	}
	.d {
		position: absolute;
		border-radius: 50%;
		z-index: 1;
	}
	.d1 { width: 14px; height: 14px; background: var(--violet); top: 14%; right: 30%; }
	.d2 { width: 10px; height: 10px; background: var(--amber); top: 58%; left: 22%; }
	.d3 { width: 18px; height: 18px; background: var(--pink); bottom: 26%; right: 24%; }
	.d4 { width: 9px;  height: 9px;  background: var(--blue);  top: 24%; left: 40%; }
	.spark {
		position: absolute;
		z-index: 1;
		font-size: 1.3rem;
		color: var(--amber);
	}
	.s1 { top: 44%; right: 34%; color: var(--teal); }
	.s2 { bottom: 34%; left: 30%; }

	/* ---------- form panel ---------- */
	.formside {
		display: flex;
		flex-direction: column;
		padding: 2rem clamp(1.6rem, 4vw, 4.2rem);
	}
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.wordmark.small {
		font-size: 1.1rem;
		color: var(--ink);
	}
	.wordmark.small b { color: var(--muted); }
	.home {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		color: var(--ink);
		border: 2px solid var(--ink);
		background: #fff;
		transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease;
	}
	.home:hover {
		background: var(--ink);
		color: #fff;
		transform: translateX(-2px);
	}

	.formwrap {
		margin: auto 0;
		width: 100%;
		max-width: 400px;
		padding: 2rem 0;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--fm);
		font-size: 0.7rem;
		letter-spacing: 0.02em;
		padding: 0.4rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		color: #374151;
		margin-bottom: 1rem;
	}
	.bdot { width: 7px; height: 7px; border-radius: 50%; background: var(--violet); }

	.headline {
		font-family: var(--fd);
		font-weight: 700;
		font-size: clamp(1.9rem, 4vw, 2.6rem);
		line-height: 1.05;
		letter-spacing: -0.03em;
		margin: 0 0 0.6rem;
	}
	.mark {
		background: var(--amber);
		color: var(--ink);
		padding: 0 0.14em;
		border-radius: 0.16em;
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}
	.sub {
		color: var(--muted);
		font-size: 0.97rem;
		line-height: 1.55;
		margin: 0 0 1.7rem;
	}

	.form { display: flex; flex-direction: column; gap: 1rem; }
	.field { display: flex; flex-direction: column; gap: 0.4rem; }
	.lab {
		font-family: var(--fm);
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #475569;
	}
	input[type='email'],
	input[type='password'],
	input[type='text'] {
		width: 100%;
		box-sizing: border-box;
		font-family: var(--fb);
		font-size: 0.97rem;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--line);
		border-radius: 0.7rem;
		background: #fbfbfd;
		color: var(--ink);
		transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
	}
	input:focus {
		outline: none;
		background: #fff;
		border-color: var(--violet);
		box-shadow: 0 0 0 4px rgba(108, 92, 231, 0.15);
	}
	.otp {
		text-transform: uppercase;
		letter-spacing: 0.25em;
		font-weight: 600;
	}
	.pw { position: relative; }
	.pw input { padding-right: 4rem; }
	.ghost {
		position: absolute;
		right: 0.55rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		cursor: pointer;
		font-family: var(--fm);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--violet);
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.86rem;
	}
	.check { display: flex; align-items: center; gap: 0.45rem; color: #374151; cursor: pointer; }
	.check input { accent-color: var(--violet); width: 15px; height: 15px; }
	.textlink {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: var(--violet);
		font-weight: 500;
		font-size: 0.86rem;
		font-family: inherit;
		text-decoration: none;
	}
	.textlink:hover { text-decoration: underline; }
	.error { margin: 0; font-size: 0.85rem; color: #dc2626; }

	.submit {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-family: var(--fb);
		font-weight: 600;
		font-size: 0.97rem;
		color: #fff;
		background: var(--violet);
		border: none;
		border-radius: 0.75rem;
		padding: 0.92rem;
		cursor: pointer;
		transition: transform 0.15s, box-shadow 0.2s, background 0.2s;
	}
	.submit:hover:not(:disabled) {
		background: #5a4bd4;
		box-shadow: 0 10px 22px -10px rgba(108, 92, 231, 0.7);
	}
	.submit:hover:not(:disabled) svg { transform: translateX(3px); }
	.submit svg { transition: transform 0.15s; }
	.submit:disabled { opacity: 0.65; cursor: progress; }

	.divider {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		color: #9aa1af;
		font-size: 0.78rem;
		margin: 0.2rem 0;
	}
	.divider::before,
	.divider::after { content: ''; flex: 1; height: 1px; background: var(--line); }

	.oauths { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
	.oauth {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-family: var(--fb);
		font-weight: 500;
		font-size: 0.92rem;
		background: #fff;
		border: 1px solid var(--line);
		border-radius: 0.75rem;
		padding: 0.8rem;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}
	.oauth:hover { border-color: #cfd3df; background: #fafafc; }
	.oauth:disabled { opacity: 0.65; cursor: progress; }

	.success {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		background: #e9fbf7;
		border: 1px solid #a9ede2;
		color: #0c6b5e;
		padding: 0.8rem;
		border-radius: 0.6rem;
		font-size: 0.88rem;
		line-height: 1.4;
		margin-bottom: 1.4rem;
		font-weight: 500;
	}
	.success svg { color: var(--teal); flex-shrink: 0; margin-top: 2px; }

	.foot { margin: 1.5rem 0 0; font-size: 0.9rem; color: var(--muted); }
	.backlink {
		margin-top: 1.3rem;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		color: var(--muted);
		font-size: 0.9rem;
		font-weight: 500;
		transition: color 0.15s;
	}
	.backlink:hover { color: var(--ink); }

	/* ---------- responsive ---------- */
	@media (max-width: 900px) {
		.auth { grid-template-columns: 1fr; }
		.brandside { margin: 0.9rem; min-height: 300px; }
		.formwrap { margin: 0 auto; padding: 1.5rem 0 2.5rem; }
	}
	@media (prefers-reduced-motion: reduce) {
		.submit, .submit svg, .home { transition: none; }
	}
</style>