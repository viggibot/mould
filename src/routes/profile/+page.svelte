<script>
	// ==========================================================================
	// AKRITIO — PROFILE DASHBOARD  (route: /profile)
	// Flat Akritio design language: navy ink + white, Space Grotesk / Inter,
	// amber marker highlight, rotating flat accents, hard offset shadows.
	//
	// Data: GET  /akritio/account/purchases            (plan + paid orders)
	//       GET  /akritio/account/invoice/{invoice_id} (PDF, owner only)
	// All calls go through authFetch() so expired tokens refresh transparently.
	// ==========================================================================
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { PUBLIC_API_BASE_URL } from '$env/static/public';
	// ADJUST the path if your auth store lives elsewhere.
	import { authStore, initAuth, authFetch, getValidAccessToken, logout } from '$lib/stores/auth.js';

	const API = PUBLIC_API_BASE_URL;
	const LOGIN_PATH = '/login?next=/profile';
	const PERIOD_DAYS = 30;

	let loading = $state(true);
	let loadError = $state('');
	let account = $state(null);
	let current = $state(null);
	let purchases = $state([]);
	let totals = $state({});
	let busy = $state({});       // invoice_id -> true while downloading
	let dlError = $state('');
	let refreshing = $state(false);

	// ---- derived ------------------------------------------------------------
	let displayName = $derived(
		(account && account.name && account.name !== 'Customer' ? account.name : '') ||
			($authStore.user && $authStore.user.name) ||
			'Maker'
	);
	let displayEmail = $derived((account && account.email) || ($authStore.user && $authStore.user.email) || '');
	let firstName = $derived(displayName.trim().split(/\s+/)[0] || 'Maker');
	let accountId = $derived((account && account.id) || ($authStore.user && $authStore.user.id) || '');

	let isPro = $derived(!!(current && current.active));
	let viaAllowlist = $derived(!!(current && current.via_allowlist));
	let daysLeft = $derived.by(() => {
		if (!isPro || !current.active_until) return 0;
		const ms = new Date(current.active_until).getTime() - Date.now();
		return Math.max(0, Math.ceil(ms / 86400000));
	});
	let progressPct = $derived(viaAllowlist ? 100 : Math.min(100, Math.round((daysLeft / PERIOD_DAYS) * 100)));
	let paidCount = $derived(purchases.filter((p) => p.status !== 'refunded').length);
	let firstPurchase = $derived(purchases.length ? purchases[purchases.length - 1].created_at : null);
	let totalsList = $derived(Object.entries(totals || {}).filter(([, v]) => v > 0));

	// ---- helpers ------------------------------------------------------------
	function initials(name) {
		const parts = (name || '').trim().split(/\s+/).filter(Boolean);
		const a = parts[0]?.[0] || '';
		const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
		return (a + b).toUpperCase() || 'U';
	}
	function fmtDate(iso) {
		if (!iso) return '—';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
	}
	function fmtMoney(amount, currency) {
		const cur = (currency || 'INR').toUpperCase();
		try {
			return new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en-US', {
				style: 'currency',
				currency: cur,
				maximumFractionDigits: 2
			}).format(Number(amount) || 0);
		} catch (_) {
			return `${cur} ${(Number(amount) || 0).toFixed(2)}`;
		}
	}
	const STATUS = {
		active: { label: 'Active', cls: 'st-active' },
		expired: { label: 'Expired', cls: 'st-expired' },
		confirming: { label: 'Confirming', cls: 'st-confirming' },
		refunded: { label: 'Refunded', cls: 'st-refunded' }
	};
	function statusOf(s) {
		return STATUS[s] || { label: s || '—', cls: 'st-expired' };
	}

	// ---- data ---------------------------------------------------------------
	async function load(silent = false) {
		if (!silent) loading = true;
		loadError = '';
		try {
			const res = await authFetch(`${API}/akritio/account/purchases`, { cache: 'no-store' });
			if (res.status === 401) {
				goto(LOGIN_PATH);
				return;
			}
			if (!res.ok) {
				loadError = res.status === 404
					? 'The account service is not available yet (HTTP 404). Please try again shortly.'
					: `Couldn't load your account (HTTP ${res.status}).`;
				return;
			}
			const j = await res.json();
			account = j.account || null;
			current = j.current || { active: false };
			purchases = Array.isArray(j.purchases) ? j.purchases : [];
			totals = j.totals || {};
		} catch (e) {
			loadError = "Couldn't reach the server. Check your connection and try again.";
		} finally {
			loading = false;
		}
	}

	async function refresh() {
		refreshing = true;
		await load(true);
		refreshing = false;
	}

	async function downloadInvoice(p) {
		if (!p.invoice_id || busy[p.invoice_id]) return;
		dlError = '';
		busy = { ...busy, [p.invoice_id]: true };
		try {
			const res = await authFetch(`${API}/akritio/account/invoice/${encodeURIComponent(p.invoice_id)}`);
			const ct = res.headers.get('content-type') || '';
			if (!res.ok || !ct.includes('pdf')) {
				let msg = `Invoice download failed (HTTP ${res.status}).`;
				try {
					const j = await res.json();
					msg = j.message || msg;
				} catch (_) {}
				throw new Error(msg);
			}
			const blob = await res.blob();
			if (!blob.size) throw new Error('The invoice came back empty. Please try again.');
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `Akritio-${p.invoice_id}.pdf`;
			a.rel = 'noopener';
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 4000);
		} catch (e) {
			dlError = e && e.message ? e.message : 'Invoice download failed.';
		} finally {
			const next = { ...busy };
			delete next[p.invoice_id];
			busy = next;
		}
	}

	async function copyId(text) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (_) {}
	}

	onMount(() => {
		let alive = true;
		(async () => {
			await initAuth();
			const token = await getValidAccessToken();
			if (!alive) return;
			if (!token) {
				goto(LOGIN_PATH);
				return;
			}
			await load();
		})();
		return () => {
			alive = false;
		};
	});
