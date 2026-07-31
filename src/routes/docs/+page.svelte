<script>
	// "On this page" anchors (right rail) + scroll-spy
	const toc = [
		{ id: 'how', label: 'How it works' },
		{ id: 'anatomy', label: 'What a mould is made of' },
		{ id: 'quickstart', label: 'Quick start' },
		{ id: 'upload', label: '1. Upload your model' },
		{ id: 'setup', label: '2. Mould setup' },
		{ id: 'cavity', label: '3. Cavity and fit' },
		{ id: 'feed', label: '4. Feed system' },
		{ id: 'venting', label: '5. Venting and air valves' },
		{ id: 'keys', label: '6. Registration keys' },
		{ id: 'resolution', label: '7. Resolution' },
		{ id: 'report', label: 'Reading the report' },
		{ id: 'printing', label: 'Downloading and printing' },
		{ id: 'settings', label: 'Recommended settings' },
		{ id: 'plans', label: 'Free and Premium' },
		{ id: 'faq', label: 'Common questions' }
	];

	// left rail — coarse chapters
	const chapters = [
		{ id: 'how', label: 'Overview' },
		{ id: 'anatomy', label: 'Mould anatomy' },
		{ id: 'quickstart', label: 'Quick start' },
		{ id: 'upload', label: 'Settings guide' },
		{ id: 'report', label: 'Report & printing' },
		{ id: 'plans', label: 'Plans & FAQ' }
	];

	const quickStart = [
		{ t: 'Upload your model', d: 'Drop an STL, STEP or 3MF file (up to 200 MB).', c: '#6c5ce7' },
		{ t: 'Pick mould type & pull direction', d: 'Two-part for full shapes; choose the axis with fewest overhangs.', c: '#3b82f6' },
		{ t: 'Set wall, clearance & draft', d: 'Defaults work; draft 0° keeps holes cylindrical.', c: '#17b8a6' },
		{ t: 'Add feed & venting', d: 'Offset the sprue onto a flat area; add air valves.', c: '#ec6ec9' },
		{ t: 'Choose resolution & generate', d: 'Fine (0.3 mm) for detail. Generation takes 10–60 s.', c: '#f6b93b' },
		{ t: 'Download the ZIP & print', d: 'Both mould halves + a report. Read the warnings.', c: '#ff7a66' }
	];

	const settings = [
		{ part: 'Murti or sculpture', mould: 'Two-part block', draft: '1°', res: 'Standard or Fine', notes: 'Add 4 air valves near the rim' },
		{ part: 'Engineering part with holes', mould: 'Two-part block', draft: '0°', res: 'Fine', notes: 'Keep draft at 0 for round holes' },
		{ part: 'Relief or coaster', mould: 'One-part open pour', draft: '1°', res: 'Standard', notes: 'No keys needed' },
		{ part: 'Large simple shape', mould: 'Two-part conformal', draft: '1–2°', res: 'Draft or Standard', notes: 'Saves filament' }
	];

	let activeId = $state('how');

	$effect(() => {
		const els = toc.map((t) => document.getElementById(t.id)).filter(Boolean);
		const obs = new IntersectionObserver(
			(entries) => {
				for (const e of entries) if (e.isIntersecting) activeId = e.target.id;
			},
			{ rootMargin: '-88px 0px -70% 0px', threshold: 0 }
		);
		els.forEach((el) => obs.observe(el));
		return () => obs.disconnect();
	});
</script>

<svelte:head>
	<title>Mould Design Generator — User Guide · Mould Generator</title>
	<meta
		name="description"
		content="How to turn a 3D model into a print-ready mould with the Mould Generator: parting lines, cavity fit, draft, sprue, venting, registration keys and resolution — powered by Navi3D." />
</svelte:head>

