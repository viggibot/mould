<script>
	import { site } from '$lib/content.js';
	import LegalShell from '$lib/components/LegalShell.svelte';

	const updated = '5 August 2026';

	const toc = [
		{ id: 'agreement', label: 'The agreement' },
		{ id: 'service', label: 'The service' },
		{ id: 'accounts', label: 'Accounts' },
		{ id: 'plans', label: 'Plans & pricing' },
		{ id: 'payments', label: 'Payments' },
		{ id: 'subscriptions', label: 'Renewal & cancellation' },
		{ id: 'refunds', label: 'Refunds' },
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
	<meta name="description" content={`The terms that govern your use of ${site.name}, a browser-based mould generator with free and paid plans.`} />
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
			{site.name} is a browser-based tool that turns 3D models you provide into print-ready mould
			geometry for casting in silicone, resin and concrete. Generation runs on our servers; you
			upload a model and we return mould files.
		</p>
		<p>
			The Service is offered on both a <b>free plan</b> and <b>paid subscription plans</b> (see
			<a href="/pricing">Pricing</a>). It is provided on an ongoing “as available” basis, and we may
			add, change, or remove features, limits, plans, or availability at any time.
		</p>
	</section>

	<section id="accounts">
		<h2>Accounts</h2>
		<p>
			Some features — including any paid plan — require an account, which you can create directly or
			through Google or GitHub sign-in. You’re responsible for activity under your account and for
			keeping your credentials secure. You must provide accurate information and be old enough to
			form a binding contract in your jurisdiction.
		</p>
	</section>

	<section id="plans">
		<h2>Plans & pricing</h2>
		<p>
			We offer a free plan and one or more paid plans. Current plans, features and prices are shown
			on our <a href="/pricing">Pricing</a> page and form part of these Terms when you subscribe.
		</p>
		<ul>
			<li>
				<b>Currency & region.</b> Prices are shown in Indian Rupees (₹) for customers in India and
				in US Dollars ($) for customers elsewhere, based on your region. Each currency has its own
				price — it is not a live conversion of the other.
			</li>
			<li>
				<b>Taxes.</b> Prices for customers in India are <span class="mark">inclusive of GST</span>
				unless stated otherwise. For customers outside India, prices are exclusive of any local
				taxes, duties, or charges that may apply in your country, which are your responsibility.
			</li>
			<li>
				<b>Price changes.</b> We may change plan prices. Any change to the price of a plan you’re
				already subscribed to takes effect only from your next renewal, and we’ll give you
				reasonable notice beforehand.
			</li>
		</ul>
	</section>

	<section id="payments">
		<h2>Payments</h2>
		<p>
			Paid plans are billed through our payment processor,
			<b>Razorpay</b> [Razorpay Software Private Limited]. When you pay, you also agree to the
			processor’s own terms, and you confirm you’re authorised to use the payment method.
		</p>
		<ul>
			<li>
				<b>Accepted methods.</b> In India, you can pay by UPI, cards, net-banking, wallets or EMI.
				For international payments, we accept international credit and debit cards, which are
				verified with 3-D Secure.
			</li>
			<li>
				<b>Card & payment data.</b> Your card, UPI, and bank details are entered with and handled
				directly by Razorpay. <span class="mark">We never receive or store your full payment
				details</span> on our servers.
			</li>
			<li>
				<b>Invoices.</b> We issue an invoice for each successful payment to your account email.
			</li>
		</ul>
		<div class="note">
			International card payments require the card to support cross-border transactions and 3-D
			Secure. Some banks decline these by default — that’s a decision made by your bank, not by us.
		</div>
	</section>

	<section id="subscriptions">
		<h2>Renewal & cancellation</h2>
		<p>
			Paid plans are subscriptions billed on a recurring <b>monthly</b> cycle. Your subscription
			<span class="mark">renews automatically</span> at the then-current price each month until you
			cancel.
		</p>
		<ul>
			<li>
				<b>Cancelling.</b> You can cancel any time from your account dashboard, or by contacting us.
				Cancellation stops future renewals; your paid access continues until the end of the period
				you’ve already paid for.
			</li>
			<li>
				<b>Failed payments.</b> If a renewal payment fails, we may retry it and, if it keeps
				failing, suspend or downgrade the paid features until payment succeeds.
			</li>
		</ul>
		<div class="note">
			By subscribing to a paid plan you authorise us and our payment processor to charge the
			applicable fee to your chosen payment method on each monthly renewal, until you cancel.
			Recurring authorisations are handled by the payment processor in line with applicable
			regulations.
		</div>
	</section>

	<section id="refunds">
		<h2>Refunds</h2>
		<p>
			Except where required by law, subscription fees are <b>non-refundable</b>, and we don’t provide
			refunds or credits for partial billing periods or unused time. Cancelling stops future charges
			but doesn’t refund the current period. [Optional: state any goodwill/refund window here, e.g.
			“We’ll refund a charge if you cancel within 7 days of your first payment and haven’t exported a
			paid mould.”]
		</p>
		<p>
			If you were charged in error or believe there’s a billing problem, contact us at
			<a href="mailto:hello@akritio.com">hello@akritio.com</a> and we’ll look into it.
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
			<li>Use a payment method you’re not authorised to use, or attempt fraudulent or abusive transactions.</li>
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
			Service. Our total liability to you for any claim is limited to the greater of [₹ nominal
			amount, e.g. ₹5,000] or the total amount you paid us for the Service in the 12 months before
			the event giving rise to the claim.
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
			You can stop using the Service any time, and cancel a paid plan as described under
			<a href="#subscriptions">Renewal & cancellation</a>. We may suspend or end access — including
			paid features for non-payment — if you breach these Terms or misuse the Service. Sections that
			by their nature should survive (ownership, payment obligations already incurred, warranty
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