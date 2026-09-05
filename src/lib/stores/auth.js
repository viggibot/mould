import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { PUBLIC_API_BASE_URL } from "$env/static/public";

const API_BASE = PUBLIC_API_BASE_URL; // Update to your production API URL
const CLIENT_ID = 'akritio';

// Where to send the user after a full logout.
const LOGIN_PATH = '/login';

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

// --- LOGOUT ACTION ---
export async function logout() {
    if (browser) {
        const refreshToken = localStorage.getItem('akritio_refresh_token') || sessionStorage.getItem('akritio_refresh_token');

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
            localStorage.removeItem(`akritio_${suffix}`);
            sessionStorage.removeItem(`akritio_${suffix}`);
        });
    }
    
    authStore.set(initialState);
    window.location.assign(LOGIN_PATH);
}

// --- SILENT TOKEN REFRESH ---
async function refreshTokens(oldRefreshToken) {
    try {
        const res = await fetch(`${API_BASE}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'refresh_token',
                refresh_token: oldRefreshToken,
                client_id: CLIENT_ID
            })
        });

        if (!res.ok) throw new Error("Token rotation failed");

        const data = await res.json();
        
        // Determine storage medium based on where the old token was found
        const storage = localStorage.getItem('akritio_refresh_token') ? localStorage : sessionStorage;
        
        storage.setItem('akritio_access_token', data.access_token);
        storage.setItem('akritio_refresh_token', data.refresh_token);

        return {
            access: data.access_token,
            refresh: data.refresh_token
        };
    } catch (error) {
        console.error("Refresh token expired or revoked.");
        return null;
    }
}

// --- INITIALIZE AUTH (Call this in +layout.svelte onMount) ---
export async function initAuth() {
    if (!browser) return;

    let access = localStorage.getItem('akritio_access_token') || sessionStorage.getItem('akritio_access_token');
    let refresh = localStorage.getItem('akritio_refresh_token') || sessionStorage.getItem('akritio_refresh_token');

    // If access token is expired but we have a refresh token, rotate them
    if (access && isTokenExpired(access) && refresh) {
        const newTokens = await refreshTokens(refresh);
        if (newTokens) {
            access = newTokens.access;
            refresh = newTokens.refresh;
        } else {
            // Refresh failed (e.g., family revoked due to reuse detection)
            await logout();
            return;
        }
    }

    // Populate store if we have a valid access token
    if (access && !isTokenExpired(access)) {
        const decoded = parseJwt(access);
        if (decoded) {
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
    } else if (access || refresh) {
        // Fallback for invalid state
        await logout();
    }
}