import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { PUBLIC_API_BASE_URL } from "$env/static/public";

// ==========================================================================
//  AKRITIO AUTH STORE
//
//  WHY THIS CHANGED:
//  Pages (Mould Studio, Pricing) read the access token straight out of
//  storage in their own onMount. In SvelteKit a PAGE's onMount runs BEFORE
//  the root +layout's onMount, so they ran before initAuth() had refreshed an
//  expired access token. The subscription check then got 401, the page
//  decided "not logged in / not Pro", locked every Pro option, and never
//  checked again — even for paying users.
//
//  NOW:
//   • getValidAccessToken() — returns a non-expired access token, refreshing
//     first if needed. Every API call should go through this (or authFetch).
//   • authFetch(url, opts)   — attaches the Bearer token; on a 401 it refreshes
//     ONCE and retries, so a token that expires mid-session (or mid-checkout)
//     doesn't bounce the user.
//   • Refresh is SINGLE-FLIGHT (one refresh at a time in this tab) and uses a
//     cross-tab Web Lock where available. This matters because the backend
//     rotates refresh tokens with reuse detection: two parallel refreshes with
//     the same token would look like token theft and revoke the whole session.
//   • initAuth() is idempotent — the layout and any page can await it and they
//     share one run.
//   • fetchSubscriptionStatus() — the one place the frontend asks "is this
//     account Pro?", used by both the studio and the pricing page.
// ==========================================================================

const API_BASE = PUBLIC_API_BASE_URL;
const CLIENT_ID = 'akritio';

// Where to send the user after a full logout.
const LOGIN_PATH = '/login';

const ACCESS_KEY = 'akritio_access_token';
const REFRESH_KEY = 'akritio_refresh_token';

const initialState = {
    isLoggedIn: false,
    user: null,
    accessToken: null,
    refreshToken: null
};

export const authStore = writable(initialState);

// --- HELPER: Parse JWT ---
export function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

// --- HELPER: Check if Token is Expired ---
export function isTokenExpired(token) {
    if (!token) return true;
    const decoded = parseJwt(token);
    if (!decoded || !decoded.exp) return true;

    const currentTime = Date.now() / 1000;
    return decoded.exp < (currentTime + 30); // 30-second buffer
}

