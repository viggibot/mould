// ---------------------------------------------------------------------------
// Site config + all landing-page copy in one place.
// ---------------------------------------------------------------------------

// Add PUBLIC_SITE_URL to your .env (no trailing slash), e.g.
//   PUBLIC_SITE_URL=https://mouldgenerator.com

export const SITE_URL = "https://akritio.com";

export const site = {
	name: 'Mould Generator',
	poweredBy: 'Navi3D',
	tagline: 'Turn any 3D model into a print-ready mould',
	description:
		'Mould Generator is a free online tool that turns any 3D model into a two-part, print-ready mould. Detect the parting line, add registration keys, sprue and vents, then export STL for FDM or resin and cast in silicone, resin, concrete and wax. Works for both mould and mold makers. Powered by Navi3D.',
	ogImage: '/og-image.png',
	twitter: '@navi3d',
	locale: 'en'
};

// Honest product facts used as the "stats" band — not invented user counts.
export const stats = [
	{ big: '±0.01 mm', label: 'CAD-exact cavities' },
	{ big: '2 · 4 · 6', label: 'part moulds' },
	{ big: '4 formats', label: 'STL · OBJ · 3MF · STEP' },
	{ big: '0 login', label: 'runs in your browser' }
];

// Compatibility strip — the trust/logo-row equivalent.
export const slicers = ['Cura', 'PrusaSlicer', 'Bambu Studio', 'OrcaSlicer', 'Simplify3D'];

export const materials = [
	'Silicone',
	'Resin',
	'Concrete',
	'Plaster',
	'Wax',
	'Soap',
	'Chocolate',
	'Metal (lost-PLA)'
];

export const features = [
	{
		title: 'Automatic parting line',
		body: 'Upload a model and the generator finds the cleanest split, so the two halves separate without undercuts trapping your cast.'
	},
	{
		title: 'Registration keys',
		body: 'Cones and sockets are placed on the mating face automatically, so the halves align perfectly every pour.'
	},
	{
		title: 'Sprue & vents',
		body: 'Add a pour funnel and air vents where they belong, so material flows in and trapped air escapes.'
	},
	{
		title: 'Wall thickness control',
		body: 'Set the shell around your part in millimetres to balance strength against material and print time.'
	},
	{
		title: 'Multi-part moulds',
		body: 'Split complex geometry into four or six pieces that pull sideways, so side undercuts still release cleanly.'
	},
	{
		title: 'Print-ready STL export',
		body: 'Download watertight, manifold STL files that slice cleanly in Cura, PrusaSlicer, Bambu Studio or Orca.'
	}
];

export const steps = [
	{
		n: '01',
		title: 'Upload your model',
		body: 'Drop in an STL, OBJ, 3MF or STEP file. Your geometry stays in your browser session — nothing is shared.'
	},
	{
		n: '02',
		title: 'Tune it live',
		body: 'Set wall thickness, parting, keys and vents in the studio. The 3D preview updates the moment you change a value.'
	},
	{
		n: '03',
		title: 'Export & print',
		body: 'Download the mould halves as STL, print them on FDM or resin, then cast in the material of your choice.'
	}
];

export const useCases = [
	{
		title: 'Jewellery & casting',
		body: 'Moulds for lost-PLA metal casting and resin gems, with crisp registration and ±0.01 mm cavities.'
	},
	{
		title: 'Prop & cosplay',
		body: 'Cast repeat parts in resin or silicone instead of reprinting them one at a time.'
	},
	{
		title: 'Product prototyping',
		body: 'Pour short runs of urethane or silicone parts before committing to hard tooling.'
	},
	{
		title: 'Baking & confectionery',
		body: 'Food-safe silicone moulds for chocolate, fondant and ice from any 3D shape.'
	},
	{
		title: 'Concrete & decor',
		body: 'Cast planters, tiles and homeware in concrete or plaster from reusable printed moulds.'
	},
	{
		title: 'Education & makerspaces',
		body: 'Teach the full digital-to-physical casting workflow with a tool students run in a browser.'
	}
];

export const mouldTypes = {
	fdm: {
		name: 'FDM moulds',
		tagline: 'Bigger, tougher, cheaper',
		printIn: 'PLA · PETG · ABS · PP · TPU',
		surface: 'Visible layer lines — sand them back or seal with an epoxy coat for a glassy cast surface.',
		bestFor: [
			'Concrete, plaster, planters and tiles',
			'Rigid negatives you cast silicone into',
			'Lost-PLA metal casting (burn-out)',
			'Large moulds beyond a resin printer’s volume',
			'Soap, wax and candle moulds'
		],
		watch: 'Print 3–4 walls so the mould stays watertight; coat with epoxy or food-safe resin for a smooth or food-contact surface.'
	},
	sla: {
		name: 'Resin (SLA / MSLA) moulds',
		tagline: 'Fine detail, smooth finish',
		printIn: 'Standard · Tough · High-temp resin',
		surface: 'Smooth straight off the plate — crisp edges and fine texture transfer cleanly to the cast.',
		bestFor: [
			'Jewellery, signets and fine detail',
			'Miniatures and intricate geometry',
			'Master models for silicone moulds',
			'Watertight moulds with no sealing needed',
			'Short-run resin and wax casts'
		],
		watch: 'Wash and fully cure prints or platinum-cure silicone may not set — use tin-cure silicone or a barrier coat. Resin moulds are not food-safe.'
	},
	rule: 'Choose FDM for size and strength, resin for detail and finish. Mould Generator exports clean STLs for both.'
};

export const faqs = [
	{
		q: 'Is this a mould generator or a mold generator?',
		a: 'Both — "mould" and "mold" are the British and American spellings of the same thing. This tool generates casting moulds/molds from your 3D models regardless of which spelling you searched for.'
	},
	{
		q: 'Should I print my mould on an FDM or a resin printer?',
		a: 'Use FDM for large, strong moulds and for casting concrete, plaster or silicone negatives — it is cheaper with a bigger build volume. Use a resin (SLA/MSLA) printer when you need fine detail and a smooth finish, such as jewellery masters or miniatures. Mould Generator exports STLs that suit either.'
	},
	{
		q: 'What file formats can I upload?',
		a: 'You can upload STL, OBJ, 3MF and STEP files. The generated mould halves are exported as watertight STL files ready to slice and print.'
	},
	{
		q: 'What can I cast in the moulds?',
		a: 'Anything you would normally cast: silicone, urethane resin, epoxy, concrete, plaster, wax, soap and even food-safe chocolate. Print the mould in a material suited to your casting medium and temperature.'
	},
	{
		q: 'Do I need CAD experience to use it?',
		a: 'No. If you can download a 3D model and print it, you can make a mould. The generator handles the parting line, registration keys and vents for you, with sensible defaults you can adjust in a live 3D studio.'
	},
	{
		q: 'Is the Mould Generator free?',
		a: 'Yes, the core generator is free to use in your browser. You can upload a model, tune the mould in the studio and export STL files at no cost.'
	},
	{
		q: 'Who makes this?',
		a: 'Mould Generator is built and powered by Navi3D, a 3D printing and fabrication studio. The generator itself is a free online tool — you export your mould as STL files and print them yourself on any FDM or resin printer.'
	}
];

// ---- appended: multi-colour accents ---------------------------------------
export const accents = ['#6c5ce7', '#3b82f6', '#ff7a66', '#17b8a6', '#ec6ec9', '#f6b93b'];
export const accentTints = ['#efecfd', '#e9f1ff', '#ffeee9', '#e3f7f4', '#fcebf7', '#fdf1da'];