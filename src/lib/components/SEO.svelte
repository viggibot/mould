<script>
	import { SITE_URL, site } from '$lib/content.js';

	let {
		title = site.tagline,
		description = site.description,
		// Path of the current page, starting with "/". Used for the canonical URL.
		path = '/',
		image = site.ogImage,
		// Pass the faqs array on pages that show an FAQ to emit FAQPage rich results.
		faqs = []
	} = $props();

	const fullTitle = $derived(`${title} | ${site.name}`);
	const canonical = $derived(`${SITE_URL}${path === '/' ? '' : path}`);
	const imageUrl = $derived(image.startsWith('http') ? image : `${SITE_URL}${image}`);

	// --- Structured data -----------------------------------------------------
	const appSchema = $derived({
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: site.name,
		alternateName: 'Mold Generator',
		url: SITE_URL,
		description: site.description,
		applicationCategory: 'DesignApplication',
		operatingSystem: 'Web browser',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
	});

	const orgSchema = $derived({
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: site.name,
		url: SITE_URL,
		logo: `${SITE_URL}/favicon.svg`
	});

	const faqSchema = $derived(
		faqs.length > 0
			? {
					'@context': 'https://schema.org',
					'@type': 'FAQPage',
					mainEntity: faqs.map((f) => ({
						'@type': 'Question',
						name: f.q,
						acceptedAnswer: { '@type': 'Answer', text: f.a }
					}))
				}
			: null
	);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta name="robots" content="index, follow, max-image-preview:large" />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={site.name} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={imageUrl} />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={imageUrl} />
	<meta name="twitter:site" content={site.twitter} />

	<!-- Structured data -->
	{@html `<script type="application/ld+json">${JSON.stringify(appSchema)}<` + `/script>`}
	{@html `<script type="application/ld+json">${JSON.stringify(orgSchema)}<` + `/script>`}
	{#if faqSchema}
		{@html `<script type="application/ld+json">${JSON.stringify(faqSchema)}<` + `/script>`}
	{/if}
</svelte:head>