// --- HELPER: storage access (guarded — private mode can throw) ---
function readKey(key) {
    if (!browser) return null;
    try {
        return localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

// Tokens live in localStorage ("remember me") or sessionStorage; keep writing
// to whichever one currently holds them.
function tokenStorage() {
    try {
        if (localStorage.getItem(REFRESH_KEY) || localStorage.getItem(ACCESS_KEY)) return localStorage;
    } catch (e) { /* fall through */ }
    return sessionStorage;
}

function setSession(access, refresh) {
    const decoded = parseJwt(access);
    if (!decoded) return;
    authStore.set({
        isLoggedIn: true,
        accessToken: access,
        refreshToken: refresh,
        user: {
            id: decoded.sub,
            name: decoded.name,
            type: decoded.role,
            email: decoded.email
        }
    });
}

// --- LOGOUT ACTION ---
export async function logout() {
    if (browser) {
        const refreshToken = readKey(REFRESH_KEY);

        // 1. Notify Backend to Revoke Token
        if (refreshToken) {
            try {
                await fetch(`${API_BASE}/logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: refreshToken })
                });
            } catch (err) {
                console.error("Backend logout failed:", err);
            }
        }

        // 2. Clear Local State
        ['access_token', 'refresh_token', 'token_expiry'].forEach(suffix => {
            try {
                localStorage.removeItem(`akritio_${suffix}`);
                sessionStorage.removeItem(`akritio_${suffix}`);
            } catch (e) { /* ignore */ }
        });
    }

    authStore.set(initialState);
    if (browser) window.location.assign(LOGIN_PATH);
}

// --- SILENT TOKEN REFRESH (raw call — use refreshOnce, never this directly) ---
// Returns { access, refresh } on success, { rejected: true } when the server
// refused the refresh token (expired/revoked), { network: true } when the
// server couldn't be reached (we must NOT log the user out for that).
async function refreshTokens(oldRefreshToken) {
    let res;
    try {
        res = await fetch(`${API_BASE}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'refresh_token',
                refresh_token: oldRefreshToken,
                client_id: CLIENT_ID
            })
        });
    } catch (e) {
        console.warn("[auth] token refresh: network error", e);
        return { network: true };
    }

    if (!res.ok) {
        console.error("[auth] refresh token expired or revoked (HTTP " + res.status + ").");
        return { rejected: true };
    }

    let data;
    try {
        data = await res.json();
    } catch (e) {
        return { network: true };
    }
    if (!data || !data.access_token) return { rejected: true };

    const storage = tokenStorage();
    storage.setItem(ACCESS_KEY, data.access_token);
    if (data.refresh_token) storage.setItem(REFRESH_KEY, data.refresh_token);

    const refresh = data.refresh_token || oldRefreshToken;
    setSession(data.access_token, refresh);
    return { access: data.access_token, refresh };
}

// --- SINGLE-FLIGHT REFRESH ---
// One refresh at a time in this tab; across tabs, a Web Lock serialises them.
// Inside the lock we re-read storage first: if another call/tab already
// rotated the tokens, we use the fresh access token instead of spending the
// (now-stale) refresh token, which would trip reuse detection.
let refreshInFlight = null;

function refreshOnce(staleAccess = null) {
    if (!browser) return Promise.resolve({ network: true });
    if (refreshInFlight) return refreshInFlight;

    const run = async () => {
        const current = readKey(ACCESS_KEY);
        if (current && current !== staleAccess && !isTokenExpired(current)) {
            return { access: current, refresh: readKey(REFRESH_KEY) };
        }
        const rt = readKey(REFRESH_KEY);
        if (!rt) return { rejected: true };
        return refreshTokens(rt);
    };

    const locked = (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request)
        ? navigator.locks.request('akritio-token-refresh', run)
        : run();

    refreshInFlight = Promise.resolve(locked).finally(() => {
        refreshInFlight = null;
    });
    return refreshInFlight;
}

// --- PUBLIC: a usable access token (refreshed if needed), or '' if logged out ---
export async function getValidAccessToken() {
    if (!browser) return '';
    const access = readKey(ACCESS_KEY);
    if (access && !isTokenExpired(access)) return access;
    if (!readKey(REFRESH_KEY)) return '';
    const t = await refreshOnce(access);
    return t && t.access ? t.access : '';
}

// --- PUBLIC: fetch with auth + one transparent refresh-and-retry on 401 ---
// Works with JSON and FormData bodies (both can be re-sent). Never set
// Content-Type for FormData — the browser adds the multipart boundary.
export async function authFetch(url, options = {}) {
    const send = (token) => {
        const headers = new Headers(options.headers || {});
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return fetch(url, { ...options, headers });
    };

    const token = await getValidAccessToken();
    let res = await send(token);

    // Server rejected a token we thought was valid (clock skew, rotated in
    // another tab, revoked) — refresh once and retry.
    if (res.status === 401 && browser && readKey(REFRESH_KEY)) {
        const t = await refreshOnce(token);
        if (t && t.access && t.access !== token) {
            res = await send(t.access);
        }
    }
    return res;
}

// --- PUBLIC: "is this account Pro?" ---
// Returns { loggedIn, active, plan, data, error }.
//  • error is set only for failures that say nothing about the plan (server
//    down, 500…). Callers should keep their previous plan state in that case
//    instead of downgrading a paying user to Free.
export async function fetchSubscriptionStatus() {
    if (!browser) return { loggedIn: false, active: false, plan: null, data: null, error: '' };

    const token = await getValidAccessToken();
    if (!token) return { loggedIn: false, active: false, plan: null, data: null, error: '' };

    try {
        const res = await authFetch(`${API_BASE}/akritio/subscription/status`, { cache: 'no-store' });
        if (res.status === 401) {
            return { loggedIn: false, active: false, plan: null, data: null, error: '' };
        }
        if (!res.ok) {
            let detail = '';
            try { detail = await res.text(); } catch (_) {}
            console.warn('[akritio] subscription status failed', res.status, detail);
            return { loggedIn: true, active: false, plan: null, data: null, error: `Couldn't check your plan (HTTP ${res.status}).` };
        }
        const j = await res.json();
        console.debug('[akritio] subscription status', j);
        return { loggedIn: true, active: !!(j && j.active), plan: (j && j.plan) || null, data: j, error: '' };
    } catch (e) {
        console.warn('[akritio] subscription status error', e);
        return { loggedIn: true, active: false, plan: null, data: null, error: "Couldn't reach the server to check your plan." };
    }
}

// --- INITIALIZE AUTH (call in +layout.svelte onMount; pages may await it too) ---
let initPromise = null;

export function initAuth() {
    if (!browser) return Promise.resolve();
    if (!initPromise) {
        initPromise = doInitAuth().finally(() => {
            // allow a later re-init (e.g. after logging in on another tab)
            setTimeout(() => { initPromise = null; }, 0);
        });
    }
    return initPromise;
}

async function doInitAuth() {
    let access = readKey(ACCESS_KEY);
    let refresh = readKey(REFRESH_KEY);

    // Access token missing or expired but we have a refresh token -> rotate.
    if ((!access || isTokenExpired(access)) && refresh) {
        const t = await refreshOnce(access);
        if (t && t.access) {
            access = t.access;
            refresh = t.refresh;
        } else if (t && t.rejected) {
            // Refresh refused (expired, or family revoked by reuse detection)
            await logout();
            return;
        } else {
            // Network problem: keep the user signed in and try again later.
            return;
        }
    }

    // Populate store if we have a valid access token
    if (access && !isTokenExpired(access)) {
        setSession(access, refresh);
    } else if (access && !refresh) {
        // Expired access token and nothing to refresh it with.
        await logout();
    }
}