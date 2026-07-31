<script>
	import SEO from '$lib/components/SEO.svelte';
	import Hero from '$lib/components/Hero.svelte';
	import Slicers from '$lib/components/Slicers.svelte';
	import Features from '$lib/components/Features.svelte';
	import HowItWorks from '$lib/components/HowItWorks.svelte';
	import MouldTypes from '$lib/components/MouldTypes.svelte';
	import Materials from '$lib/components/Materials.svelte';
	import UseCases from '$lib/components/UseCases.svelte';
	// import Manufacture from '$lib/components/Manufacture.svelte';
	import CtaBanner from '$lib/components/CtaBanner.svelte';
	import Faq from '$lib/components/Faq.svelte';
	import { faqs } from '$lib/content.js';
</script>

<SEO path="/" {faqs} />

<Hero />
<Slicers />
<Features />
<HowItWorks />
<MouldTypes />
<Materials />
<UseCases />
<!-- <Manufacture /> -->
<CtaBanner />
<Faq />