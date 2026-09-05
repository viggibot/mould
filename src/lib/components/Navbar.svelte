<script>
	// Akritio — mould generator, powered by Navi3D Studio
	import { onMount } from 'svelte';
	// Adjust this path to wherever you placed the Akritio auth store.
	import { authStore, initAuth, logout } from '$lib/stores/auth.js';

	let menuOpen = $state(false);
	let menuRef = $state(null);

	function initials(name) {
		if (!name) return 'U';
		const parts = name.trim().split(/\s+/).filter(Boolean);
		const first = parts[0]?.[0] || '';
		const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
		return (first + last).toUpperCase() || 'U';
	}

	function toggleMenu() {
		menuOpen = !menuOpen;
	}
	function closeMenu() {
		menuOpen = false;
	}

	async function handleLogout() {
		closeMenu();
		await logout(); // store clears tokens, revokes on backend, redirects to /login
	}

	function onDocClick(e) {
		if (menuOpen && menuRef && !menuRef.contains(e.target)) menuOpen = false;
	}
	function onKeydown(e) {
		if (e.key === 'Escape') menuOpen = false;
	}

	onMount(() => {
		// Populate the store from stored tokens (safe to call even if +layout also does).
		initAuth();
		document.addEventListener('click', onDocClick);
		document.addEventListener('keydown', onKeydown);
		return () => {
			document.removeEventListener('click', onDocClick);
			document.removeEventListener('keydown', onKeydown);
		};
	});
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
			<a href="/pricing">Pricing</a>
			<a href="/docs">Documentation</a>
			<a href="/contact">Contact</a>
		</nav>

		<div class="right">
			{#if $authStore.isLoggedIn && $authStore.user}
				<div class="user-wrap" bind:this={menuRef}>
					<button class="user" onclick={toggleMenu} aria-haspopup="true" aria-expanded={menuOpen} aria-label="Account menu">
						<span class="avatar">{initials($authStore.user.name)}</span>
						<span class="uname">{$authStore.user.name}</span>
						<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M6 9l6 6 6-6" />
						</svg>
					</button>

					{#if menuOpen}
						<div class="menu" role="menu">
							<div class="menu-head">
								<span class="menu-name">{$authStore.user.name}</span>
								{#if $authStore.user.email}
									<span class="menu-email">{$authStore.user.email}</span>
								{/if}
							</div>

							<a class="menu-item" href="/mould" role="menuitem" onclick={closeMenu}>
								<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" />
								</svg>
								Open the generator
							</a>

							<button class="menu-item danger" role="menuitem" onclick={handleLogout}>
								<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
								</svg>
								Log out
							</button>
						</div>
					{/if}
				</div>
			{:else}
				<a class="login" href="/login" aria-label="Log in">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="8" r="4" />
						<path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
					</svg>
				</a>
			{/if}

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

	/* ---- logged-in user chip + dropdown ---- */
	.user-wrap {
		position: relative;
		flex: none;
	}
	.user {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px 5px 5px;
		border-radius: 999px;
		border: 1.5px solid var(--line-2);
		background: #fff;
		color: var(--ink);
		font-family: inherit;
		cursor: pointer;
		transition: border-color 0.16s ease, background 0.16s ease;
	}
	.user:hover {
		border-color: var(--ink);
	}
	.avatar {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--violet);
		color: #fff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 0.78rem;
		flex: none;
	}
	.uname {
		font-size: 0.9rem;
		font-weight: 600;
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chev {
		color: var(--slate-2);
		transition: transform 0.16s ease;
	}
	.user[aria-expanded='true'] .chev {
		transform: rotate(180deg);
	}

	.menu {
		position: absolute;
		right: 0;
		top: calc(100% + 10px);
		width: 244px;
		background: #fff;
		border: 1px solid var(--line);
		border-radius: 14px;
		box-shadow: 0 14px 34px rgba(20, 22, 31, 0.14);
		padding: 8px;
		z-index: 60;
	}
	.menu-head {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px 12px;
		border-bottom: 1px solid var(--line);
		margin-bottom: 6px;
	}
	.menu-name {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--ink);
	}
	.menu-email {
		font-size: 0.8rem;
		color: var(--slate-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.menu-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		box-sizing: border-box;
		padding: 10px 12px;
		border-radius: 9px;
		font-family: inherit;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--ink);
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background 0.14s ease;
	}
	.menu-item:hover {
		background: var(--cloud);
	}
	.menu-item svg {
		flex: none;
		color: var(--slate-2);
	}
	.menu-item.danger {
		color: #dc2626;
	}
	.menu-item.danger svg {
		color: #dc2626;
	}
	.menu-item.danger:hover {
		background: #fef2f2;
	}

	@media (max-width: 720px) {
		.links {
			display: none;
		}
	}
	@media (max-width: 560px) {
		.uname {
			display: none;
		}
	}
	@media (max-width: 460px) {
		.cta {
			display: none;
		}
	}
</style>