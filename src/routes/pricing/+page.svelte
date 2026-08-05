<script>
	import { reveal } from '$lib/actions/reveal.js';
	import { site } from '$lib/content.js';
	import { goto } from '$app/navigation';
	import { fade, scale } from 'svelte/transition';

	let { data } = $props(); // { currency: 'INR' | 'USD' } from +page.server.js

	// Selected currency starts from server detection; user can switch.
	let currency = $state(data?.currency ?? 'USD');
	const symbols = { INR: '₹', USD: '$' };

	// Rust backend base URL. Change to your API origin (or import from $env/static/public).
	const API_BASE = 'https://api.navi3d.in';

	// Display prices only. The server (akritio_create_order) owns the real amounts.
	const plans = [
		{
			name: 'Free', id: 'free', tagline: 'Try the full studio', accent: 'var(--teal)',
			price: { INR: 0, USD: 0 }, cta: 'Start free', href: '/mould', featured: false, soon: false,
			features: [
				'Full 3D mould studio', 'STL · OBJ · 3MF · STEP upload', 'Up to 3 mould exports / month',
				'Block & 2-part moulds', 'Watermark-free STL'
			]
		},
		{
			name: 'Pro', id: 'pro', tagline: 'For makers shipping regularly', accent: 'var(--violet)',
			price: { INR: 680, USD: 9 }, cta: 'Subscribe to Pro', href: '/signup?plan=pro', featured: true, soon: false,
			features: [
				'Everything in Free', 'Unlimited mould exports', 'Multi-part radial (4 & 6-part) moulds',
				'Silicone jacket moulds', '±0.01 mm cavity precision', 'Priority email support'
			]
		},
		{
			name: 'Studio', id: 'studio', tagline: 'Built-in STL editor & more', accent: 'var(--coral)',
			price: null, cta: 'Coming soon', href: null, featured: false, soon: true,
			features: [
				'Everything in Pro', 'Built-in STL editor', 'Team seats', 'Batch mould generation', 'Shared project library'
			]
		}
	];

	function display(p) {
		if (p.soon) return 'Soon';
		const v = p.price[currency];
		return v === 0 ? 'Free' : `${symbols[currency]}${v}`;
	}

	// ===== Payment state =====
	let paying = $state(false);
	let payError = $state('');

	// International cards-only modal
	let modalOpen = $state(false);
	let modalPlan = $state(null);
	let modalOrder = $state(null); // { orderId, amount, currency, keyId }
	let sdkReady = $state(false);
	let processing = $state(false);

	// Card form
	let cardName = $state('');
	let cardNumber = $state('');
	let expiry = $state('');
	let cvv = $state('');
	let email = $state('');
	let contact = $state('');
	let line1 = $state('');
	let line2 = $state('');
	let city = $state('');
	let region = $state('');
	let postal = $state('');
	let country = $state('');
	let focusedField = $state('');
	let errors = $state({});

	const countries = [
		['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'],
		['DE', 'Germany'], ['FR', 'France'], ['SG', 'Singapore'], ['AE', 'United Arab Emirates'],
		['JP', 'Japan'], ['NL', 'Netherlands'], ['NZ', 'New Zealand'], ['IN', 'India']
	];

	let brand = $derived(detectBrand(cardNumber));
	let cvvMax = $derived(brand === 'amex' ? 4 : 3);
	let previewNumber = $derived(cardNumber || '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022');
	let previewExpiry = $derived(expiry || 'MM/YY');
	let previewName = $derived(cardName || 'CARDHOLDER NAME');
	let previewCvv = $derived(cvv || '\u2022\u2022\u2022');
	let flipped = $derived(focusedField === 'cvv');
	let modalAmount = $derived(modalPlan ? display(modalPlan) : '');

	// ===== Razorpay SDK (swaps between standard + custom) =====
	let currentSdk = null;
	function loadSdk(kind) {
		return new Promise((resolve, reject) => {
			if (typeof window === 'undefined') return reject(new Error('SSR'));
			if (currentSdk === kind && window.Razorpay) return resolve();
			document.querySelectorAll('script[data-rzp-sdk]').forEach((s) => s.remove());
			const src =
				kind === 'standard'
					? 'https://checkout.razorpay.com/v1/checkout.js'
					: 'https://checkout.razorpay.com/v1/razorpay.js';
			const s = document.createElement('script');
			s.src = src;
			s.async = true;
			s.dataset.rzpSdk = kind;
			s.onload = () => { currentSdk = kind; resolve(); };
			s.onerror = () => reject(new Error('Failed to load Razorpay SDK.'));
			document.head.appendChild(s);
		});
	}

	// ===== Backend calls (Rust handler) =====
	async function apiCreateOrder(planId) {
		const res = await fetch(`${API_BASE}/akritio/order/create`, {
			method: 'POST',
			credentials: 'include', // sends the auth cookie; add an Authorization header here if you use bearer tokens
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ plan: planId, currency })
		});
		if (!res.ok) throw new Error('order');
		return await res.json(); // { orderId, amount, currency, keyId }
	}
	async function apiVerify(resp) {
		const res = await fetch(`${API_BASE}/akritio/payment/verify`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(resp)
		});
		if (!res.ok) throw new Error('verify');
		return await res.json();
	}

	// ===== Flow =====
	async function startCheckout(p) {
		payError = '';
		if (p.soon) return;
		if (!p.price || p.price[currency] === 0) {
			if (p.href) goto(p.href);
			return;
		}
		if (paying) return;
		paying = true;
		try {
			const order = await apiCreateOrder(p.id);

			if (currency === 'INR') {
				// DOMESTIC → Standard Checkout: UPI, cards, netbanking, wallets, EMI.
				await loadSdk('standard');
				const violet =
					getComputedStyle(document.documentElement).getPropertyValue('--violet').trim() || '#6C54E4';
				const rzp = new window.Razorpay({
					key: order.keyId,
					order_id: order.orderId,
					amount: order.amount,
					currency: order.currency,
					name: 'Akritio',
					description: `${p.name} plan`,
					theme: { color: violet },
					handler: (resp) => { paying = false; onPaid(p, resp); },
					modal: { ondismiss: () => (paying = false) }
				});
				rzp.on('payment.failed', (resp) => {
					paying = false;
					payError = (resp && resp.error && resp.error.description) || 'Payment failed.';
				});
				rzp.open();
			} else {
				// INTERNATIONAL → cards-only modal (Custom Checkout).
				modalPlan = p;
				modalOrder = order;
				modalOpen = true;
				paying = false;
			}
		} catch (e) {
			paying = false;
			payError = 'Could not start checkout. Please try again.';
		}
	}

	async function onPaid(plan, resp) {
		try {
			await apiVerify(resp);
			goto('/welcome'); // TODO: your post-payment destination
		} catch (e) {
			payError = 'Payment received but verification failed — please contact support.';
		}
	}

	// Lock scroll + preload the custom SDK while the modal is open, so pay() can call
	// createPayment synchronously (an await between click and createPayment gets the
	// 3-D Secure popup blocked).
	$effect(() => {
		if (typeof document === 'undefined') return;
		if (modalOpen) {
			payError = '';
			sdkReady = false;
			document.body.style.overflow = 'hidden';
			loadSdk('custom').then(() => (sdkReady = true)).catch(() => (payError = 'Could not load the payment library.'));
		} else {
			document.body.style.overflow = '';
		}
		return () => { document.body.style.overflow = ''; };
	});

	function pay() {
		payError = '';
		if (!validate()) { payError = 'Fix the highlighted fields to continue.'; return; }
		if (!modalOrder) { payError = 'Session expired. Close and try again.'; return; }
		if (!sdkReady || !window.Razorpay) { payError = 'Still loading — try again in a moment.'; return; }
		processing = true;
		const rzp = new window.Razorpay({ key: modalOrder.keyId });
		rzp.on('payment.success', (resp) => { processing = false; modalOpen = false; onPaid(modalPlan, resp); });
		rzp.on('payment.error', (resp) => {
			processing = false;
			payError = (resp && resp.error && resp.error.description) || 'Payment could not be completed.';
		});
		const [mm, yy] = expiry.split('/');
		rzp.createPayment({
			amount: modalOrder.amount,
			currency: modalOrder.currency,
			order_id: modalOrder.orderId,
			email,
			contact,
			method: 'card',
			'card[name]': cardName,
			'card[number]': cardNumber.replace(/\s/g, ''),
			'card[cvv]': cvv,
			'card[expiry_month]': mm,
			'card[expiry_year]': yy,
			billing_address: { line1, line2, city, state: region, postal_code: postal, country }
		});
	}

	function closeModal() {
		if (processing) return;
		modalOpen = false;
	}
	function onOverlayKey(e) {
		if (e.key === 'Escape') closeModal();
	}

	// ===== Card helpers =====
	function detectBrand(value) {
		const n = value.replace(/\D/g, '');
		if (/^4/.test(n)) return 'visa';
		if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/.test(n)) return 'mastercard';
		if (/^3[47]/.test(n)) return 'amex';
		if (/^(6011|65|64[4-9]|622)/.test(n)) return 'discover';
		if (/^3(0[0-5]|[68])/.test(n)) return 'diners';
		if (/^35/.test(n)) return 'jcb';
		return 'generic';
	}
	function groupsFor(b) {
		if (b === 'amex') return [4, 6, 5];
		if (b === 'diners') return [4, 6, 4];
		return [4, 4, 4, 4];
	}
	function formatCardNumber(raw, b) {
		const max = b === 'amex' || b === 'diners' ? 15 : 16;
		const digits = raw.replace(/\D/g, '').slice(0, max);
		const groups = groupsFor(b);
		const out = [];
		let i = 0;
		for (const g of groups) {
			if (i >= digits.length) break;
			out.push(digits.slice(i, i + g));
			i += g;
		}
		return out.join(' ');
	}
	function luhnValid(value) {
		const d = value.replace(/\D/g, '');
		if (!d) return false;
		let sum = 0, alt = false;
		for (let i = d.length - 1; i >= 0; i--) {
			let n = +d[i];
			if (alt) { n *= 2; if (n > 9) n -= 9; }
			sum += n; alt = !alt;
		}
		return sum % 10 === 0;
	}
	function onCardInput(e) {
		cardNumber = formatCardNumber(e.currentTarget.value, detectBrand(e.currentTarget.value));
		errors = { ...errors, cardNumber: '' };
	}
	function onExpiryInput(e) {
		let v = e.currentTarget.value.replace(/\D/g, '').slice(0, 4);
		if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
		expiry = v;
		errors = { ...errors, expiry: '' };
	}
	function onCvvInput(e) {
		cvv = e.currentTarget.value.replace(/\D/g, '').slice(0, cvvMax);
		errors = { ...errors, cvv: '' };
	}
	function validate() {
		const next = {};
		if (!cardName.trim()) next.cardName = 'Enter the name on the card.';
		const digits = cardNumber.replace(/\s/g, '');
		const okLen = brand === 'amex' || brand === 'diners' ? digits.length === 15 : digits.length === 16;
		if (!okLen || !luhnValid(digits)) next.cardNumber = 'Enter a valid card number.';
		const [mm, yy] = (expiry || '').split('/');
		const m = Number(mm), y = Number(yy);
		if (!mm || !yy || m < 1 || m > 12) next.expiry = 'Use MM/YY.';
		else if (new Date(2000 + y, m, 0, 23, 59, 59) < new Date()) next.expiry = 'This card has expired.';
		if (cvv.length !== cvvMax) next.cvv = 'Check the security code.';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email.';
		if (!contact.trim()) next.contact = 'Add a phone number with country code.';
		if (!line1.trim()) next.line1 = 'Billing address is required.';
		if (!city.trim()) next.city = 'Enter a city.';
		if (!postal.trim()) next.postal = 'Enter a postal code.';
		if (!country) next.country = 'Select a country.';
		errors = next;
		return Object.keys(next).length === 0;
	}