<div class="docs container">
	<!-- ============ LEFT NAV ============ -->
	<aside class="side">
		<div class="side-inner">
			<p class="side-label">Mould Generator</p>
			<a class="side-link active" href="/docs">User Guide</a>

			<p class="side-label">In this guide</p>
			{#each chapters as c}
				<a class="side-link" href="#{c.id}">{c.label}</a>
			{/each}

			<p class="side-label">More</p>
			<a class="side-link" href="/mould">Open the generator ↗</a>
			<a class="side-link" href="/contact">Contact</a>
			<a class="side-link" href="/">Back to site</a>
		</div>
	</aside>

	<!-- ============ CONTENT ============ -->
	<article class="body">
		<p class="eyebrow" style="--tint: var(--violet-t); --tint-ink: var(--violet)">Documentation</p>
		<h1>Mould Design Generator — <span class="mark">User Guide</span></h1>
		<p class="lead">
			The Mould Generator turns a 3D model into a print-ready mould. Upload your part, choose a few
			options, and download the mould halves as STL files — ready to print on your FDM or resin
			printer and cast in resin, silicone or plaster. Everything runs in your browser, so there's
			nothing to install. Powered by <b>Navi3D</b>.
		</p>

		<!-- HOW IT WORKS -->
		<section id="how">
			<h2>How it works</h2>
			<p>
				You upload a model. The generator measures it precisely, builds a cavity in the exact shape
				of your part, adds the pour hole, air vents and alignment keys, and returns the finished
				mould as STL files inside a ZIP. The whole process takes about 10 to 60 seconds.
			</p>

			<div class="fig">
				<div class="steps">
					{#each ['Upload', 'Analyse', 'Build', 'Mesh', 'Export'] as s, i}
						<div class="step">
							<span class="step-n" style="--c: {quickStart[i].c}">0{i + 1}</span>
							<span class="step-t">{s}</span>
							<span class="step-d">
								{['STL · STEP · 3MF', 'voxel grid + SDF', 'cavity · sprue · keys', 'watertight STL', 'ZIP download'][i]}
							</span>
						</div>
						{#if i < 4}<span class="step-arrow">→</span>{/if}
					{/each}
				</div>
				<p class="fig-cap">Everything runs in your browser — nothing to install.</p>
			</div>

			<p>
				You don't need any CAD software, and you don't need to repair your file first. The generator
				is built to handle real-world models, including 3D scans and sculpted meshes.
			</p>
		</section>

		<!-- ANATOMY -->
		<section id="anatomy">
			<h2>What a mould is made of</h2>
			<p>Every two-part mould has the same parts. Knowing their names makes the options easy to understand.</p>

			<div class="fig">
				<svg viewBox="0 0 520 300" class="dia" role="img" aria-label="Anatomy of a two-part mould">
					<text x="260" y="24" text-anchor="middle" class="dia-title">Anatomy of a two-part mould</text>
					<!-- halves -->
					<rect x="170" y="70" width="180" height="70" rx="8" fill="#eef0f6" stroke="#14161f" stroke-width="1.5" />
					<rect x="170" y="150" width="180" height="70" rx="8" fill="#eef0f6" stroke="#14161f" stroke-width="1.5" />
					<text x="182" y="88" class="dia-sm">HALF A · TOP</text>
					<text x="182" y="214" class="dia-sm">HALF B · BOTTOM</text>
					<!-- cavity -->
					<path d="M230 118 Q260 92 290 118 Q260 100 230 118 Z" fill="#fff" stroke="#14161f" stroke-width="1.2" />
					<path d="M230 172 Q260 198 290 172 Q260 190 230 172 Z" fill="#fff" stroke="#14161f" stroke-width="1.2" />
					<!-- sprue -->
					<rect x="255" y="40" width="10" height="30" fill="#14161f" />
					<!-- parting line -->
					<line x1="150" y1="145" x2="370" y2="145" stroke="#6c5ce7" stroke-width="1.6" stroke-dasharray="5 5" />
					<!-- keys -->
					<circle cx="205" cy="145" r="5" fill="#3b82f6" />
					<circle cx="315" cy="145" r="5" fill="#3b82f6" />
					<!-- air valves -->
					<rect x="196" y="150" width="4" height="34" fill="#ff7a66" />
					<rect x="320" y="150" width="4" height="34" fill="#ff7a66" />
					<!-- labels -->
					<g class="dia-lab">
						<text x="262" y="38" text-anchor="middle">Sprue (pour hole)</text>
						<line x1="150" y1="118" x2="120" y2="118" stroke="#c7cbd6" /><text x="116" y="115" text-anchor="end">Parting line</text>
						<line x1="370" y1="118" x2="400" y2="118" stroke="#c7cbd6" /><text x="404" y="115">Cavity</text>
						<line x1="370" y1="185" x2="400" y2="185" stroke="#c7cbd6" /><text x="404" y="188">Wall</text>
						<line x1="150" y1="172" x2="120" y2="172" stroke="#c7cbd6" /><text x="116" y="175" text-anchor="end">Registration keys</text>
						<line x1="322" y1="196" x2="322" y2="230" stroke="#c7cbd6" /><text x="322" y="246" text-anchor="middle">Air valves</text>
					</g>
				</svg>
			</div>

			<ul class="list">
				<li><b>Cavity</b> — the hollow in the exact shape of your part, where the casting material sits.</li>
				<li><b>Sprue</b> — the pour hole you pour resin or plaster into.</li>
				<li><b>Parting line</b> — the flat plane where the two halves meet and separate.</li>
				<li><b>Registration keys</b> — small bumps on one half that fit sockets in the other, so the halves line up perfectly every time.</li>
				<li><b>Air valves</b> — thin vertical channels that let trapped air escape while you pour.</li>
				<li><b>Wall</b> — the solid mould material around the cavity.</li>
			</ul>
		</section>

		<!-- QUICK START -->
		<section id="quickstart">
			<h2>Step-by-step quick start</h2>
			<div class="fig">
				<p class="fig-title">Quick start in 6 steps</p>
				<ol class="qs">
					{#each quickStart as q, i}
						<li>
							<span class="qs-n" style="--c: {q.c}">{i + 1}</span>
							<div><b>{q.t}</b><span>{q.d}</span></div>
						</li>
					{/each}
				</ol>
			</div>
			<p>Follow the six cards in the generator from top to bottom. The sections below explain each choice in plain language.</p>
		</section>

		<!-- 1 UPLOAD -->
		<section id="upload">
			<h2>1. Upload your model</h2>
			<p>Drop an STL, STEP or 3MF file onto the upload area, or click to browse. Files up to 200 MB are accepted.</p>
			<ul class="list">
				<li>The free plan handles models up to 1.5 million triangles.</li>
				<li>Premium handles models up to 4 million triangles.</li>
				<li>If your file is larger, the tool tells you — simplify it in your slicer, or upgrade to Premium.</li>
			</ul>
		</section>

		<!-- 2 SETUP -->
		<section id="setup">
			<h2>2. Mould setup</h2>
			<p>This is where you choose the overall shape of the mould.</p>

			<h3>Mould type</h3>
			<div class="fig two">
				<div class="mini">
					<svg viewBox="0 0 200 130" class="dia"><rect x="55" y="30" width="90" height="40" rx="6" fill="#eef0f6" stroke="#14161f" stroke-width="1.4" /><rect x="55" y="76" width="90" height="40" rx="6" fill="#eef0f6" stroke="#14161f" stroke-width="1.4" /><path d="M80 68 Q100 48 120 68" fill="none" stroke="#14161f" stroke-width="1.2" /><path d="M80 78 Q100 98 120 78" fill="none" stroke="#14161f" stroke-width="1.2" /><line x1="45" y1="73" x2="155" y2="73" stroke="#6c5ce7" stroke-width="1.4" stroke-dasharray="4 4" /><circle cx="70" cy="73" r="3.5" fill="#3b82f6" /><circle cx="130" cy="73" r="3.5" fill="#3b82f6" /></svg>
					<p class="mini-t">Two-part mould</p>
					<p class="mini-d">Two halves clamp together. Best for murtis, figures, 360° shapes.</p>
				</div>
				<div class="mini">
					<svg viewBox="0 0 200 130" class="dia"><rect x="55" y="45" width="90" height="55" rx="6" fill="#eef0f6" stroke="#14161f" stroke-width="1.4" /><path d="M80 100 Q100 60 120 100" fill="none" stroke="#14161f" stroke-width="1.2" /><path d="M100 40 v-14 M94 32 l6 -8 6 8" fill="none" stroke="#17b8a6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
					<p class="mini-t">One-part (open pour)</p>
					<p class="mini-d">Pour straight in from the top. Best for reliefs, coasters, flat-backed items.</p>
				</div>
			</div>

			<h3>Mould style</h3>
			<ul class="list">
				<li><b>Block</b> — a solid rectangular mould. Strong and easy to clamp. Recommended for most parts.</li>
				<li><b>Conformal shell</b> — follows the shape of your part, using less material and printing faster. Good for large simple shapes.</li>
			</ul>

			<h3>Pull direction & parting plane</h3>
			<p>
				The pull direction is the axis along which the two halves separate. Pick the axis where your
				part has the fewest overhangs — for most upright parts that's <b>Z</b>. If in doubt, leave it
				on Z and check the report after generating.
			</p>
			<ul class="list">
				<li><b>Auto</b> — the tool finds the widest cross-section and splits there. Recommended.</li>
				<li><b>Center</b> — splits through the middle.</li>
				<li><b>Offset</b> — you set the exact split height yourself.</li>
			</ul>
		</section>

		<!-- 3 CAVITY -->
		<section id="cavity">
			<h2>3. Cavity and fit</h2>
			<p>These settings control how the casting fits and releases.</p>
			<ul class="list">
				<li><b>Wall thickness</b> — how much mould material surrounds the cavity. 6 to 10 mm is typical. Thicker is stronger but uses more filament.</li>
				<li><b>Cavity clearance</b> — a small uniform gap around the part for a clean fit and easy release. 0.10 to 0.15 mm works well.</li>
				<li><b>Shrinkage compensation</b> — grows the cavity slightly to allow for casting material that shrinks. Use 0% for plaster, around 1% for resin.</li>
			</ul>

			<h3>Draft angle</h3>
			<div class="fig two">
				<div class="mini">
					<svg viewBox="0 0 180 130" class="dia"><rect x="60" y="30" width="26" height="60" fill="#eef0f6" stroke="#14161f" stroke-width="1.4" /><rect x="94" y="30" width="26" height="60" fill="#eef0f6" stroke="#14161f" stroke-width="1.4" /><path d="M90 96 v14 M84 104 l6 8 6 -8" fill="none" stroke="#ff7a66" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
					<p class="mini-t">0° draft (straight)</p>
					<p class="mini-d">Perfectly cylindrical. Great for holes & rigid casts.</p>
				</div>
				<div class="mini">
					<svg viewBox="0 0 180 130" class="dia"><path d="M60 30 h26 l-5 60 h-16 Z" fill="#eef0f6" stroke="#14161f" stroke-width="1.4" /><path d="M120 30 h-26 l5 60 h16 Z" fill="#eef0f6" stroke="#14161f" stroke-width="1.4" /><path d="M90 96 v14 M84 104 l6 8 6 -8" fill="none" stroke="#17b8a6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
					<p class="mini-t">1–2° draft (tapered)</p>
					<p class="mini-d">Slightly wider at the opening. Releases easier from the mould.</p>
				</div>
			</div>
			<p>Draft is a slight taper on the walls so the casting slides out easily.</p>
			<ul class="list">
				<li>Use <b>0°</b> when your part has holes that must stay perfectly round, or when casting flexible material like silicone.</li>
				<li>Use <b>1° to 2°</b> for rigid casts in rigid moulds, so they release cleanly.</li>
				<li><b>Important:</b> draft also tapers the pins that form holes in your part. If your part has holes that must stay cylindrical, keep draft at 0°.</li>
			</ul>

			<h3>Undercut relief</h3>
			<p>
				Leave this on. It sweeps each half so the mould always separates cleanly, even if your part
				has overhangs. The report tells you how much extra material this added, if any.
			</p>
		</section>

		<!-- 4 FEED -->
		<section id="feed">
			<h2>4. Feed system (the pour hole)</h2>
			<p>The sprue is where you pour the casting material in.</p>
			<ul class="list">
				<li><b>Gate type</b> — Top pours straight down into the cavity. Side places the pour hole beside the part with a channel feeding in along the parting line. Top is simplest.</li>
				<li><b>Sprue profile</b> — Straight, Tapered (wider at the top for easier pouring) or Funnel (a wide mouth). Tapered or funnel help with thick materials like plaster.</li>
				<li><b>Sprue diameter</b> — 6 to 8 mm for most parts. Use the larger end for viscous plaster.</li>
			</ul>

			<h3>Placing the pour hole</h3>
			<div class="fig two">
				<div class="mini">
					<svg viewBox="0 0 170 150" class="dia"><circle cx="85" cy="70" r="46" fill="#eef0f6" stroke="#14161f" stroke-width="1.4" /><path d="M85 44 l7 20 21 0 -17 13 7 21 -18 -13 -18 13 7 -21 -17 -13 21 0 Z" fill="#14161f" /><circle cx="85" cy="70" r="14" fill="none" stroke="#ff5a4d" stroke-width="2.5" /><line x1="75" y1="60" x2="95" y2="80" stroke="#ff5a4d" stroke-width="2.5" /></svg>
					<p class="mini-t" style="color: #ff5a4d">✗ On a feature</p>
					<p class="mini-d">Lands on the star core — the hole would be blind.</p>
				</div>
				<div class="mini">
					<svg viewBox="0 0 170 150" class="dia"><circle cx="85" cy="70" r="46" fill="#eef0f6" stroke="#14161f" stroke-width="1.4" /><path d="M85 48 l5 15 16 0 -13 10 5 16 -13 -10 -13 10 5 -16 -13 -10 16 0 Z" fill="#14161f" /><g fill="#9aa0ae"><circle cx="85" cy="34" r="2.4" /><circle cx="112" cy="52" r="2.4" /><circle cx="112" cy="88" r="2.4" /><circle cx="58" cy="52" r="2.4" /><circle cx="58" cy="88" r="2.4" /></g><circle cx="112" cy="70" r="5" fill="#17b8a6" /></svg>
					<p class="mini-t" style="color: #17b8a6">✓ On the flat ring</p>
					<p class="mini-d">Flat area between the star and the holes — a clean channel.</p>
				</div>
			</div>
			<p>
				By default the pour hole sits at the center of your part. If the center is a raised feature or
				a hole, move the sprue onto a nearby flat area using the <b>Sprue offset X and Y</b> fields
				(in millimetres). After generating, check the report: if it warns the pour hole may be blind,
				adjust the offsets and generate again.
			</p>
		</section>

		<!-- 5 VENTING -->
		<section id="venting">
			<h2>5. Venting and air valves</h2>
			<p>Air valves are thin channels that let trapped air escape as you pour, so the casting fills completely.</p>
			<ul class="list">
				<li><b>Air valves</b> — None, Straight or Tapered. Straight is fine for most work.</li>
				<li><b>Count</b> — 4 gives good coverage on round parts.</li>
				<li><b>Diameter</b> — 4 mm is a good default.</li>
				<li><b>Ring position</b> — how far from the center the valves sit. 0.1 is near the center, 0.9 is near the edge. Use 0.8 for parts where air collects near the rim.</li>
				<li><b>Parting-line vents</b> — shallow channels along the parting line for closed pours. Keep the vent width at least twice your voxel size.</li>
			</ul>
		</section>

		<!-- 6 KEYS -->
		<section id="keys">
			<h2>6. Registration keys</h2>
			<p>Keys keep the two halves aligned. One half gets small bumps, the other gets matching sockets.</p>
			<ul class="list">
				<li><b>Key shape</b> — Dome (rounded, easy to align) or Cone (self-centering).</li>
				<li><b>Count</b> — 4 is standard.</li>
				<li><b>Diameter</b> — 8 mm works for most moulds.</li>
				<li><b>Socket clearance</b> — the gap so the halves fit without forcing. Use 0.15 mm for FDM prints, 0.10 mm for resin prints.</li>
			</ul>
		</section>

		<!-- 7 RESOLUTION -->
		<section id="resolution">
			<h2>7. Resolution</h2>
			<div class="fig three">
				{#each [{ n: 'Draft · 0.8 mm', d: 'Fastest · coarse edges', c: '#3b82f6', step: 20 }, { n: 'Standard · 0.5 mm', d: 'Balanced · the default', c: '#6c5ce7', step: 12 }, { n: 'Fine · 0.3 mm ★', d: 'Sharpest · Premium', c: '#f6b93b', step: 7 }] as r}
					<div class="mini">
						<svg viewBox="0 0 120 90" class="dia">
							<g stroke="#e7e9f0" stroke-width="1">
								{#each Array(Math.floor(90 / r.step)) as _, gi}<line x1="15" y1={12 + gi * r.step} x2="105" y2={12 + gi * r.step} />{/each}
								{#each Array(Math.floor(90 / r.step)) as _, gi}<line x1={15 + gi * r.step} y1="12" x2={15 + gi * r.step} y2="78" />{/each}
							</g>
							<polyline points="18,64 40,62 62,40 84,30 102,24" fill="none" stroke={r.c} stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
						<p class="mini-t">{r.n}</p>
						<p class="mini-d">{r.d}</p>
					</div>
				{/each}
			</div>
			<p>Resolution controls how much fine detail the mould captures.</p>
			<ul class="list">
				<li><b>Draft (0.8 mm)</b> — fastest, for large simple shapes.</li>
				<li><b>Standard (0.5 mm)</b> — balanced, the default for most parts.</li>
				<li><b>Fine (0.3 mm)</b> — sharpest detail, for small holes and sharp edges. Available on Premium.</li>
			</ul>
			<p class="callout">
				As a rule, a feature needs to be about five times the voxel size to come out accurately. A
				3 mm hole needs Fine (0.3 mm) resolution to stay round.
			</p>
		</section>

		<!-- REPORT -->
		<section id="report">
			<h2>Reading the report</h2>
			<p>
				After generating, the summary panel shows the part size, mould size, casting volume and other
				numbers. Always read the <b>Warnings</b> section — it flags things like undercuts, a pour hole
				that may be blind, or features too small for the chosen resolution. Warnings don't stop you
				downloading; they tell you what to check before printing.
			</p>
		</section>

		<!-- PRINTING -->
		<section id="printing">
			<h2>Downloading and printing</h2>
			<p>Your download is a ZIP file containing:</p>
			<ul class="list">
				<li>The mould halves as STL files (two files for a two-part mould, one for an open-pour mould).</li>
				<li>A report file with all the measurements.</li>
			</ul>
			<p>
				Import the STL files into your slicer as usual. Print the halves, clamp them together with the
				registration keys aligned, and pour your casting material slowly. Tap or vibrate the mould
				gently so material flows around fine features without trapping air.
			</p>
		</section>

		<!-- SETTINGS TABLE -->
		<section id="settings">
			<h2>Recommended settings by part type</h2>
			<div class="table-wrap">
				<table>
					<thead>
						<tr><th>Part type</th><th>Mould type</th><th>Draft</th><th>Resolution</th><th>Notes</th></tr>
					</thead>
					<tbody>
						{#each settings as s}
							<tr><td>{s.part}</td><td>{s.mould}</td><td>{s.draft}</td><td>{s.res}</td><td>{s.notes}</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<!-- PLANS -->
		<section id="plans">
			<h2>Free plan and Premium</h2>
			<ul class="list">
				<li><b>Free</b> — two moulds per day, standard 0.5 mm resolution, models up to 1.5 million triangles. No login needed.</li>
				<li><b>Premium</b> — unlimited moulds, fine 0.3 mm resolution, custom voxel size down to 0.15 mm, and models up to 4 million triangles. Linked to your account, so it works on all your devices.</li>
			</ul>
		</section>

		<!-- FAQ -->
		<section id="faq">
			<h2>Common questions</h2>
			<div class="qa">
				<h3>The pour hole does not reach my part</h3>
				<p>The sprue is landing on a raised feature. Move it onto a nearby flat area with the Sprue offset X and Y fields, then generate again and check the report.</p>
				<h3>My holes came out as cones</h3>
				<p>Draft angle tapers the pins that form holes. Set draft to 0° if your holes must stay cylindrical.</p>
				<h3>Sharp edges look rounded</h3>
				<p>Increase the resolution. Fine (0.3 mm) captures small holes and sharp edges; a feature needs to be about five times the voxel size to reproduce accurately.</p>
				<h3>My file was rejected as too large</h3>
				<p>Free handles up to 1.5 million triangles. Simplify the mesh in your slicer, or upgrade to Premium for up to 4 million.</p>
				<h3>Can I edit the mould in CAD afterwards?</h3>
				<p>Yes. The exported STLs are standard watertight meshes you can open and modify in any mesh or CAD tool.</p>
			</div>
		</section>

		<div class="foot-cta">
			<div>
				<h3>Ready to make one?</h3>
				<p>Upload a model and export a mould in under a minute — free, no login.</p>
			</div>
			<a class="btn btn-accent" href="/mould" style="--btn: var(--coral)">Open the generator →</a>
		</div>
	</article>

	<!-- ============ RIGHT TOC ============ -->
	<aside class="toc">
		<div class="toc-inner">
			<p class="toc-label">On this page</p>
			<nav>
				{#each toc as t}
					<a class="toc-link {activeId === t.id ? 'active' : ''}" href="#{t.id}">{t.label}</a>
				{/each}
			</nav>
		</div>
	</aside>
</div>

<style>
	.docs {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr) 220px;
		gap: 40px;
		padding-block: 48px 96px;
		align-items: start;
	}

	/* ---- side rails ---- */
	.side-inner,
	.toc-inner {
		position: sticky;
		top: 92px;
		max-height: calc(100dvh - 110px);
		overflow-y: auto;
	}
	.side-label,
	.toc-label {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--slate-2);
		margin: 22px 0 10px;
	}
	.side-label:first-child {
		margin-top: 0;
	}
	.side-link {
		display: block;
		font-size: 0.92rem;
		color: var(--slate);
		padding: 6px 0;
		border-left: 2px solid transparent;
		padding-left: 12px;
		margin-left: -14px;
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.side-link:hover {
		color: var(--ink);
	}
	.side-link.active {
		color: var(--violet);
		font-weight: 600;
		border-color: var(--violet);
	}

	.toc nav {
		display: flex;
		flex-direction: column;
	}
	.toc-link {
		font-size: 0.85rem;
		color: var(--slate-2);
		padding: 5px 0 5px 12px;
		border-left: 2px solid var(--line);
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.toc-link:hover {
		color: var(--ink);
	}
	.toc-link.active {
		color: var(--ink);
		font-weight: 600;
		border-color: var(--violet);
	}

	/* ---- content ---- */
	.body {
		min-width: 0;
		max-width: 760px;
	}
	.body h1 {
		font-size: clamp(2rem, 4vw, 2.9rem);
		margin-bottom: 18px;
	}
	.lead {
		font-size: 1.14rem;
		color: var(--slate);
		margin-bottom: 8px;
	}
	.lead b {
		color: var(--ink);
	}
	.body section {
		scroll-margin-top: 92px;
		padding-top: 34px;
	}
	.body h2 {
		font-size: 1.7rem;
		margin-bottom: 14px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--line);
	}
	.body h3 {
		font-size: 1.18rem;
		margin: 28px 0 12px;
	}
	.body p {
		color: var(--slate);
		margin-bottom: 16px;
		line-height: 1.7;
	}
	.body p b,
	.list b {
		color: var(--ink);
	}
	.list {
		list-style: none;
		margin: 0 0 18px;
		padding: 0;
		display: grid;
		gap: 10px;
	}
	.list li {
		position: relative;
		padding-left: 20px;
		color: var(--slate);
		line-height: 1.65;
	}
	.list li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 9px;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--violet);
	}
	.callout {
		background: var(--amber-t);
		border-left: 3px solid var(--amber);
		border-radius: 0 10px 10px 0;
		padding: 14px 16px;
		color: #6b5410;
	}

	/* ---- figures ---- */
	.fig {
		background: var(--cloud);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 22px;
		margin: 20px 0 22px;
	}
	.fig.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.fig.three {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
	.fig-title,
	.dia-title {
		font-family: var(--font-display);
		font-weight: 600;
		text-align: center;
	}
	.fig-title {
		color: var(--ink);
		margin-bottom: 16px;
	}
	.fig-cap {
		text-align: center;
		font-size: 0.82rem;
		color: var(--slate-2);
		margin: 12px 0 0;
	}
	.dia {
		width: 100%;
		height: auto;
	}
	.dia-title {
		font-size: 13px;
		fill: var(--ink);
	}
	.dia-sm {
		font-size: 8px;
		font-family: var(--font-mono);
		fill: var(--slate-2);
	}
	.dia-lab text {
		font-size: 9px;
		fill: var(--slate);
	}
	.mini {
		text-align: center;
		padding: 8px;
	}
	.mini-t {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.92rem;
		color: var(--ink);
		margin: 6px 0 4px;
	}
	.mini-d {
		font-size: 0.8rem;
		color: var(--slate-2);
		margin: 0;
		line-height: 1.5;
	}

	/* process steps */
	.steps {
		display: flex;
		align-items: stretch;
		gap: 6px;
	}
	.step {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		background: #fff;
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 14px 8px;
		gap: 4px;
	}
	.step-n {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 0.82rem;
		color: #fff;
		background: var(--c);
		border-radius: 6px;
		padding: 2px 7px;
	}
	.step-t {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--ink);
	}
	.step-d {
		font-size: 0.7rem;
		color: var(--slate-2);
		line-height: 1.4;
	}
	.step-arrow {
		align-self: center;
		color: var(--slate-2);
	}

	/* quick start ordered */
	.qs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 12px;
	}
	.qs li {
		display: flex;
		gap: 14px;
		align-items: flex-start;
	}
	.qs-n {
		flex: none;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--c);
		color: #fff;
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 0.82rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.qs li div {
		display: flex;
		flex-direction: column;
	}
	.qs li b {
		color: var(--ink);
		font-size: 0.96rem;
	}
	.qs li span {
		color: var(--slate-2);
		font-size: 0.86rem;
	}

	/* table */
	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--line);
		border-radius: 14px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.92rem;
	}
	th {
		text-align: left;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--slate);
		background: var(--cloud);
		padding: 12px 14px;
		border-bottom: 1px solid var(--line);
	}
	td {
		padding: 12px 14px;
		color: var(--slate);
		border-bottom: 1px solid var(--line);
	}
	tbody tr:last-child td {
		border-bottom: none;
	}
	td:first-child {
		color: var(--ink);
		font-weight: 500;
	}

	/* qa */
	.qa h3 {
		font-size: 1.05rem;
		margin: 22px 0 6px;
	}
	.qa h3:first-child {
		margin-top: 0;
	}

	/* foot cta */
	.foot-cta {
		margin-top: 48px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		flex-wrap: wrap;
		background: var(--ink);
		border-radius: 20px;
		padding: 28px 32px;
	}
	.foot-cta h3 {
		color: #fff;
		font-size: 1.3rem;
		margin: 0 0 4px;
	}
	.foot-cta p {
		color: #b7bccb;
		margin: 0;
	}

	@media (max-width: 1080px) {
		.docs {
			grid-template-columns: 200px minmax(0, 1fr);
		}
		.toc {
			display: none;
		}
	}
	@media (max-width: 820px) {
		.docs {
			grid-template-columns: 1fr;
			padding-top: 32px;
		}
		.side {
			display: none;
		}
		.fig.two,
		.fig.three {
			grid-template-columns: 1fr;
		}
		.steps {
			flex-wrap: wrap;
		}
		.step {
			flex: 1 1 40%;
		}
		.step-arrow {
			display: none;
		}
	}
</style>