// The studio is a client-side WebGL app — render it in the browser only so
// three.js never loads during SSR/prerender.
export const ssr = false;
export const prerender = false;