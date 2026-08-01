export function load({ request, getClientAddress }) {
	// Most hosts inject a country header. Read the common ones.
	const h = request.headers;
	const country =
		h.get('x-vercel-ip-country') || // Vercel
		h.get('cf-ipcountry') || // Cloudflare
		h.get('x-country-code') || // some proxies
		'';

	// India → INR, everyone else → USD. Adjust the list if you want more INR regions.
	const currency = country.toUpperCase() === 'IN' ? 'INR' : 'USD';

	return { currency };
}