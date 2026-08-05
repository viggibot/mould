// src/routes/pricing/+page.server.js
// India → INR, everyone else → USD. Unchanged from your version.
export function load({ request, getClientAddress }) {
	const h = request.headers;
	const country =
		h.get('x-vercel-ip-country') || // Vercel
		h.get('cf-ipcountry') || // Cloudflare
		h.get('x-country-code') || // some proxies
		'';

	const currency = country.toUpperCase() === 'IN' ? 'INR' : 'USD';

	return { currency };
}