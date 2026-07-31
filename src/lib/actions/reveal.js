// Scroll-reveal action — fades + lifts an element into view once.
// Usage:  <div use:reveal>            or   <div use:reveal={{ delay: 120, y: 30 }}>
// No dependencies, progressive enhancement (content is visible without JS),
// and it opts out entirely when the user prefers reduced motion.
export function reveal(node, options = {}) {
	const { delay = 0, y = 22, duration = 620 } = options;

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduce) return {};

	node.style.opacity = '0';
	node.style.transform = `translate3d(0, ${y}px, 0)`;
	node.style.transition = `opacity ${duration}ms ease ${delay}ms, transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms`;
	node.style.willChange = 'opacity, transform';

	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					node.style.opacity = '1';
					node.style.transform = 'none';
					io.unobserve(node);
				}
			}
		},
		{ threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
	);

	io.observe(node);
	return { destroy: () => io.disconnect() };
}