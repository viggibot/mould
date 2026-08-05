<script>
	import { site } from '$lib/content.js';
	import LegalShell from '$lib/components/LegalShell.svelte';

	const updated = '5 August 2026';

	const toc = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'window', label: 'The 2-day refund window' },
		{ id: 'non-refundable', label: 'What isn’t refundable' },
		{ id: 'request', label: 'How to request a refund' },
		{ id: 'processing', label: 'How refunds are issued' },
		{ id: 'cancellation', label: 'Cancelling vs refunds' },
		{ id: 'exceptions', label: 'Errors & failed service' },
		{ id: 'chargebacks', label: 'Chargebacks' },
		{ id: 'changes', label: 'Changes' },
		{ id: 'contact', label: 'Contact' }
	];
</script>

<svelte:head>
	<title>Refund Policy — {site.name}</title>
	<meta name="description" content={`How refunds work for ${site.name} paid subscriptions — including the 2-day refund window.`} />
	<link rel="canonical" href="https://akritio.com/refunds" />
</svelte:head>

<LegalShell title="Refund Policy" {updated} {toc}>
	<section id="overview">
		<h2>Overview</h2>
		<p>
			This Refund Policy explains when and how you can get a refund for a paid {site.name}
			subscription. It applies to akritio.com, operated by [Navi3D — full legal entity name], and
			forms part of our <a href="/terms">Terms of Service</a>.
		</p>
		<p>
			In short: you have a <span class="mark">2-day window</span> after a payment to request a full
			refund. After that, subscription payments are non-refundable.
		</p>
	</section>

	<section id="window">
		<h2>The 2-day refund window</h2>
		<p>
			You can request a <b>full refund within 2 days (48 hours)</b> of a subscription payment. The
			window is measured from the payment date and time shown on your invoice.
		</p>
		<div class="note">
			<b>Refund window:</b> 48 hours from the moment you’re charged. Once 2 days have passed, that
			payment is <span class="mark">non-refundable</span>.
		</div>
		<p>
			This window applies to each charge — your first payment and any monthly renewal. If you don’t
			want a plan to renew, cancel before the renewal date (see
			<a href="#cancellation">Cancelling vs refunds</a>); if a renewal is charged, the same 2-day
			window applies to it.
		</p>
	</section>

	<section id="non-refundable">
		<h2>What isn’t refundable</h2>
		<ul>
			<li>Any payment where <b>more than 2 days</b> have passed since you were charged.</li>
			<li>The <b>free plan</b> — nothing is charged, so there’s nothing to refund.</li>
			<li>Unused time after you cancel. Cancelling stops future charges but doesn’t refund the period you’ve already paid for.</li>
			<li>Repeated refund requests that appear to abuse this policy (for example, subscribing and requesting a refund each cycle).</li>
		</ul>
	</section>

	<section id="request">
		<h2>How to request a refund</h2>
		<p>Within the 2-day window, email <a href="mailto:hello@akritio.com">hello@akritio.com</a> from your account email address with:</p>
		<ul>
			<li>your <b>order / invoice ID</b> (from your confirmation email), and</li>
			<li>a short note on the reason (optional, but it helps us improve).</li>
		</ul>
		<p>
			We’ll confirm and process eligible refunds promptly. [Optional: add a “Request a refund” button
			in your account dashboard and link it here.]
		</p>
	</section>

	<section id="processing">
		<h2>How refunds are issued</h2>
		<ul>
			<li><b>Method.</b> Approved refunds are returned to your <b>original payment method</b> through our payment processor, Razorpay. We can’t redirect a refund to a different card, account, or method.</li>
			<li><b>Timeline.</b> Once approved, refunds typically reflect within [5–7 business days], depending on your bank or card issuer.</li>
			<li><b>Currency.</b> You’re refunded in the currency you paid (INR or USD). For international cards, your bank converts the amount back — the figure in your local currency may differ slightly from what you originally paid because of exchange-rate movement between the charge and the refund. That difference is set by your bank and the card network, not by us.</li>
			<li><b>Taxes.</b> Where GST was charged (customers in India), the applicable tax is refunded together with the fee, per tax rules.</li>
			<li><b>Access.</b> When a refund is issued, the related paid access ends.</li>
		</ul>
	</section>

	<section id="cancellation">
		<h2>Cancelling vs refunds</h2>
		<p>
			Cancelling and refunding are different. <b>Cancelling</b> stops future renewals and keeps your
			paid access until the end of the current period — but it does not, by itself, return any money.
			If you want your money back, use the <span class="mark">2-day refund window</span> above.
		</p>
	</section>

	<section id="exceptions">
		<h2>Errors & failed service</h2>
		<p>
			Regardless of the 2-day window, we’ll always sort out genuine billing errors, including:
		</p>
		<ul>
			<li><b>Duplicate or accidental charges</b> — refunded in full.</li>
			<li><b>Charges where we couldn’t deliver</b> the paid service because of a fault on our side — refunded or credited.</li>
		</ul>
		<p>These are handled case by case and don’t count against the standard 2-day rule.</p>
	</section>

	<section id="chargebacks">
		<h2>Chargebacks</h2>
		<p>
			If you think a charge is wrong, please <a href="mailto:hello@akritio.com">contact us first</a> —
			we can almost always resolve it faster than a bank dispute. Raising a chargeback without
			contacting us may lead to your account being suspended while the dispute is investigated.
		</p>
	</section>

	<section id="changes">
		<h2>Changes</h2>
		<p>
			We may update this Refund Policy from time to time; the “last updated” date above reflects the
			latest version. Material changes may be highlighted on the site, and the policy in effect at the
			time of your payment is the one that applies to it.
		</p>
	</section>

	<section id="contact">
		<h2>Contact</h2>
		<p>
			Questions about a refund or a charge? Email
			<a href="mailto:hello@akritio.com">hello@akritio.com</a> or use our
			<a href="/contact">contact page</a>.
		</p>
	</section>
</LegalShell>