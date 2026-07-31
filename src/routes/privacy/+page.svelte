<script>
	import { site } from '$lib/content.js';
	import LegalShell from '$lib/components/LegalShell.svelte';

	const updated = '31 July 2026';

	const toc = [
		{ id: 'intro', label: 'Introduction' },
		{ id: 'collect', label: 'What we collect' },
		{ id: 'use', label: 'How we use it' },
		{ id: 'files', label: 'Your uploaded files' },
		{ id: 'cookies', label: 'Cookies & storage' },
		{ id: 'third-parties', label: 'Third parties' },
		{ id: 'sharing', label: 'Sharing' },
		{ id: 'security', label: 'Security' },
		{ id: 'retention', label: 'Retention' },
		{ id: 'rights', label: 'Your rights' },
		{ id: 'children', label: 'Children' },
		{ id: 'changes', label: 'Changes' },
		{ id: 'contact', label: 'Contact' }
	];
</script>

<svelte:head>
	<title>Privacy Policy — {site.name}</title>
	<meta name="description" content={`How ${site.name} handles your data, uploaded files, and accounts.`} />
	<link rel="canonical" href="https://akritio.com/privacy" />
</svelte:head>

<LegalShell title="Privacy Policy" {updated} {toc}>
	<section id="intro">
		<h2>Introduction</h2>
		<p>
			This policy explains how {site.name} at akritio.com, operated by [Navi3D — full legal entity
			name], handles your information. We aim to collect <span class="mark">as little as possible</span>
			to run the Service.
		</p>
	</section>

	<section id="collect">
		<h2>What we collect</h2>
		<ul>
			<li><b>Account details</b> — if you sign up, your name and email; if you use Google or GitHub sign-in, the basic profile info those providers share with us.</li>
			<li><b>Files you upload</b> — the 3D models you submit for mould generation, and the settings you choose.</li>
			<li><b>Technical data</b> — standard server/access logs such as IP address, browser type, and pages requested, used for security and to keep the Service running.</li>
			<li><b>Messages</b> — anything you send us via the contact form or email.</li>
		</ul>
	</section>

	<section id="use">
		<h2>How we use it</h2>
		<ul>
			<li>To generate moulds from your models and return them to you.</li>
			<li>To create and manage your account, if you have one.</li>
			<li>To keep the Service secure, prevent abuse, and diagnose problems.</li>
			<li>To respond to your messages.</li>
		</ul>
		<p>We do <span class="mark">not</span> sell your personal data or use it for third-party advertising.</p>
	</section>

	<section id="files">
		<h2>Your uploaded files</h2>
		<p>
			When you generate a mould, your model is sent to our processing backend to produce the output.
			We use your files only to provide that result. [State your real handling: e.g. “Uploaded files
			are processed and then deleted within [X hours]” or “stored against your account until you
			delete them”.] We don’t use your models to train anything or share them with other users.
		</p>
	</section>

	<section id="cookies">
		<h2>Cookies & local storage</h2>
		<p>
			We use cookies and browser storage only for essentials — keeping you signed in, remembering
			preferences, and security. We don’t use third-party advertising or cross-site tracking cookies.
		</p>
	</section>

	<section id="third-parties">
		<h2>Third parties we rely on</h2>
		<ul>
			<li><b>Cloudflare</b> — CDN, DNS and security (including the Turnstile anti-abuse check on some forms).</li>
			<li><b>Google & GitHub</b> — only if you choose to sign in with them, to verify your identity.</li>
			<li><b>Our hosting</b> — the Service runs on servers we operate.</li>
		</ul>
		<p>These providers process data on our behalf under their own terms and privacy policies.</p>
	</section>

	<section id="sharing">
		<h2>Sharing</h2>
		<p>
			We share personal data only with the processors above, or where we’re legally required to, or
			to protect the Service and its users. We don’t sell it.
		</p>
	</section>

	<section id="security">
		<h2>Security</h2>
		<p>
			We use reasonable technical and organisational measures — including HTTPS everywhere — to
			protect your data. No system is perfectly secure, but we work to keep your information safe and
			to respond quickly if something goes wrong.
		</p>
	</section>

	<section id="retention">
		<h2>Retention</h2>
		<p>
			We keep account data for as long as your account is active, and other data only as long as
			needed for the purposes above or as required by law. [Confirm your file-retention window here to
			match the “Your uploaded files” section.]
		</p>
	</section>

	<section id="rights">
		<h2>Your rights</h2>
		<p>
			You can ask us to access, correct, or delete your personal data, or to close your account.
			Depending on where you live (including under India’s Digital Personal Data Protection Act,
			where applicable), you may have additional rights. To make a request, email
			<a href="mailto:hello@akritio.com">hello@akritio.com</a>.
		</p>
	</section>

	<section id="children">
		<h2>Children</h2>
		<p>
			The Service isn’t directed at children under [13 / the age set by your local law], and we don’t
			knowingly collect their data. If you believe a child has given us personal data, contact us and
			we’ll remove it.
		</p>
	</section>

	<section id="changes">
		<h2>Changes</h2>
		<p>
			We may update this policy from time to time; the “last updated” date above reflects the latest
			version. Material changes may be highlighted on the site.
		</p>
	</section>

	<section id="contact">
		<h2>Contact</h2>
		<p>
			Questions about your privacy? Email <a href="mailto:hello@akritio.com">hello@akritio.com</a> or
			use our <a href="/contact">contact page</a>.
		</p>
	</section>
</LegalShell>