</script>

<svelte:head>
	<title>Your dashboard — Akritio</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="dash">
	<div class="container">
		<!-- ================= HEADER ================= -->
		<header class="head">
			<div class="head-txt">
				<p class="eyebrow"><span class="dot"></span>Account · Dashboard</p>
				<h1>Hello, <span class="mark">{firstName}</span></h1>
				<p class="lede">Your plan, payments and invoices — all in one place.</p>
			</div>
			<div class="head-act">
				<a class="act act-ink" href="/mould">
					Open the generator
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
				</a>
				<button class="act act-line" type="button" onclick={refresh} disabled={refreshing || loading} title="Reload plan and payments">
					<svg class:spin={refreshing} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
					Refresh
				</button>
			</div>
		</header>

		{#if loading}
			<!-- ================= SKELETON ================= -->
			<div class="grid">
				<div class="panel sk" style="height: 260px;"></div>
				<div class="panel sk" style="height: 260px;"></div>
			</div>
			<div class="stats">
				<div class="panel sk" style="height: 112px;"></div>
				<div class="panel sk" style="height: 112px;"></div>
				<div class="panel sk" style="height: 112px;"></div>
			</div>
			<div class="panel sk" style="height: 240px; margin-top: 22px;"></div>
		{:else if loadError}
			<!-- ================= ERROR ================= -->
			<div class="panel error-panel">
				<span class="err-ic" aria-hidden="true">!</span>
				<div>
					<h2>Something went sideways</h2>
					<p>{loadError}</p>
				</div>
				<button class="act act-ink" type="button" onclick={() => load()}>Try again</button>
			</div>
		{:else}
			<!-- ================= PROFILE + PLAN ================= -->
			<div class="grid">
				<article class="panel profile">
					<svg class="deco" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
						<path d="M92 14 L95 25 L106 28 L95 31 L92 42 L89 31 L78 28 L89 25 Z" fill="#f6b93b" />
						<circle cx="104" cy="62" r="5" fill="#17b8a6" />
						<circle cx="70" cy="18" r="3.5" fill="#ec6ec9" />
					</svg>
					<div class="avatar">{initials(displayName)}</div>
					<h2 class="pname">{displayName}</h2>
					{#if displayEmail}<p class="pemail">{displayEmail}</p>{/if}

					<dl class="meta">
						<div>
							<dt>Plan</dt>
							<dd><span class="chip {isPro ? 'chip-pro' : 'chip-free'}">{isPro ? 'Pro' : 'Free'}</span></dd>
						</div>
						<div>
							<dt>Member since</dt>
							<dd>{firstPurchase ? fmtDate(firstPurchase) : '—'}</dd>
						</div>
						{#if accountId}
							<div class="full">
								<dt>Account ID</dt>
								<dd>
									<button class="idbtn" type="button" onclick={() => copyId(accountId)} title="Copy account ID">
										<span class="mono">{accountId}</span>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
									</button>
								</dd>
							</div>
						{/if}
					</dl>

					<button class="act act-danger" type="button" onclick={() => logout()}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
						Log out
					</button>
				</article>

				<article class="panel plan" class:plan-pro={isPro}>
					<div class="plan-top">
						<span class="plan-badge {isPro ? 'b-pro' : 'b-free'}">{isPro ? 'Akritio Pro' : 'Free plan'}</span>
						{#if isPro && viaAllowlist}<span class="plan-note">Complimentary access</span>{/if}
					</div>

					{#if isPro}
						<h2 class="plan-title">Unlimited moulds, <span class="mark">unlocked</span>.</h2>
						{#if viaAllowlist}
							<p class="plan-sub">This account has permanent Pro access.</p>
						{:else}
							<div class="days">
								<span class="days-n">{daysLeft}</span>
								<span class="days-l">day{daysLeft === 1 ? '' : 's'} left<br /><small>until {fmtDate(current.active_until)}</small></span>
							</div>
						{/if}
						<div class="bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin="0" aria-valuemax="100">
							<span class="bar-fill" style="width: {progressPct}%"></span>
						</div>
						<ul class="perks">
							<li><i style="background:#6c5ce7"></i>Silicone, vase &amp; multi-part moulds</li>
							<li><i style="background:#17b8a6"></i>Fine voxels + CAD-exact ±0.01 mm</li>
							<li><i style="background:#ff7a66"></i>Unlimited exports</li>
						</ul>
						<div class="plan-act">
							<a class="act act-violet" href="/mould">Start a mould</a>
							{#if !viaAllowlist && daysLeft <= 5}
								<a class="act act-line" href="/pricing">Renew soon</a>
							{/if}
						</div>
					{:else}
						<h2 class="plan-title">One free mould a day. <span class="mark">Go further</span> with Pro.</h2>
						<ul class="perks">
							<li><i style="background:#6c5ce7"></i>Silicone, vase &amp; multi-part moulds</li>
							<li><i style="background:#17b8a6"></i>Fine voxels + CAD-exact ±0.01 mm</li>
							<li><i style="background:#ff7a66"></i>Unlimited exports</li>
						</ul>
						<div class="plan-act">
							<a class="act act-coral" href="/pricing">Upgrade to Pro</a>
							<a class="act act-line" href="/mould">Use the free plan</a>
						</div>
						{#if purchases.some((p) => p.status === 'confirming')}
							<p class="plan-hint">A payment is being confirmed — press <strong>Refresh</strong> in a moment.</p>
						{/if}
					{/if}
				</article>
			</div>

			<!-- ================= STATS ================= -->
			<div class="stats">
				<div class="panel stat">
					<span class="stat-ic" style="--c:#6c5ce7; --t:#efecfd">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
					</span>
					<span class="stat-l">Total paid</span>
					<span class="stat-v">
						{#if totalsList.length}
							{#each totalsList as [cur, amt], i}{i ? ' · ' : ''}{fmtMoney(amt, cur)}{/each}
						{:else}—{/if}
					</span>
				</div>
				<div class="panel stat">
					<span class="stat-ic" style="--c:#17b8a6; --t:#e3f7f4">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
					</span>
					<span class="stat-l">Payments</span>
					<span class="stat-v">{paidCount}</span>
				</div>
				<div class="panel stat">
					<span class="stat-ic" style="--c:#ff7a66; --t:#ffeeea">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
					</span>
					<span class="stat-l">{isPro ? 'Pro valid until' : 'Current plan'}</span>
					<span class="stat-v">{isPro ? (viaAllowlist ? 'Always' : fmtDate(current.active_until)) : 'Free'}</span>
				</div>
			</div>

			<!-- ================= PURCHASE HISTORY ================= -->
			<section class="panel history">
				<div class="hist-head">
					<h2>Purchase <span class="mark">history</span></h2>
					<span class="hist-count">{purchases.length} order{purchases.length === 1 ? '' : 's'}</span>
				</div>

				{#if dlError}<p class="dl-err" role="alert">{dlError}</p>{/if}

				{#if purchases.length === 0}
					<div class="empty">
						<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
							<rect x="10" y="14" width="44" height="36" rx="6" fill="#f5f6fa" stroke="#14161f" stroke-width="2" />
							<path d="M10 24h44" stroke="#14161f" stroke-width="2" />
							<circle cx="46" cy="42" r="4" fill="#f6b93b" />
							<path d="M50 8 L51.5 12.5 L56 14 L51.5 15.5 L50 20 L48.5 15.5 L44 14 L48.5 12.5 Z" fill="#6c5ce7" />
						</svg>
						<p class="empty-t">No purchases yet</p>
						<p class="empty-s">When you upgrade to Pro, your payments and invoices will show up here.</p>
						<a class="act act-coral" href="/pricing">See plans</a>
					</div>
				{:else}
					<div class="table" role="table" aria-label="Purchase history">
						<div class="tr th" role="row">
							<span role="columnheader">Order</span>
							<span role="columnheader">Date</span>
							<span role="columnheader">Plan</span>
							<span role="columnheader">Amount</span>
							<span role="columnheader">Status</span>
							<span role="columnheader" class="ta-r">Invoice</span>
						</div>
						{#each purchases as p (p.akritio_order_id)}
							<div class="tr" role="row">
								<span class="td" role="cell" data-l="Order">
									<span class="mono ord">{p.akritio_order_id}</span>
									{#if p.payment_id}<span class="sub mono">{p.payment_id}</span>{/if}
								</span>
								<span class="td" role="cell" data-l="Date">{fmtDate(p.activated_at || p.created_at)}</span>
								<span class="td" role="cell" data-l="Plan">
									{p.plan_label}
									{#if p.active_until}<span class="sub">until {fmtDate(p.active_until)}</span>{/if}
								</span>
								<span class="td amt" role="cell" data-l="Amount">{fmtMoney(p.amount, p.currency)}</span>
								<span class="td" role="cell" data-l="Status"><span class="st {statusOf(p.status).cls}">{statusOf(p.status).label}</span></span>
								<span class="td ta-r" role="cell" data-l="Invoice">
									{#if p.has_invoice}
										<button class="inv" type="button" onclick={() => downloadInvoice(p)} disabled={busy[p.invoice_id]} title="Download invoice {p.invoice_id}">
											{#if busy[p.invoice_id]}
												<span class="mini-spin" aria-hidden="true"></span>Preparing…
											{:else}
												<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
												PDF
											{/if}
										</button>
									{:else if p.status === 'active' || p.status === 'expired'}
										<span class="pending">Generating…</span>
									{:else}
										<span class="pending">—</span>
									{/if}
								</span>
							</div>
						{/each}
					</div>
					<p class="hist-foot">
						Invoice missing or a payment not listed? Email <a href="mailto:sales@navi3d.in">sales@navi3d.in</a> with your payment ID.
					</p>
				{/if}
			</section>
		{/if}
	</div>
</section>

<style>
	.dash {
		--ink: #14161f;
		--k-violet: #6c5ce7;
		--k-blue: #3b82f6;
		--k-coral: #ff7a66;
		--k-teal: #17b8a6;
		--k-pink: #ec6ec9;
		--k-amber: #f6b93b;
		--k-slate: var(--slate, #545a6c);
		--k-slate-2: var(--slate-2, #7a8194);
		--k-line: var(--line, #e6e8ef);
		--k-line-2: var(--line-2, #d5d9e3);
		--k-cloud: var(--cloud, #f5f6fa);
		--k-display: var(--font-display, 'Space Grotesk', 'Inter', sans-serif);
		--k-mono: var(--font-mono, ui-monospace, 'JetBrains Mono', Menlo, monospace);
		padding-block: clamp(36px, 5vw, 64px) clamp(64px, 8vw, 110px);
		color: var(--ink);
	}

	/* ---------- header ---------- */
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
		flex-wrap: wrap;
		margin-bottom: 30px;
	}
	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--k-mono);
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--k-violet);
		background: #efecfd;
		padding: 6px 13px;
		border-radius: 999px;
		margin: 0 0 16px;
	}
	.eyebrow .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--k-violet);
	}
	h1 {
		font-family: var(--k-display);
		font-size: clamp(2.2rem, 4.6vw, 3.3rem);
		font-weight: 700;
		letter-spacing: -0.025em;
		line-height: 1.05;
		margin: 0 0 12px;
	}
	.lede {
		font-size: 1.06rem;
		color: var(--k-slate);
		margin: 0;
	}
	.head-act {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	/* ---------- buttons ---------- */
	.act {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-family: inherit;
		font-size: 0.92rem;
		font-weight: 650;
		padding: 11px 18px;
		border-radius: 999px;
		border: 2px solid var(--ink);
		cursor: pointer;
		text-decoration: none;
		transition: transform 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
		white-space: nowrap;
	}
	.act:hover:not(:disabled) {
		transform: translate(-2px, -2px);
		box-shadow: 3px 3px 0 var(--ink);
	}
	.act:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.act-ink { background: var(--ink); color: #fff; }
	.act-ink:hover:not(:disabled) { box-shadow: 3px 3px 0 var(--k-amber); }
	.act-line { background: #fff; color: var(--ink); }
	.act-violet { background: var(--k-violet); color: #fff; }
	.act-coral { background: var(--k-coral); color: #fff; }
	.act-danger {
		background: #fff;
		color: #dc2626;
		border-color: #fecaca;
		width: 100%;
		margin-top: auto;
	}
	.act-danger:hover:not(:disabled) {
		background: #fef2f2;
		box-shadow: none;
		transform: none;
	}
	.spin { animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	/* ---------- panels ---------- */
	.panel {
		background: #fff;
		border: 1.5px solid var(--k-line);
		border-radius: 22px;
		padding: 26px;
		position: relative;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
		gap: 22px;
		align-items: stretch;
	}

	/* ---------- profile card ---------- */
	.profile {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.deco {
		position: absolute;
		top: 0;
		right: 0;
		pointer-events: none;
	}
	.avatar {
		width: 72px;
		height: 72px;
		border-radius: 20px;
		background: var(--k-violet);
		color: #fff;
		border: 2px solid var(--ink);
		box-shadow: 4px 4px 0 var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--k-display);
		font-size: 1.6rem;
		font-weight: 700;
		margin-bottom: 18px;
	}
	.pname {
		font-family: var(--k-display);
		font-size: 1.45rem;
		font-weight: 700;
		letter-spacing: -0.015em;
		margin: 0;
		overflow-wrap: anywhere;
	}
	.pemail {
		color: var(--k-slate);
		font-size: 0.94rem;
		margin: 4px 0 0;
		overflow-wrap: anywhere;
	}
	.meta {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px 16px;
		margin: 22px 0 22px;
		padding: 16px 0 0;
		border-top: 1.5px dashed var(--k-line-2);
	}
	.meta .full { grid-column: 1 / -1; }
	.meta dt {
		font-family: var(--k-mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--k-slate-2);
		margin-bottom: 5px;
	}
	.meta dd {
		margin: 0;
		font-size: 0.93rem;
		font-weight: 600;
	}
	.idbtn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		max-width: 100%;
		font: inherit;
		font-size: 0.8rem;
		color: var(--k-slate);
		background: var(--k-cloud);
		border: 1px solid var(--k-line);
		border-radius: 8px;
		padding: 5px 9px;
		cursor: pointer;
	}
	.idbtn .mono {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.idbtn:hover { border-color: var(--k-line-2); color: var(--ink); }
	.mono { font-family: var(--k-mono); }
	.chip {
		display: inline-block;
		font-family: var(--k-mono);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		padding: 3px 10px;
		border-radius: 999px;
	}
	.chip-pro { color: #fff; background: var(--k-violet); }
	.chip-free { color: var(--k-slate); background: var(--k-cloud); border: 1px solid var(--k-line); }

	/* ---------- plan card ---------- */
	.plan {
		display: flex;
		flex-direction: column;
	}
	.plan-pro {
		border: 2px solid var(--ink);
		box-shadow: 8px 8px 0 var(--ink);
	}
	.plan-top {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}
	.plan-badge {
		font-family: var(--k-mono);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 5px 12px;
		border-radius: 999px;
	}
	.b-pro { background: var(--k-violet); color: #fff; }
	.b-free { background: var(--k-cloud); color: var(--k-slate); border: 1px solid var(--k-line); }
	.plan-note {
		font-size: 0.82rem;
		font-weight: 600;
		color: #065f46;
		background: #e3f7f4;
		padding: 4px 11px;
		border-radius: 999px;
	}
	.plan-title {
		font-family: var(--k-display);
		font-size: clamp(1.45rem, 2.6vw, 1.9rem);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.2;
		margin: 0 0 18px;
	}
	.plan-sub {
		color: var(--k-slate);
		margin: 0 0 16px;
	}
	.days {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 14px;
	}
	.days-n {
		font-family: var(--k-display);
		font-size: 3.2rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.03em;
	}
	.days-l {
		font-weight: 650;
		line-height: 1.35;
	}
	.days-l small {
		font-weight: 500;
		color: var(--k-slate-2);
		font-size: 0.85rem;
	}
	.bar {
		height: 12px;
		border-radius: 999px;
		background: var(--k-cloud);
		border: 1.5px solid var(--ink);
		overflow: hidden;
		margin-bottom: 20px;
	}
	.bar-fill {
		display: block;
		height: 100%;
		background: var(--k-teal);
		border-right: 1.5px solid var(--ink);
		transition: width 0.6s ease;
	}
	.perks {
		list-style: none;
		margin: 0 0 22px;
		padding: 0;
		display: grid;
		gap: 10px;
	}
	.perks li {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.95rem;
		color: var(--k-slate);
	}
	.perks i {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		flex: none;
	}
	.plan-act {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: auto;
	}
	.plan-hint {
		font-size: 0.85rem;
		color: #92400e;
		background: #fef6e4;
		border-radius: 10px;
		padding: 9px 12px;
		margin: 14px 0 0;
	}

	/* ---------- stats ---------- */
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 22px;
		margin-top: 22px;
	}
	.stat {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 20px 22px;
	}
	.stat-ic {
		width: 38px;
		height: 38px;
		border-radius: 11px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--c);
		background: var(--t);
		border: 1.5px solid var(--c);
		margin-bottom: 6px;
	}
	.stat-l {
		font-family: var(--k-mono);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--k-slate-2);
	}
	.stat-v {
		font-family: var(--k-display);
		font-size: 1.35rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	/* ---------- history ---------- */
	.history { margin-top: 22px; }
	.hist-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 18px;
	}
	.hist-head h2 {
		font-family: var(--k-display);
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.015em;
		margin: 0;
	}
	.hist-count {
		font-family: var(--k-mono);
		font-size: 0.75rem;
		color: var(--k-slate-2);
	}
	.dl-err {
		font-size: 0.88rem;
		color: #b42318;
		background: #fff1ee;
		border: 1px solid #ffd2c9;
		border-radius: 12px;
		padding: 10px 14px;
		margin: 0 0 14px;
	}
	.table {
		border: 1.5px solid var(--k-line);
		border-radius: 16px;
		overflow: hidden;
	}
	.tr {
		display: grid;
		grid-template-columns: 1.5fr 1fr 1.3fr 1fr 0.9fr 0.8fr;
		gap: 14px;
		align-items: center;
		padding: 15px 18px;
		border-top: 1px solid var(--k-line);
		font-size: 0.93rem;
	}
	.tr:first-child { border-top: none; }
	.tr:not(.th):hover { background: #fafbfd; }
	.th {
		background: var(--k-cloud);
		font-family: var(--k-mono);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--k-slate-2);
		padding-block: 11px;
	}
	.td {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.ord {
		font-size: 0.85rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		font-size: 0.76rem;
		color: var(--k-slate-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.amt { font-weight: 700; }
	.ta-r { text-align: right; align-items: flex-end; }
	.st {
		align-self: flex-start;
		font-size: 0.76rem;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1.5px solid;
	}
	.st-active { color: #0f766e; background: #e3f7f4; border-color: #9fe3d9; }
	.st-expired { color: var(--k-slate); background: var(--k-cloud); border-color: var(--k-line-2); }
	.st-confirming { color: #92400e; background: #fef6e4; border-color: #f9dc9a; }
	.st-refunded { color: #b42318; background: #fff1ee; border-color: #ffd2c9; }
	.inv {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--ink);
		background: #fff;
		border: 2px solid var(--ink);
		border-radius: 999px;
		padding: 6px 13px;
		cursor: pointer;
		transition: transform 0.14s ease, box-shadow 0.14s ease;
	}
	.inv:hover:not(:disabled) {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--k-amber);
	}
	.inv:disabled { opacity: 0.7; cursor: wait; }
	.mini-spin {
		width: 12px;
		height: 12px;
		border: 2px solid var(--k-line-2);
		border-top-color: var(--ink);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	.pending {
		font-size: 0.8rem;
		color: var(--k-slate-2);
	}
	.hist-foot {
		font-size: 0.85rem;
		color: var(--k-slate-2);
		margin: 16px 0 0;
	}
	.hist-foot a {
		color: var(--k-violet);
		font-weight: 600;
	}

	/* ---------- empty / error / skeleton ---------- */
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 34px 16px 20px;
	}
	.empty-t {
		font-family: var(--k-display);
		font-size: 1.2rem;
		font-weight: 700;
		margin: 14px 0 4px;
	}
	.empty-s {
		color: var(--k-slate);
		max-width: 40ch;
		margin: 0 0 18px;
	}
	.error-panel {
		display: flex;
		align-items: center;
		gap: 18px;
		flex-wrap: wrap;
		border: 2px solid var(--ink);
		box-shadow: 6px 6px 0 var(--k-coral);
	}
	.error-panel h2 {
		font-family: var(--k-display);
		font-size: 1.2rem;
		margin: 0 0 4px;
	}
	.error-panel p { margin: 0; color: var(--k-slate); }
	.error-panel > div { flex: 1; min-width: 220px; }
	.err-ic {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: var(--k-coral);
		color: #fff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--k-display);
		font-weight: 700;
		font-size: 1.4rem;
		flex: none;
	}
	.sk {
		background: var(--k-cloud);
		border-color: var(--k-line);
		animation: pulse 1.4s ease-in-out infinite;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.55; }
	}

	/* ---------- responsive ---------- */
	@media (max-width: 920px) {
		.grid { grid-template-columns: 1fr; }
		.plan-pro { box-shadow: 6px 6px 0 var(--ink); }
	}
	@media (max-width: 760px) {
		.stats { grid-template-columns: 1fr; gap: 14px; }
		.table { border: none; border-radius: 0; }
		.th { display: none; }
		.tr {
			grid-template-columns: 1fr 1fr;
			gap: 12px 14px;
			border: 1.5px solid var(--k-line);
			border-radius: 16px;
			margin-bottom: 12px;
			padding: 16px;
		}
		.tr:first-child { border-top: 1.5px solid var(--k-line); }
		.td::before {
			content: attr(data-l);
			font-family: var(--k-mono);
			font-size: 0.64rem;
			letter-spacing: 0.12em;
			text-transform: uppercase;
			color: var(--k-slate-2);
		}
		.td[data-l='Order'] { grid-column: 1 / -1; }
		.ta-r { text-align: left; align-items: flex-start; }
		.panel { padding: 20px; border-radius: 18px; }
	}
	@media (prefers-reduced-motion: reduce) {
		.sk, .spin, .mini-spin { animation: none; }
		.act, .inv, .bar-fill { transition: none; }
	}
</style>