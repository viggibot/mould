<script>
	import { site } from '$lib/content.js';
	import LegalShell from '$lib/components/LegalShell.svelte';

	const updated = '5 August 2026';

	const toc = [
		{ id: 'intro', label: 'Introduction' },
		{ id: 'collect', label: 'What we collect' },
		{ id: 'use', label: 'How we use it' },
		{ id: 'files', label: 'Your uploaded files' },
		{ id: 'payments', label: 'Payments & billing' },
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
	<meta name="description" content={`How ${site.name} handles your data, uploaded files, accounts, and payments.`} />
	<link rel="canonical" href="https://akritio.com/privacy" />
</svelte:head>

<LegalShell title="Privacy Policy" {updated} {toc}>
	<section id="intro">
		<h2>Introduction</h2>
		<p>
			This policy explains how {site.name} at akritio.com, operated by [Navi3D — full legal entity
			name], handles your information. We aim to collect <span class="mark">as little as possible</span>
			to run the Service, including its paid plans.
		</p>
	</section>

	<section id="collect">
		<h2>What we collect</h2>
		<ul>
			<li><b>Account details</b> — if you sign up, your name and email; if you use Google or GitHub sign-in, the basic profile info those providers share with us.</li>
			<li><b>Files you upload</b> — the 3D models you submit for mould generation, and the settings you choose.</li>
			<li><b>Billing information</b> — if you subscribe to a paid plan: your plan, billing currency/region, the billing address you provide for international card payments, and payment references we receive from our processor (such as order, payment and invoice IDs, amount, and status). <span class="mark">We don’t receive or store your full card, UPI, or bank-account details.</span></li>
			<li><b>Technical data</b> — standard server/access logs such as IP address, browser type, and pages requested, used for security and to keep the Service running.</li>
			<li><b>Messages</b> — anything you send us via the contact form or email.</li>
		</ul>
	</section>

	<section id="use">
		<h2>How we use it</h2>
		<ul>
			<li>To generate moulds from your models and return them to you.</li>
			<li>To create and manage your account, if you have one.</li>
			<li>To take payment, manage your subscription and renewals, issue invoices, and detect or prevent payment fraud.</li>
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

	<section id="payments">
		<h2>Payments & billing</h2>
		<p>
			Paid plans are processed by <b>Razorpay</b> [Razorpay Software Private Limited], our payment
			processor. Your card, UPI, or bank details are entered directly through Razorpay’s secure
			checkout and are <span class="mark">not stored on our servers</span>.
		</p>
		<p>
			From Razorpay we receive only the information needed to confirm a payment and run your
			subscription — such as the payment and order IDs, amount, currency, status, and, for
			international card payments, the billing address you enter. We use this to activate your plan,
			handle renewals, and issue an invoice.
		</p>
		<p>
			Invoices we generate (containing your name, email, billing details, plan and amount) are stored
			securely so we can meet our accounting and tax obligations.
		</p>
	</section>

	<section id="cookies">
		<h2>Cookies & local storage</h2>
		<p>
			We use cookies and browser storage only for essentials — keeping you signed in, remembering
			preferences, processing payments, and security. We don’t use third-party advertising or
			cross-site tracking cookies.
		</p>
	</section>

	<section id="third-parties">
		<h2>Third parties we rely on</h2>
		<ul>
			<li><b>Razorpay</b> — payment processing. Razorpay collects and handles your card/UPI/bank details directly under its own PCI-DSS-compliant systems and privacy policy.</li>
			<li><b>Cloudflare</b> — CDN, DNS and security (including the Turnstile anti-abuse check on some forms), and object storage for generated invoices.</li>
			<li><b>MSG91</b> — sending transactional emails such as order confirmations and invoices.</li>
			<li><b>Google & GitHub</b> — only if you choose to sign in with them, to verify your identity.</li>
			<li><b>Our hosting</b> — the Service runs on servers we operate.</li>
		</ul>
		<p>These providers process data on our behalf under their own terms and privacy policies.</p>
	</section>

	<section id="sharing">
		<h2>Sharing</h2>
		<p>
			We share personal data only with the processors above (including our payment processor to take
			payment), or where we’re legally required to, or to protect the Service and its users. We don’t
			sell it.
		</p>
	</section>

	<section id="security">
		<h2>Security</h2>
		<p>
			We use reasonable technical and organisational measures — including HTTPS everywhere — to
			protect your data. Payment details are handled directly by our payment processor and don’t pass
			through our servers. No system is perfectly secure, but we work to keep your information safe
			and to respond quickly if something goes wrong.
		</p>
	</section>

	<section id="retention">
		<h2>Retention</h2>
		<p>
			We keep account data for as long as your account is active, and other data only as long as
			needed for the purposes above or as required by law. [Confirm your file-retention window here to
			match the “Your uploaded files” section.]
		</p>
		<p>
			Billing records and invoices are kept for as long as required by applicable accounting and tax
			law [e.g. up to 8 years under Indian law], even after you close your account.
		</p>
	</section>

	<section id="rights">
		<h2>Your rights</h2>
		<p>
			You can ask us to access, correct, or delete your personal data, or to close your account.
			Depending on where you live (including under India’s Digital Personal Data Protection Act,
			where applicable), you may have additional rights. Note that we may need to retain certain
			billing records to meet legal obligations even after a deletion request. To make a request,
			email <a href="mailto:hello@akritio.com">hello@akritio.com</a>.
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