<script>
	import { onMount } from 'svelte';
	import { PUBLIC_API_BASE_URL, PUBLIC_CLOUDFLARE_KEY } from '$env/static/public';

	const API = PUBLIC_API_BASE_URL;

	let name = $state('');
	let email = $state('');
	let subject = $state('General question');
	let message = $state('');
	let loading = $state(false);
	let sent = $state(false);
	let error = $state('');

	// --- Turnstile state ---
	let token = $state('');
	let turnstileEl = $state(null); // bound to the widget container
	let scriptReady = $state(false);
	let widgetId;

	const subjects = ['General question', 'Print my mould (Navi3D)', 'Premium & billing', 'Bug or feedback', 'Partnership'];

	// Load the Turnstile script once (client-side only).
	onMount(() => {
		if (window.turnstile) {
			scriptReady = true;
			return;
		}
		const s = document.createElement('script');
		s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		s.async = true;
		s.defer = true;
		s.onload = () => (scriptReady = true);
		document.head.appendChild(s);
	});

	// (Re)render the widget whenever the container is in the DOM and the script
	// is ready. This also handles the "Send another" case, where the form —
	// and thus the container — is re-created after a successful send.
	$effect(() => {
		if (scriptReady && turnstileEl && window.turnstile) {
			try { if (widgetId !== undefined) window.turnstile.remove(widgetId); } catch (_) {}
			widgetId = window.turnstile.render(turnstileEl, {
				sitekey: PUBLIC_CLOUDFLARE_KEY,
				callback: (t) => (token = t),
				'expired-callback': () => (token = ''),
				'error-callback': () => (token = '')
			});
		}
	});

	function resetTurnstile() {
		token = '';
		try { if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId); } catch (_) {}
	}

	async function submit(e) {
		e.preventDefault();
		error = '';
		if (!name || !email || !message) {
			error = 'Please fill in your name, email and a message.';
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
				body: JSON.stringify({ name, email, subject, message, cf_turnstile_response: token })
			});
			const data = await res.json().catch(() => null);
			if (!res.ok || (data && data.status === 'error'))
				throw new Error((data && data.message) || 'Could not send your message. Please try again.');
			sent = true;
		} catch (err) {
			error = err && err.message ? err.message : 'Something went wrong. Please try again.';
			resetTurnstile(); // tokens are single-use — refresh for the retry
		} finally {
			loading = false;
		}
	}

	const cards = [
		{
			c: '#6c5ce7',
			t: '#efecfd',
			title: 'Email us',
			body: 'hello@mouldgenerator.in',
			href: 'mailto:hello@mouldgenerator.in',
			cta: 'Send an email',
			icon: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/>'
		},
		{
			c: '#ff7a66',
			t: '#ffeee9',
			title: 'Print my mould',
			body: 'No printer? Navi3D prints and ships it in FDM or SLA.',
			href: '/mould',
			cta: 'Open the generator →',
			icon: '<rect x="6" y="3" width="12" height="7" rx="1"/><rect x="4" y="10" width="16" height="7" rx="2"/><rect x="7" y="15" width="10" height="6" rx="1"/><circle cx="17" cy="13" r="1"/>'
		},
		{
			c: '#17b8a6',
			t: '#e3f7f4',
			title: 'Navi3D studio',
			body: 'Vashi, Navi Mumbai, India · Mon–Sat',
			href: '',
			cta: '',
			icon: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>'
		}
	];
</script>

<svelte:head>
	<title>Contact — Mould Generator</title>
	<meta name="description" content="Get in touch with the Mould Generator team — questions, Premium, bugs, or having Navi3D print your mould. Powered by Navi3D." />
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
				<div class="done">
					<span class="tick">
						<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6" /></svg>
					</span>
					<h2>Message sent</h2>
					<p>Thanks, {name || 'there'} — we've got your message and will reply to {email || 'your email'} soon.</p>
					<button class="btn btn-outline" onclick={() => { sent = false; name = ''; email = ''; message = ''; token = ''; }}>Send another</button>
				</div>
			{:else}
				<form class="cf-form" onsubmit={submit}>
					{#if error}<p class="cf-error">{error}</p>{/if}

					<div class="cf-two">
						<div class="cf-field">
							<label class="cf-label" for="name">Name</label>
							<input class="cf-input" id="name" type="text" autocomplete="name" placeholder="Your name" bind:value={name} />
						</div>
						<div class="cf-field">
							<label class="cf-label" for="email">Email</label>
							<input class="cf-input" id="email" type="email" autocomplete="email" placeholder="you@example.com" bind:value={email} />
						</div>
					</div>

					<div class="cf-field">
						<label class="cf-label" for="subject">Subject</label>
						<select class="cf-input" id="subject" bind:value={subject}>
							{#each subjects as s}<option>{s}</option>{/each}
						</select>
					</div>

					<div class="cf-field">
						<label class="cf-label" for="message">Message</label>
						<textarea class="cf-input cf-area" id="message" rows="5" placeholder="Tell us what you need…" bind:value={message}></textarea>
					</div>

					<!-- Cloudflare Turnstile -->
					<div class="cf-turnstile-box" bind:this={turnstileEl}></div>

					<button class="btn btn-accent cf-btn" type="submit" style="--btn: var(--coral)" disabled={loading}>
						{loading ? 'Sending…' : 'Send message →'}
					</button>
					<p class="cf-note">Powered by Navi3D · we never share your email.</p>
				</form>
			{/if}
		</div>

		<!-- info -->
		<aside class="info">
			{#each cards as k}
				<div class="ic" style="--c: {k.c}; --t: {k.t}">
					<span class="ic-icon">
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{@html k.icon}</svg>
					</span>
					<h3>{k.title}</h3>
					<p>{k.body}</p>
					{#if k.href && k.cta}
						<a class="ic-link" href={k.href}>{k.cta}</a>
					{/if}
				</div>
			{/each}
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
		margin-bottom: 10px;
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
	}
</style>

