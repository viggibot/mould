<script>
	import { site } from '$lib/content.js';
	import LegalShell from '$lib/components/LegalShell.svelte';

	const updated = '31 July 2026';

	const toc = [
		{ id: 'agreement', label: 'The agreement' },
		{ id: 'service', label: 'The service' },
		{ id: 'accounts', label: 'Accounts' },
		{ id: 'your-content', label: 'Your files & content' },
		{ id: 'acceptable-use', label: 'Acceptable use' },
		{ id: 'manufacturing', label: 'Printing by Navi3D' },
		{ id: 'ip', label: 'Our intellectual property' },
		{ id: 'warranty', label: 'No warranty' },
		{ id: 'liability', label: 'Limitation of liability' },
		{ id: 'changes', label: 'Changes' },
		{ id: 'termination', label: 'Termination' },
		{ id: 'law', label: 'Governing law' },
		{ id: 'contact', label: 'Contact' }
	];
</script>

<svelte:head>
	<title>Terms of Service — {site.name}</title>
	<meta name="description" content={`The terms that govern your use of ${site.name}, a free browser-based mould generator.`} />
	<link rel="canonical" href="https://akritio.com/terms" />
</svelte:head>

<LegalShell title="Terms of Service" {updated} {toc}>
	<section id="agreement">
		<h2>The agreement</h2>
		<p>
			These Terms govern your use of {site.name} (the <span class="mark">“Service”</span>) at
			akritio.com, operated by [Navi3D — full legal entity name, e.g. Navi3D Technologies, Vashi,
			Navi Mumbai] (<b>“we”</b>, <b>“us”</b>). By using the Service you agree to these Terms. If you
			don’t agree, please don’t use it.
		</p>
	</section>

	<section id="service">
		<h2>The service</h2>
		<p>
			{site.name} is a free, browser-based tool that turns 3D models you provide into print-ready
			mould geometry for casting in silicone, resin and concrete. Generation runs on our servers;
			you upload a model and we return mould files.
		</p>
		<p>
			The Service is provided on an ongoing “as available” basis. We may add, change, or remove
			features, limits, or availability at any time.
		</p>
	</section>

	<section id="accounts">
		<h2>Accounts</h2>
		<p>
			Some features may require an account, which you can create directly or through Google or
			GitHub sign-in. You’re responsible for activity under your account and for keeping your
			credentials secure. You must provide accurate information and be old enough to form a binding
			contract in your jurisdiction.
		</p>
	</section>

	<section id="your-content">
		<h2>Your files & content</h2>
		<p>
			You keep all rights to the 3D models and files you upload (<span class="mark">“Your Content”</span>).
			We don’t claim ownership. You grant us a limited licence to store and process Your Content
			only as needed to run the Service — for example, to generate a mould and return it to you.
		</p>
		<p>
			You’re responsible for making sure you have the rights to any model you upload, and that it
			doesn’t infringe anyone’s intellectual property or other rights.
		</p>
	</section>

	<section id="acceptable-use">
		<h2>Acceptable use</h2>
		<p>You agree not to:</p>
		<ul>
			<li>Upload models you don’t have the right to use, or that infringe third-party rights.</li>
			<li>Use the Service to create parts intended to cause harm, or anything unlawful.</li>
			<li>Attempt to disrupt, overload, reverse-engineer, or gain unauthorised access to the Service or its infrastructure.</li>
			<li>Abuse, scrape, or resell the Service or its output in violation of these Terms.</li>
		</ul>
	</section>

	<section id="manufacturing">
		<h2>Printing & manufacturing by Navi3D</h2>
		<p>
			You can optionally ask Navi3D to 3D-print or manufacture your mould. That’s a separate,
			optional service with its own quote, pricing, lead time and terms agreed at the time of order.
			Nothing here obligates either side until such an order is confirmed.
		</p>
	</section>

	<section id="ip">
		<h2>Our intellectual property</h2>
		<p>
			The Service itself — the site, {site.name} branding, generator, code, and design — belongs to
			us and our licensors, and is protected by law. These Terms don’t transfer any of those rights
			to you. The mould files generated from Your Content are yours to use.
		</p>
	</section>

	<section id="warranty">
		<h2>No warranty</h2>
		<p>
			The Service is provided <span class="mark">“as is”</span> and “as available”, without
			warranties of any kind. Generated moulds may not be perfect, watertight, or suitable for every
			material or process.
		</p>
		<div class="note">
			Always review and test a generated mould before casting. You’re responsible for verifying
			fit, draft angles, wall thickness, and safety for your material and use case.
		</div>
	</section>

	<section id="liability">
		<h2>Limitation of liability</h2>
		<p>
			To the maximum extent permitted by law, we’re not liable for any indirect, incidental, or
			consequential damages, or for lost profits, data, or materials, arising from your use of the
			Service. Because the Service is free, our total liability to you is limited to [₹ nominal
			amount, e.g. ₹1,000] or the amount you paid us in the last 12 months, whichever is greater.
		</p>
	</section>

	<section id="changes">
		<h2>Changes to these Terms</h2>
		<p>
			We may update these Terms from time to time. When we do, we’ll change the “last updated” date
			above, and material changes may be highlighted on the site. Continuing to use the Service after
			an update means you accept the revised Terms.
		</p>
	</section>

	<section id="termination">
		<h2>Termination</h2>
		<p>
			You can stop using the Service any time. We may suspend or end access if you breach these
			Terms or misuse the Service. Sections that by their nature should survive (ownership, warranty
			disclaimers, liability limits, governing law) continue after termination.
		</p>
	</section>

	<section id="law">
		<h2>Governing law</h2>
		<p>
			These Terms are governed by the laws of India, and the courts of [Mumbai / Navi Mumbai,
			Maharashtra] have exclusive jurisdiction over any dispute, subject to applicable law.
		</p>
	</section>

	<section id="contact">
		<h2>Contact</h2>
		<p>
			Questions about these Terms? Reach us at <a href="mailto:hello@akritio.com">hello@akritio.com</a>
			or through our <a href="/contact">contact page</a>.
		</p>
	</section>
</LegalShell>