</script>

<svelte:head>
	<title>Pricing — Akritio</title>
	<meta name="description" content="Akritio pricing. Start free or subscribe to Pro for unlimited casting-mould exports. Cancel anytime." />
</svelte:head>

<svelte:window onkeydown={modalOpen ? onOverlayKey : undefined} />

<section class="pricing">
	<div class="container">
		<header class="head">
			<p class="eyebrow" use:reveal>Pricing</p>
			<h1 use:reveal={{ delay: 60 }}>
				Start free. <span class="mark">Go Pro when you scale.</span>
			</h1>
			<p class="lede" use:reveal={{ delay: 140 }}>
				Every plan runs the full mould studio in your browser. Upgrade to Pro for unlimited exports
				and multi-part moulds.
			</p>

			<div class="cur" use:reveal={{ delay: 200 }} role="group" aria-label="Currency">
				<button class:active={currency === 'INR'} onclick={() => (currency = 'INR')} type="button">₹ INR</button>
				<button class:active={currency === 'USD'} onclick={() => (currency = 'USD')} type="button">$ USD</button>
			</div>
		</header>

		<div class="cards" use:reveal={{ delay: 260 }}>
			{#each plans as p}
				<article class="card" class:featured={p.featured} class:soon={p.soon} style="--accent: {p.accent}">
					{#if p.featured}<span class="badge">Most popular</span>{/if}
					{#if p.soon}<span class="badge soon-badge">Coming soon</span>{/if}

					<h2 class="plan">{p.name}</h2>
					<p class="tag">{p.tagline}</p>

					<div class="price">
						<span class="amount">{display(p)}</span>
						{#if !p.soon && p.price[currency] !== 0}<span class="per">/ mo</span>{/if}
					</div>

					{#if p.soon}
						<p class="billed">Launching soon</p>
					{:else if p.price[currency] !== 0}
						<p class="billed">Billed monthly · cancel anytime</p>
					{:else}
						<p class="billed">No card required</p>
					{/if}

					{#if p.soon}
						<span class="btn plan-cta btn-disabled" aria-disabled="true">{p.cta}</span>
					{:else if p.price[currency] === 0}
						<a class="btn plan-cta btn-outline" href={p.href} style="--btn: {p.accent}">{p.cta}</a>
					{:else}
						<button class="btn plan-cta" class:btn-accent={p.featured} class:btn-outline={!p.featured}
							style="--btn: {p.accent}" type="button" onclick={() => startCheckout(p)} disabled={paying}>
							{paying ? 'Starting…' : p.cta}
						</button>
					{/if}

					<ul class="feat">
						{#each p.features as f}
							<li>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
									stroke={p.accent} stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
									<path d="M4 12l5 5L20 6" />
								</svg>
								<span>{f}</span>
							</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>

		{#if payError}<p class="pay-error" role="alert" use:reveal>{payError}</p>{/if}

		<p class="terms" use:reveal>
			Paid subscriptions renew automatically each month. You can cancel anytime from your account
			dashboard — access continues until the end of the paid period. Prices shown in your region's
			currency. See our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
		</p>
	</div>
</section>

<!-- ===== International cards-only checkout (inline modal) ===== -->
{#if modalOpen}
	<div class="overlay" transition:fade={{ duration: 160 }}
		onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }} onkeydown={onOverlayKey} role="presentation">
		<div class="dialog" transition:scale={{ duration: 200, start: 0.96 }}
			role="dialog" aria-modal="true" aria-label="International card payment" tabindex="-1">
			<button class="close" type="button" onclick={closeModal} aria-label="Close">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
			</button>

			<header class="m-head">
				<span class="m-eyebrow"><span class="dot"></span>INTERNATIONAL · CARDS</span>
				<h2>Subscribe to <span class="mark">{modalPlan?.name ?? ''}</span></h2>
				<p class="m-sub">{modalAmount} / mo · billed monthly, cancel anytime</p>
			</header>

			<div class="card-stage">
				<div class="cc" class:flipped>
					<div class="cc-face cc-front">
						<div class="guilloche"></div>
						<div class="cc-top">
							<span class="cc-globe">
								<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>
								INTL
							</span>
							<span class="cc-brand brand-{brand}">{brand === 'generic' ? 'CARD' : brand}</span>
						</div>
						<div class="cc-chip"><span></span><span></span><span></span></div>
						<div class="cc-number">{previewNumber}</div>
						<div class="cc-meta-row">
							<div class="cc-meta"><span class="cap">Card holder</span><div class="val name">{previewName}</div></div>
							<div class="cc-meta"><span class="cap">Expires</span><div class="val">{previewExpiry}</div></div>
						</div>
					</div>
					<div class="cc-face cc-back">
						<div class="magstripe"></div>
						<div class="cvv-strip"><span class="cvv-label">CVV</span><span class="cvv-value">{previewCvv}</span></div>
						<div class="guilloche back"></div>
					</div>
				</div>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); pay(); }} novalidate>
				<div class="field">
					<label for="ak-name">Name on card</label>
					<input id="ak-name" type="text" autocomplete="cc-name" placeholder="As printed on the card"
						bind:value={cardName} oninput={() => (errors = { ...errors, cardName: '' })} aria-invalid={!!errors.cardName}/>
					{#if errors.cardName}<span class="err">{errors.cardName}</span>{/if}
				</div>
				<div class="field">
					<label for="ak-num">Card number</label>
					<div class="with-brand">
						<input id="ak-num" type="text" inputmode="numeric" autocomplete="cc-number" placeholder="1234 5678 9012 3456"
							value={cardNumber} oninput={onCardInput} aria-invalid={!!errors.cardNumber}/>
						<span class="mini-brand brand-{brand}">{brand === 'generic' ? '' : brand}</span>
					</div>
					{#if errors.cardNumber}<span class="err">{errors.cardNumber}</span>{/if}
				</div>
				<div class="m-row">
					<div class="field">
						<label for="ak-exp">Expiry</label>
						<input id="ak-exp" type="text" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY"
							value={expiry} oninput={onExpiryInput} aria-invalid={!!errors.expiry}/>
						{#if errors.expiry}<span class="err">{errors.expiry}</span>{/if}
					</div>
					<div class="field">
						<label for="ak-cvv">Security code</label>
						<input id="ak-cvv" type="text" inputmode="numeric" autocomplete="cc-csc"
							placeholder={brand === 'amex' ? '4 digits' : '3 digits'} value={cvv} oninput={onCvvInput}
							onfocus={() => (focusedField = 'cvv')} onblur={() => (focusedField = '')} aria-invalid={!!errors.cvv}/>
						{#if errors.cvv}<span class="err">{errors.cvv}</span>{/if}
					</div>
				</div>
				<div class="m-row">
					<div class="field">
						<label for="ak-email">Email</label>
						<input id="ak-email" type="email" autocomplete="email" placeholder="you@example.com"
							bind:value={email} oninput={() => (errors = { ...errors, email: '' })} aria-invalid={!!errors.email}/>
						{#if errors.email}<span class="err">{errors.email}</span>{/if}
					</div>
					<div class="field">
						<label for="ak-tel">Phone</label>
						<input id="ak-tel" type="tel" autocomplete="tel" placeholder="+1 415 555 0123"
							bind:value={contact} oninput={() => (errors = { ...errors, contact: '' })} aria-invalid={!!errors.contact}/>
						{#if errors.contact}<span class="err">{errors.contact}</span>{/if}
					</div>
				</div>

				<div class="m-divider"><span>Billing address</span></div>

				<div class="field">
					<label for="ak-l1">Address line 1</label>
					<input id="ak-l1" type="text" autocomplete="address-line1" placeholder="Street address"
						bind:value={line1} oninput={() => (errors = { ...errors, line1: '' })} aria-invalid={!!errors.line1}/>
					{#if errors.line1}<span class="err">{errors.line1}</span>{/if}
				</div>
				<div class="field">
					<label for="ak-l2">Address line 2 <span class="opt">optional</span></label>
					<input id="ak-l2" type="text" autocomplete="address-line2" placeholder="Apartment, suite, unit" bind:value={line2}/>
				</div>
				<div class="m-row">
					<div class="field">
						<label for="ak-city">City</label>
						<input id="ak-city" type="text" autocomplete="address-level2" bind:value={city}
							oninput={() => (errors = { ...errors, city: '' })} aria-invalid={!!errors.city}/>
						{#if errors.city}<span class="err">{errors.city}</span>{/if}
					</div>
					<div class="field">
						<label for="ak-region">State / Region <span class="opt">optional</span></label>
						<input id="ak-region" type="text" autocomplete="address-level1" bind:value={region}/>
					</div>
				</div>
				<div class="m-row">
					<div class="field">
						<label for="ak-post">Postal code</label>
						<input id="ak-post" type="text" autocomplete="postal-code" bind:value={postal}
							oninput={() => (errors = { ...errors, postal: '' })} aria-invalid={!!errors.postal}/>
						{#if errors.postal}<span class="err">{errors.postal}</span>{/if}
					</div>
					<div class="field">
						<label for="ak-country">Country</label>
						<select id="ak-country" autocomplete="country" bind:value={country}
							onchange={() => (errors = { ...errors, country: '' })} aria-invalid={!!errors.country}>
							<option value="" disabled selected>Select country</option>
							{#each countries as [code, label]}<option value={code}>{label}</option>{/each}
						</select>
						{#if errors.country}<span class="err">{errors.country}</span>{/if}
					</div>
				</div>

				{#if payError}<p class="m-error" role="alert">{payError}</p>{/if}

				<button class="pay-btn" type="submit" class:busy={processing} disabled={processing || !sdkReady}>
					<span class="lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>
					{#if processing}Processing…{:else if !sdkReady}Loading…{:else}Pay {modalAmount} →{/if}
				</button>
				<p class="m-note">3-D Secure runs in a secure Razorpay window. Card details never touch our servers.</p>
			</form>
		</div>
	</div>
{/if}

<style>
	.pricing { padding-block: clamp(48px, 6vw, 90px) var(--space-section); }
	.head { max-width: 640px; margin: 0 auto clamp(36px, 5vw, 56px); text-align: center; }
	.eyebrow { margin-inline: auto; }
	h1 { font-size: clamp(2.2rem, 4.6vw, 3.4rem); font-weight: 700; margin-bottom: 18px; }
	.lede { font-size: 1.12rem; color: var(--slate); max-width: 46ch; margin: 0 auto 28px; }

	.cur { display: inline-flex; gap: 4px; padding: 5px; border: 1.5px solid var(--line-2); border-radius: 999px; background: var(--cloud); }
	.cur button { border: none; background: transparent; font: inherit; font-weight: 600; font-size: 0.9rem; color: var(--slate); padding: 9px 20px; border-radius: 999px; cursor: pointer; transition: background 0.16s ease, color 0.16s ease; }
	.cur button.active { background: var(--ink); color: #fff; }

	.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; align-items: start; }
	.card { position: relative; background: #fff; border: 1.5px solid var(--line); border-radius: 24px; padding: 30px 26px; box-shadow: var(--shadow-md); }
	.card.featured { border: 2px solid var(--ink); box-shadow: 8px 8px 0 var(--ink); }
	.card.soon { background: var(--cloud); }
	.badge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.08em; text-transform: uppercase; color: #fff; background: var(--violet); padding: 5px 13px; border-radius: 999px; white-space: nowrap; }
	.soon-badge { background: var(--coral); }
	.plan { font-family: var(--font-display); font-size: 1.4rem; font-weight: 700; color: var(--ink); }
	.tag { color: var(--slate-2); font-size: 0.92rem; margin-top: 4px; margin-bottom: 18px; }
	.price { display: flex; align-items: baseline; gap: 6px; }
	.amount { font-family: var(--font-display); font-size: 2.6rem; font-weight: 700; letter-spacing: -0.02em; color: var(--ink); }
	.card.soon .amount { color: var(--slate-2); }
	.per { color: var(--slate-2); font-size: 1rem; font-weight: 600; }
	.billed { font-size: 0.82rem; color: var(--slate-2); margin-top: 4px; margin-bottom: 22px; }
	.plan-cta { display: block; width: 100%; text-align: center; margin-bottom: 24px; font: inherit; cursor: pointer; }
	.plan-cta:disabled { opacity: 0.6; cursor: wait; }
	.btn-disabled { background: var(--line-2); color: var(--slate-2); cursor: not-allowed; pointer-events: none; }
	.feat { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
	.feat li { display: flex; align-items: flex-start; gap: 10px; font-size: 0.94rem; color: var(--slate); line-height: 1.45; }
	.feat svg { flex: none; margin-top: 2px; }

	.pay-error { max-width: 60ch; margin: 28px auto 0; text-align: center; font-size: 0.9rem; color: #b42318; background: color-mix(in srgb, var(--coral) 10%, #fff); border: 1px solid color-mix(in srgb, var(--coral) 32%, #fff); border-radius: 14px; padding: 12px 16px; }

	.terms { max-width: 60ch; margin: clamp(32px, 4vw, 48px) auto 0; text-align: center; font-size: 0.88rem; line-height: 1.6; color: var(--slate-2); }
	.terms a { color: var(--slate); text-decoration: underline; text-underline-offset: 2px; }
	.terms a:hover { color: var(--ink); }

	@media (max-width: 880px) {
		.cards { grid-template-columns: 1fr; max-width: 440px; margin-inline: auto; }
		.card.featured { box-shadow: 6px 6px 0 var(--ink); }
	}
	@media (max-width: 420px) { .cur button { padding: 8px 14px; font-size: 0.85rem; } }

	/* ===== Modal ===== */
	.overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(18,21,30,0.55); backdrop-filter: blur(3px); display: flex; align-items: flex-start; justify-content: center; padding: 24px 16px; overflow-y: auto; }
	.dialog { position: relative; width: 100%; max-width: 460px; background: #fff; border: 2px solid var(--ink); border-radius: 24px; box-shadow: 10px 10px 0 var(--ink); padding: 26px 24px 22px; }
	.dialog :global(*) { box-sizing: border-box; }
	.close { position: absolute; top: 16px; right: 16px; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1.5px solid var(--line); background: #fff; border-radius: 50%; color: var(--slate); cursor: pointer; transition: background 0.15s ease, color 0.15s ease; }
	.close:hover { background: var(--cloud); color: var(--ink); }

	.m-head { margin-bottom: 18px; padding-right: 30px; }
	.m-eyebrow { display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--coral); background: color-mix(in srgb, var(--coral) 12%, #fff); padding: 5px 11px; border-radius: 999px; }
	.m-eyebrow .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--coral); }
	.m-head h2 { font-family: var(--font-display); font-weight: 700; font-size: clamp(1.4rem, 5vw, 1.7rem); letter-spacing: -0.02em; margin: 12px 0 5px; color: var(--ink); }
	.m-sub { margin: 0; color: var(--slate); font-size: 0.9rem; }

	.card-stage { perspective: 1300px; margin-bottom: 20px; }
	.cc { position: relative; width: 100%; aspect-ratio: 1.586 / 1; transform-style: preserve-3d; transition: transform 0.7s cubic-bezier(0.2,0.7,0.2,1); }
	.cc.flipped { transform: rotateY(180deg); }
	.cc-face { position: absolute; inset: 0; border-radius: 18px; backface-visibility: hidden; overflow: hidden; color: #eef0ff; background: linear-gradient(150deg, #262a45 0%, #141726 55%, var(--ink) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08); }
	.cc-front { padding: 18px 20px; display: flex; flex-direction: column; }
	.cc-back { transform: rotateY(180deg); }
	.guilloche { position: absolute; inset: 0; opacity: 0.5; pointer-events: none; background: repeating-radial-gradient(circle at 80% 16%, rgba(138,107,242,0.16) 0 1px, transparent 1px 9px), repeating-linear-gradient(115deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 7px); -webkit-mask-image: radial-gradient(circle at 78% 22%, #000, transparent 72%); mask-image: radial-gradient(circle at 78% 22%, #000, transparent 72%); }
	.guilloche.back { opacity: 0.35; }
	.cc-top { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; }
	.cc-globe { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; color: #b8aeff; }
	.cc-brand { text-transform: uppercase; font-weight: 700; font-size: 15px; letter-spacing: 0.08em; }
	.brand-visa { color: #f2f4ff; font-style: italic; }
	.brand-mastercard { color: #ffb27a; }
	.brand-amex { color: #7fd0ff; }
	.brand-discover { color: #ffc36b; }
	.brand-jcb { color: #9be6b0; }
	.brand-diners { color: #cbb8ff; }
	.cc-chip { position: relative; z-index: 1; width: 44px; height: 32px; margin: 16px 0 auto; border-radius: 7px; background: linear-gradient(135deg, #f7e39a, #d9b04a 55%, #b7862c); display: grid; grid-template-columns: 1fr 1fr; gap: 2px; padding: 5px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15); }
	.cc-chip span { background: rgba(0,0,0,0.12); border-radius: 2px; }
	.cc-chip span:first-child { grid-row: span 2; }
	.cc-number { position: relative; z-index: 1; font-family: var(--font-mono); font-size: clamp(16px, 5vw, 21px); letter-spacing: 0.12em; margin: 12px 0 14px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); white-space: nowrap; }
	.cc-meta-row { position: relative; z-index: 1; display: flex; justify-content: space-between; gap: 16px; }
	.cc-meta .cap { display: block; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(238,240,255,0.55); margin-bottom: 3px; }
	.cc-meta .val { font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.05em; }
	.cc-meta .name { text-transform: uppercase; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.magstripe { position: absolute; top: 24px; left: 0; right: 0; height: 40px; background: #0a0b14; }
	.cvv-strip { position: absolute; top: 78px; left: 20px; right: 20px; height: 36px; border-radius: 5px; background: repeating-linear-gradient(90deg, #e9e9ef 0 6px, #dcdce4 6px 12px); display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding: 0 12px; color: #23262f; }
	.cvv-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em; color: #6a6e7a; }
	.cvv-value { font-family: var(--font-mono); font-size: 15px; letter-spacing: 0.22em; }

	.field { display: flex; flex-direction: column; margin-bottom: 13px; min-width: 0; }
	.m-row { display: flex; gap: 12px; }
	.m-row .field { flex: 1; }
	.dialog label { font-size: 12.5px; font-weight: 600; color: var(--ink); margin-bottom: 6px; }
	.opt { font-weight: 400; color: var(--slate); }
	.dialog input, .dialog select { font: inherit; font-size: 15px; color: var(--ink); background: var(--cloud); border: 1.5px solid var(--line); border-radius: 12px; padding: 11px 13px; width: 100%; appearance: none; transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; }
	.dialog input::placeholder { color: #a6adbd; }
	.dialog input:hover, .dialog select:hover { border-color: var(--line-2); }
	.dialog input:focus, .dialog select:focus { outline: none; border-color: var(--violet); background: #fff; box-shadow: 0 0 0 4px color-mix(in srgb, var(--violet) 14%, #fff); }
	.dialog input[aria-invalid='true'], .dialog select[aria-invalid='true'] { border-color: var(--coral); box-shadow: 0 0 0 4px color-mix(in srgb, var(--coral) 14%, #fff); }
	.dialog select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23545A6C' d='M6 8 0 0h12z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 34px; cursor: pointer; }
	.with-brand { position: relative; }
	.mini-brand { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--slate); pointer-events: none; }
	.err { color: var(--coral); font-size: 12px; margin-top: 5px; }
	.m-divider { display: flex; align-items: center; gap: 12px; margin: 6px 0 15px; color: var(--slate); font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
	.m-divider::before, .m-divider::after { content: ''; flex: 1; height: 1px; background: var(--line); }
	.m-error { background: color-mix(in srgb, var(--coral) 10%, #fff); border: 1px solid color-mix(in srgb, var(--coral) 35%, #fff); color: #b42318; font-size: 13px; border-radius: 12px; padding: 10px 12px; margin: 4px 0 14px; }
	.pay-btn { position: relative; width: 100%; border: none; cursor: pointer; font: inherit; font-size: 16px; font-weight: 650; color: #fff; background: var(--violet); border-radius: 999px; padding: 15px 18px; margin-top: 4px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; overflow: hidden; transition: transform 0.12s ease, filter 0.2s ease; }
	.pay-btn:hover:not(:disabled) { filter: brightness(1.06); }
	.pay-btn:active:not(:disabled) { transform: translateY(1px); }
	.pay-btn:disabled { cursor: not-allowed; filter: saturate(0.65) brightness(0.98); }
	.pay-btn.busy::after { content: ''; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.28) 50%, transparent 80%); transform: translateX(-100%); animation: sweep 1.1s linear infinite; }
	@keyframes sweep { to { transform: translateX(100%); } }
	.lock { display: inline-flex; }
	.m-note { margin: 13px 0 0; font-size: 12px; color: var(--slate); line-height: 1.5; text-align: center; }

	@media (max-width: 420px) { .m-row { flex-direction: column; gap: 0; } }
	@media (prefers-reduced-motion: reduce) { .cc { transition: none; } .pay-btn.busy::after { animation: none; } }
</style>