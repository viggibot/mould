<script>
	import { onMount } from 'svelte';
	import { PUBLIC_API_BASE_URL, PUBLIC_CLOUDFLARE_KEY } from '$env/static/public';

	const API = PUBLIC_API_BASE_URL;

	const SUPPORT_EMAIL = 'support@akritio.com';
	const SALES_EMAIL = 'sales@akritio.com';
	const NAVI3D_URL = 'https://navi3d.in';
	const STUDIO_ADDRESS = 'Triveni Building, B-19, Juhu Nagar, Sector 15, Vashi, Navi Mumbai 400703';
	const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(STUDIO_ADDRESS);
	const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	const subjects = ['General question', 'Print my mould (Navi3D)', 'Premium & billing', 'Bug or feedback', 'Partnership'];
	const salesSubjects = ['Premium & billing', 'Partnership'];

	let name = $state('');
	let email = $state('');
	let subject = $state(subjects[0]);
	let message = $state('');
	let loading = $state(false);
	let sent = $state(false);
	let error = $state('');

	let isSales = $derived(salesSubjects.includes(subject));

	// --- Turnstile state ---
	let token = $state('');
	let turnstileEl = $state(null); // bound to the widget container
	let scriptReady = $state(false);
	let widgetId;

	// Load the Turnstile script once (client-side only). Re-uses an existing
	// <script> tag if the user navigated away and back before it finished loading.
	onMount(() => {
		if (window.turnstile) {
			scriptReady = true;
			return;
		}
		const onLoad = () => (scriptReady = true);
		let s = document.querySelector(`script[src="${TURNSTILE_SRC}"]`);
		if (!s) {
			s = document.createElement('script');
			s.src = TURNSTILE_SRC;
			s.async = true;
			s.defer = true;
			document.head.appendChild(s);
		}
		s.addEventListener('load', onLoad);
		return () => s.removeEventListener('load', onLoad);
	});

	// Render the widget whenever the container exists and the script is ready.
	// The cleanup removes it when the form unmounts (after a successful send),
	// and it re-renders cleanly when "Send another" brings the form back.
	$effect(() => {
		if (!scriptReady || !turnstileEl || !window.turnstile) return;
		const id = window.turnstile.render(turnstileEl, {
			sitekey: PUBLIC_CLOUDFLARE_KEY,
			theme: 'light',
			callback: (t) => (token = t),
			'expired-callback': () => (token = ''),
			'error-callback': () => (token = '')
		});
		widgetId = id;
		return () => {
			try { window.turnstile.remove(id); } catch (_) {}
			if (widgetId === id) widgetId = undefined;
		};
	});

	function resetTurnstile() {
		token = '';
		try { if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId); } catch (_) {}
	}

	function resetForm() {
		sent = false;
		name = '';
		email = '';
		subject = subjects[0];
		message = '';
		error = '';
		token = '';
	}

	async function submit(e) {
		e.preventDefault();
		error = '';

		const n = name.trim();
		const em = email.trim();
		const msg = message.trim();

		if (!n || !em || !msg) {
			error = 'Please fill in your name, email and a message.';
			return;
		}
		if (!EMAIL_RE.test(em)) {
			error = 'That email address doesn’t look right — please check it.';
			return;
		}
		if (!token) {
			error = 'Please complete the verification below.';
			return;
		}

		loading = true;
		try {
			const res = await fetch(`${API}/contact/akritio`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: n, email: em, subject, message: msg, cf_turnstile_response: token })
			});
			const data = await res.json().catch(() => null);
			if (!res.ok || (data && data.status === 'error'))
				throw new Error((data && data.message) || 'Could not send your message. Please try again.');
			name = n;
			email = em;
			sent = true;
		} catch (err) {
			error = err && err.message ? err.message : 'Something went wrong. Please try again.';
			resetTurnstile(); // tokens are single-use — refresh for the retry
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Contact — Akritio</title>
	<meta
		name="description"
		content="Get in touch with the Akritio team — questions, Premium and billing, bugs, or having Navi3D print your mould. Email support@akritio.com or sales@akritio.com."
	/>
</svelte:head>

<section class="wrap container">
	<header class="head">
		<p class="eyebrow" style="--tint: var(--coral-t); --tint-ink: var(--coral)">Contact</p>
		<h1>Let's talk <span class="mark">moulds</span></h1>
		<p class="sub">
			Questions about the generator, Premium, or having Navi3D print your mould? Send a message and
			we'll get back to you, usually within one business day.
		</p>
	</header>

	<div class="grid">
		<!-- form -->
		<div class="form-card">
			{#if sent}
				<div class="done" role="status">
					<span class="tick">
						<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
					</span>
					<h2>Message sent</h2>
					<p>Thanks, {name || 'there'} — we've got your message and will reply to {email || 'your email'} soon.</p>
					<button class="btn btn-outline" type="button" onclick={resetForm}>Send another</button>
				</div>
			{:else}
				<form class="cf-form" onsubmit={submit} novalidate>
					{#if error}<p class="cf-error" role="alert">{error}</p>{/if}

					<div class="cf-two">
						<div class="cf-field">
							<label class="cf-label" for="name">Name</label>
							<input class="cf-input" id="name" type="text" autocomplete="name" placeholder="Your name" maxlength="120" required bind:value={name} />
						</div>
						<div class="cf-field">
							<label class="cf-label" for="email">Email</label>
							<input class="cf-input" id="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" maxlength="200" required bind:value={email} />
						</div>
					</div>

					<div class="cf-field">
						<label class="cf-label" for="subject">Subject</label>
						<select class="cf-input" id="subject" bind:value={subject}>
							{#each subjects as s}<option value={s}>{s}</option>{/each}
						</select>
						{#if isSales}
							<p class="cf-hint">
								For billing and partnerships you can also email
								<a href="mailto:{SALES_EMAIL}">{SALES_EMAIL}</a> directly.
							</p>
						{/if}
					</div>

					<div class="cf-field">
						<label class="cf-label" for="message">Message</label>
						<textarea class="cf-input cf-area" id="message" rows="5" placeholder="Tell us what you need…" maxlength="5000" required bind:value={message}></textarea>
					</div>

					<!-- Cloudflare Turnstile -->
					<div class="cf-turnstile-box" bind:this={turnstileEl}></div>

					<button class="btn btn-accent cf-btn" type="submit" style="--btn: var(--coral)" disabled={loading} aria-busy={loading}>
						{loading ? 'Sending…' : 'Send message →'}
					</button>
					<p class="cf-note">Powered by Navi3D · we never share your email.</p>
				</form>
			{/if}
		</div>

		<!-- info -->
		<aside class="info">
			<!-- Email -->
			<div class="ic" style="--c: #6c5ce7; --t: #efecfd">
				<span class="ic-icon">
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M4 7l8 6 8-6" /></svg>
				</span>
				<h3>Email us</h3>
				<ul class="ic-mails">
					<li>
						<span class="ic-tag">Support</span>
						<a class="ic-mail" href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>
					</li>
					<li>
						<span class="ic-tag">Sales</span>
						<a class="ic-mail" href="mailto:{SALES_EMAIL}?subject=Sales%20enquiry">{SALES_EMAIL}</a>
					</li>
				</ul>
				<p class="ic-small">Support for help with the generator and bugs. Sales for Premium, billing and partnerships.</p>
			</div>

			<!-- Print my mould -->
			<div class="ic" style="--c: #ff7a66; --t: #ffeee9">
				<span class="ic-icon">
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="12" height="7" rx="1" /><rect x="4" y="10" width="16" height="7" rx="2" /><rect x="7" y="15" width="10" height="6" rx="1" /><circle cx="17" cy="13" r="1" /></svg>
				</span>
				<h3>Print my mould</h3>
				<p>No printer? Navi3D prints and ships it in FDM or SLA.</p>
				<div class="ic-actions">
					<a class="ic-btn" href={NAVI3D_URL} target="_blank" rel="noopener noreferrer">
						Print with Navi3D
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7" /><path d="M8 7h9v9" /></svg>
					</a>
					<a class="ic-link" href="/mould">Open the generator →</a>
				</div>
			</div>

			<!-- Studio -->
			<div class="ic" style="--c: #17b8a6; --t: #e3f7f4">
				<span class="ic-icon">
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
				</span>
				<h3>Navi3D studio</h3>
				<p>Sector 15, Vashi, Navi Mumbai, India · Mon–Sat</p>
				<a class="ic-link" href={MAPS_URL} target="_blank" rel="noopener noreferrer">Get directions ↗</a>
			</div>
		</aside>
	</div>
</section>

<style>
	.wrap {
		padding-block: clamp(48px, 7vw, 88px) var(--space-section);
	}
	.head {
		max-width: 640px;
		margin-bottom: 44px;
	}
	.head h1 {
		font-size: clamp(2.2rem, 5vw, 3.4rem);
		margin-bottom: 16px;
	}
	.sub {
		font-size: 1.12rem;
		color: var(--slate);
	}
	.grid {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 24px;
		align-items: start;
	}

	/* form */
	.form-card {
		background: #fff;
		border: 1.5px solid var(--line);
		border-radius: var(--radius);
		padding: clamp(24px, 4vw, 36px);
		box-shadow: var(--shadow-md);
	}
	.cf-form {
		display: grid;
		gap: 16px;
	}
	.cf-two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	.cf-field {
		display: grid;
		gap: 7px;
		min-width: 0;
	}
	.cf-label {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--ink);
	}
	.cf-input {
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
	.cf-input::placeholder {
		color: #a9b0bd;
	}
	.cf-input:focus {
		outline: none;
		border-color: var(--coral);
		box-shadow: 0 0 0 4px var(--coral-t);
	}
	.cf-area {
		resize: vertical;
		min-height: 120px;
		line-height: 1.6;
	}
	.cf-hint {
		margin: 0;
		font-size: 0.84rem;
		color: var(--slate);
	}
	.cf-hint a {
		color: #6c5ce7;
		font-weight: 600;
	}
	.cf-hint a:hover {
		text-decoration: underline;
	}
	.cf-turnstile-box {
		min-height: 65px;
	}
	.cf-btn {
		width: 100%;
		justify-content: center;
		margin-top: 4px;
		font-size: 1rem;
		padding: 14px 24px;
	}
	.cf-btn:disabled {
		opacity: 0.7;
		cursor: progress;
	}
	.cf-note {
		text-align: center;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		color: var(--slate-2);
		margin: 0;
	}
	.cf-error {
		background: #fff0ee;
		border: 1.5px solid #ffc9bf;
		color: #b93a25;
		border-radius: 10px;
		padding: 11px 13px;
		font-size: 0.88rem;
		margin: 0;
	}

	/* success */
	.done {
		text-align: center;
		padding: 20px 8px;
	}
	.tick {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--teal);
		margin-bottom: 16px;
	}
	.done h2 {
		font-size: 1.5rem;
		margin-bottom: 8px;
	}
	.done p {
		color: var(--slate);
		margin-bottom: 20px;
	}

	/* info cards */
	.info {
		display: grid;
		gap: 14px;
	}
	.ic {
		background: #fff;
		border: 1.5px solid var(--line);
		border-top: 4px solid var(--c);
		border-radius: 18px;
		padding: 22px;
	}
	.ic-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: var(--t);
		color: var(--c);
		margin-bottom: 12px;
	}
	.ic h3 {
		font-size: 1.1rem;
		margin-bottom: 6px;
	}
	.ic p {
		color: var(--slate);
		font-size: 0.95rem;
		margin-bottom: 12px;
	}

	/* email rows */
	.ic-mails {
		list-style: none;
		margin: 4px 0 12px;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.ic-mails li {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.ic-tag {
		display: inline-block;
		min-width: 64px;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--c);
		background: var(--t);
		border-radius: 999px;
		padding: 4px 10px;
	}
	.ic-mail {
		font-weight: 600;
		font-size: 0.96rem;
		color: var(--ink);
		overflow-wrap: anywhere;
	}
	.ic-mail:hover {
		color: var(--c);
		text-decoration: underline;
	}
	.ic .ic-small {
		font-size: 0.85rem;
		margin-bottom: 0;
	}

	/* actions */
	.ic-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px 18px;
	}
	.ic-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: var(--c);
		color: #fff;
		font-weight: 600;
		font-size: 0.92rem;
		padding: 11px 18px;
		border-radius: 999px;
		text-decoration: none;
		transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
	}
	.ic-btn:hover {
		filter: brightness(0.95);
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(255, 122, 102, 0.32);
	}
	.ic-btn:focus-visible {
		outline: 3px solid var(--t);
		outline-offset: 2px;
	}
	.ic-link {
		font-weight: 600;
		font-size: 0.92rem;
		color: var(--c);
	}
	.ic-link:hover {
		text-decoration: underline;
	}

	@media (max-width: 820px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 460px) {
		.cf-two {
			grid-template-columns: 1fr;
		}
		.ic-btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>