<script>
	// ==========================================================================
	// STL EDITOR — resize, reference planes, extrude boss/base, extrude cut, and
	// embossed/engraved text, driven by the /calc/stl/* backend handler. Each
	// edit reloads the returned STL so operations chain.
	//
	// Runs inside Studio.svelte. The shell owns the shared model:
	//   • sharedFile / sharedBuffer  — the current model (adopted automatically
	//     when it changes and is an .stl).
	//   • onShared(file, buffer)      — report uploads / edited results upward.
	//   • onSwitch('mould' | 'edit')  — flip the studio mode.
	// "Send to Mould generator →" pushes the edited STL to the shell and
	// switches to the mould tool with no re-upload.
	// ==========================================================================
	import { PUBLIC_API_BASE_URL } from '$env/static/public';
	import StlEditorViewport from '$lib/components/StlEditorViewport.svelte';

	// ---- shell wiring -------------------------------------------------------
	// `active` is true only while this tool is the visible mode. The 3D viewport
	// is mounted only when active, so it re-initialises and repaints correctly
	// every time you switch back to the editor tab.
	let { sharedFile = null, sharedBuffer = null, active = true, onShared = () => {}, onSwitch = () => {} } = $props();

	const API = PUBLIC_API_BASE_URL;
	const MAX_MB = 200;

	// ---- working document ---------------------------------------------------
	let file = $state(null);
	let workName = $state('model.stl');
	let workBuffer = $state(null); // current STL bytes (ArrayBuffer)
	let originalBuffer = $state(null);
	let undoStack = $state([]); // ArrayBuffer[]
	let fileError = $state('');
	let dragOver = $state(false);
	let fileInputEl, fontInputEl, vp;

	// bridge bookkeeping: distinguish shared buffers we ADOPTED (external) from
	// ones we PUSHED out, so we never clobber our own edits or loop.
	let adopted = null;
	let pushed = null;

	// A shared model handed to us (uploaded in the mould tool, or on first
	// load) is adopted as the working model — but only if it is an STL and not
	// one we produced ourselves.
	$effect(() => {
		const b = sharedBuffer;
		const f = sharedFile;
		if (!b || b === adopted || b === pushed) return;
		if (!f || !f.name.toLowerCase().endsWith('.stl')) return;
		adopted = b;
		file = f;
		workName = f.name;
		originalBuffer = b.slice(0);
		workBuffer = b;
		undoStack = [];
		resetSession();
	});

	let sharedNonStl = $derived(!!sharedFile && !sharedFile.name.toLowerCase().endsWith('.stl'));

	// ---- geometry facts (from viewport bbox + optional /analyze) ------------
	let bboxMin = $state(null),
		bboxMax = $state(null);
	let center = $derived(bboxMin && bboxMax ? [(bboxMin[0] + bboxMax[0]) / 2, (bboxMin[1] + bboxMax[1]) / 2, (bboxMin[2] + bboxMax[2]) / 2] : [0, 0, 0]);
	let dims = $derived(bboxMin && bboxMax ? [bboxMax[0] - bboxMin[0], bboxMax[1] - bboxMin[1], bboxMax[2] - bboxMin[2]] : [0, 0, 0]);
	let principalPlanes = $state(null);

	// ---- plane / sketch state ----------------------------------------------
	let activePlane = $state(null); // { origin,u,v,n,name }
	let planeOffset = $state(0);
	let sketch = $state([]); // committed contours
	let currentContour = $state([]);
	let sketchMode = $state(false);
	let fillRule = $state('even_odd');

	// primitive helpers
	let rectW = $state(20),
		rectH = $state(10),
		rectU = $state(0),
		rectV = $state(0);
	let circR = $state(8),
		circU = $state(0),
		circV = $state(0);
	let polyN = $state(6),
		polyR = $state(10),
		polyU = $state(0),
		polyV = $state(0);

	// ---- extrude params -----------------------------------------------------
	let extrudeOp = $state('extrude_boss');
	let depth = $state(5);
	let endCondition = $state('blind');
	let reverse = $state(false);
	let draft = $state(0);

	// ---- text params --------------------------------------------------------
	let textStr = $state('TEXT');
	let textOp = $state('text_emboss');
	let fontSize = $state(10);
	let letterSpacing = $state(0);
	let lineFactor = $state(1.25);
	let textAlign = $state('left');
	let textPosU = $state(0),
		textPosV = $state(0);
	let textDepth = $state(1.5);
	let fontFile = $state(null);
	let fontName = $state('');

	// ---- quality ------------------------------------------------------------
	let resolution = $state('standard');
	let voxel = $state(0.5);
	let cadRestore = $state(true);

	// ---- request state ------------------------------------------------------
	let phase = $state('idle'); // idle | busy | error
	let busyMsg = $state('');
	let errorMsg = $state('');
	let warnings = $state([]);
	let elapsed = $state(0),
		timer = null;

	// ---- tabs ---------------------------------------------------------------
	const TABS = [
		{ id: 'model', l: 'Model' },
		{ id: 'resize', l: 'Resize' },
		{ id: 'planes', l: 'Planes' },
		{ id: 'sketch', l: 'Sketch' },
		{ id: 'extrude', l: 'Extrude' },
		{ id: 'text', l: 'Text' },
		{ id: 'quality', l: 'Quality' }
	];
	let tab = $state('model');

	// ---- resize params ------------------------------------------------------
	let rzMode = $state('uniform');
	let rzScale = $state(1);
	let rzX = $state(1),
		rzY = $state(1),
		rzZ = $state(1);
	let rzTX = $state(0),
		rzTY = $state(0),
		rzTZ = $state(0);
	let rzKeep = $state(true);
	let rzFrom = $state('mm'),
		rzTo = $state('mm');
	let rzRecenter = $state('none');

	// ---- vector math (mirrors backend build_frame) --------------------------
	const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
	const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
	const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
	const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
	const len = (a) => Math.hypot(a[0], a[1], a[2]);
	const norm = (a) => {
		const l = len(a);
		return l > 1e-9 ? mul(a, 1 / l) : [0, 0, 1];
	};
	function frame(origin, uIn, nIn, name) {
		const n = norm(nIn);
		let u = sub(uIn, mul(n, dot(uIn, n)));
		if (len(u) < 1e-9) {
			const seed = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
			u = sub(seed, mul(n, dot(seed, n)));
		}
		u = norm(u);
		const v = norm(cross(n, u));
		return { origin, u, v, n, name };
	}

	// ---- standard + principal planes ----------------------------------------
	function setStandard(kind) {
		const base = { front: [[1, 0, 0], [0, 0, 1]], top: [[1, 0, 0], [0, 1, 0]], right: [[0, 1, 0], [1, 0, 0]] }[kind];
		const n = norm(base[1]);
		const origin = add(center, mul(n, +planeOffset || 0));
		activePlane = frame(origin, base[0], n, `${kind[0].toUpperCase()}${kind.slice(1)}${planeOffset ? ` +${planeOffset}` : ''}`);
	}
	function setPrincipal(key) {
		if (!principalPlanes) return;
		const p = principalPlanes[key];
		const n = norm(p.normal);
		const origin = add([p.origin[0], p.origin[1], p.origin[2]], mul(n, +planeOffset || 0));
		activePlane = frame(origin, p.u_dir, n, key);
	}

	// ---- sketch actions -----------------------------------------------------
	function onSketchPoint(uv) {
		currentContour = [...currentContour, uv];
	}
	function closeContour() {
		if (currentContour.length >= 3) sketch = [...sketch, currentContour];
		currentContour = [];
	}
	function undoPoint() {
		currentContour = currentContour.slice(0, -1);
	}
	function clearSketch() {
		sketch = [];
		currentContour = [];
	}
	function delContour(i) {
		sketch = sketch.filter((_, k) => k !== i);
	}
	function addRect() {
		const u0 = +rectU - rectW / 2,
			v0 = +rectV - rectH / 2,
			u1 = +rectU + rectW / 2,
			v1 = +rectV + rectH / 2;
		sketch = [...sketch, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]];
	}
	function addCircle() {
		const seg = 64,
			c = [];
		for (let i = 0; i < seg; i++) {
			const a = (i / seg) * Math.PI * 2;
			c.push([+circU + circR * Math.cos(a), +circV + circR * Math.sin(a)]);
		}
		sketch = [...sketch, c];
	}
	function addPoly() {
		const n = Math.max(3, Math.round(polyN)),
			c = [];
		for (let i = 0; i < n; i++) {
			const a = (i / n) * Math.PI * 2 - Math.PI / 2;
			c.push([+polyU + polyR * Math.cos(a), +polyV + polyR * Math.sin(a)]);
		}
		sketch = [...sketch, c];
	}

	// ---- live preview object for the viewport -------------------------------
	let preview = $derived.by(() => {
		if (!activePlane) return null;
		if (tab === 'extrude' && sketch.length)
			return { kind: 'extrude', operation: extrudeOp, depth: +depth, end_condition: endCondition, reverse, sketch };
		if (tab === 'text' && textStr.trim())
			return { kind: 'text', operation: textOp, text: textStr, size: +fontSize, align: textAlign, pos: [+textPosU, +textPosV], depth: +textDepth, line_spacing_factor: +lineFactor };
		return null;
	});

	// ---- file handling ------------------------------------------------------
	function acceptFile(f) {
		fileError = '';
		if (!f) return;
		if (!f.name.toLowerCase().endsWith('.stl')) {
			fileError = 'The STL Editor accepts .stl files only.';
			return;
		}
		if (f.size > MAX_MB * 1024 * 1024) {
			fileError = `That file is ${(f.size / 1048576).toFixed(1)} MB; the limit is ${MAX_MB} MB.`;
			return;
		}
		file = f;
		workName = f.name;
		f.arrayBuffer().then((b) => {
			originalBuffer = b.slice(0);
			workBuffer = b;
			undoStack = [];
			resetSession();
			pushed = b; // our own upload — don't re-adopt from the shell
			onShared(f, b); // share it so the mould tool has it too
		});
	}
	function resetSession() {
		activePlane = null;
		principalPlanes = null;
		sketch = [];
		currentContour = [];
		sketchMode = false;
		warnings = [];
		errorMsg = '';
		phase = 'idle';
	}
	function onPick(e) {
		if (e.target.files?.length) acceptFile(e.target.files[0]);
		e.target.value = '';
	}
	function onDrop(e) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files?.length) acceptFile(e.dataTransfer.files[0]);
	}
	function onFontPick(e) {
		const f = e.target.files?.[0];
		if (f) {
			fontFile = f;
			fontName = f.name;
		}
		e.target.value = '';
	}
	function onBBox(mn, mx) {
		bboxMin = mn;
		bboxMax = mx;
	}
	function fmt(n, d = 1) {
		return isFinite(n) ? Number(n).toFixed(d) : '—';
	}

	// ---- server calls -------------------------------------------------------
	function currentFile() {
		return new File([workBuffer], workName, { type: 'model/stl' });
	}
	function startBusy(msg) {
		phase = 'busy';
		busyMsg = msg;
		errorMsg = '';
		warnings = [];
		elapsed = 0;
		timer = setInterval(() => (elapsed += 1), 1000);
	}
	function stopBusy() {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	}
	async function applyReturnedStl(res) {
		const ct = res.headers.get('content-type') || '';
		if (!res.ok || ct.includes('application/json') || ct.includes('text/')) {
			let msg = `Request failed (HTTP ${res.status}).`;
			try {
				const j = await res.json();
				msg = j.message || j.error || msg;
			} catch (_) {}
			throw new Error(msg);
		}
		const blob = await res.blob();
		if (!blob || blob.size === 0) throw new Error('The server returned an empty STL.');
		const buf = await blob.arrayBuffer();
		undoStack = [...undoStack, workBuffer];
		workBuffer = buf; // reload → viewport re-parses
		warnings = (res.headers.get('X-Edit-Warnings') || '').split(' | ').filter(Boolean);
	}

	async function computePrincipal() {
		if (!workBuffer) return;
		startBusy('Analyzing mass properties…');
		try {
			const fd = new FormData();
			fd.append('file', currentFile());
			const res = await fetch(`${API}/calc/stl/analyze`, { method: 'POST', body: fd });
			const j = await res.json();
			if (!res.ok || j.status === 'error') throw new Error(j.message || 'Analyze failed.');
			principalPlanes = j.principal_planes?.planes || null;
			if (j.bbox_min && j.bbox_max) onBBox(j.bbox_min, j.bbox_max);
			phase = 'idle';
		} catch (e) {
			errorMsg = e.message;
			phase = 'error';
		} finally {
			stopBusy();
		}
	}

	async function applyResize() {
		if (!workBuffer) return;
		startBusy('Resizing…');
		try {
			const params = {
				mode: rzMode,
				scale: +rzScale,
				scale_x: +rzX,
				scale_y: +rzY,
				scale_z: +rzZ,
				target_x: +rzTX,
				target_y: +rzTY,
				target_z: +rzTZ,
				keep_aspect: rzKeep,
				from_unit: rzFrom,
				to_unit: rzTo,
				recenter: rzRecenter
			};
			const fd = new FormData();
			fd.append('file', currentFile());
			fd.append('params', JSON.stringify(params));
			const res = await fetch(`${API}/calc/stl/resize`, { method: 'POST', body: fd });
			await applyReturnedStl(res);
			principalPlanes = null; // stale after geometry change
			phase = 'idle';
		} catch (e) {
			errorMsg = e.message;
			phase = 'error';
		} finally {
			stopBusy();
		}
	}

	async function applyFeature(kind) {
		if (!workBuffer || !activePlane) {
			errorMsg = 'Pick a reference plane first.';
			phase = 'error';
			return;
		}
		if (kind === 'extrude' && !sketch.length) {
			errorMsg = 'Draw or add at least one closed contour.';
			phase = 'error';
			return;
		}
		if (kind === 'text' && !textStr.trim()) {
			errorMsg = 'Enter some text.';
			phase = 'error';
			return;
		}
		startBusy(kind === 'text' ? 'Generating text…' : 'Extruding…');
		try {
			const plane = { origin: activePlane.origin, u_dir: activePlane.u, normal: activePlane.n };
			const params = {
				plane,
				resolution,
				voxel_size_mm: +voxel,
				cad_restore: cadRestore,
				fill_rule: fillRule
			};
			if (kind === 'extrude') {
				params.operation = extrudeOp;
				params.sketch = sketch;
				params.depth_mm = +depth;
				params.end_condition = endCondition;
				params.reverse = reverse;
				params.draft_deg = +draft;
			} else {
				params.operation = textOp; // text_emboss | text_engrave
				params.text = textStr;
				params.font_size_mm = +fontSize;
				params.letter_spacing_mm = +letterSpacing;
				params.line_spacing_factor = +lineFactor;
				params.text_align = textAlign;
				params.text_pos = [+textPosU, +textPosV];
				params.depth_mm = +textDepth;
				params.end_condition = 'blind';
				params.reverse = textOp === 'text_engrave'; // engrave cuts inward
			}
			const fd = new FormData();
			fd.append('file', currentFile());
			fd.append('params', JSON.stringify(params));
			if (kind === 'text' && fontFile) fd.append('font', fontFile, fontFile.name);

			const res = await fetch(`${API}/calc/stl/feature`, { method: 'POST', body: fd });
			await applyReturnedStl(res);
			principalPlanes = null;
			if (kind === 'extrude') clearSketch(); // consumed
			sketchMode = false;
			phase = 'idle';
		} catch (e) {
			errorMsg = e.message;
			phase = 'error';
		} finally {
			stopBusy();
		}
	}

	// ---- undo / reset / download / bridge -----------------------------------
	function undo() {
		if (!undoStack.length) return;
		workBuffer = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);
		principalPlanes = null;
		warnings = [];
	}
	function resetOriginal() {
		if (!originalBuffer) return;
		workBuffer = originalBuffer.slice(0);
		undoStack = [];
		resetSession();
	}
	function download() {
		if (!workBuffer) return;
		const blob = new Blob([workBuffer], { type: 'model/stl' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const base = workName.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_');
		a.download = `${base}_edited.stl`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 4000);
	}
	// Hand the edited model to the mould generator and switch there — no re-upload.
	function sendToMould() {
		if (!workBuffer) return;
		const base = workName.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') || 'model';
		const name = `${base}_edited.stl`;
		const f = new File([workBuffer], name, { type: 'model/stl' });
		pushed = workBuffer; // don't re-adopt our own push
		onShared(f, workBuffer);
		onSwitch('mould');
	}

	let seg = {
		resolution: [
			{ v: 'draft', l: 'Draft · 0.8' },
			{ v: 'standard', l: 'Standard · 0.5' },
			{ v: 'fine', l: 'Fine · 0.3' },
			{ v: 'custom', l: 'Custom' }
		]
	};
</script>

<svelte:head><title>STL Editor</title><meta name="robots" content="noindex" /></svelte:head>

<div class="studio">
	<header class="bar">
		<a class="brand" href="/"><span>STL<b>Editor</b></span></a>

		<!-- MODE SWITCH: shared with the mould generator -->
		<div class="mode" role="tablist" aria-label="Studio mode">
			<button class="mode-b on" role="tab" aria-current="true">Edit STL</button>
			<button class="mode-b" role="tab" onclick={() => onSwitch('mould')} title="Turn this model into a print-ready mould">Generate Mould</button>
		</div>

		<div class="bar-file">
			{#if file}
				<span class="fchip"><span class="fname">{workName}</span></span>
				<button class="mini" onclick={resetOriginal}>Reset</button>
			{:else}
				<button class="mini solid" onclick={() => fileInputEl.click()}>Upload STL</button>
			{/if}
		</div>
		<a class="bar-link" href="/">← Back</a>
	</header>

	<nav class="tabs">
		{#each TABS as t}
			<button class="tab {tab === t.id ? 'on' : ''}" onclick={() => (tab = t.id)}>{t.l}</button>
		{/each}
	</nav>

	<!-- LEFT: TOOL PANELS -->
	<aside class="props">
		<div class="props-body">
			{#if tab === 'model'}
				<section class="grp">
					<h3>Model</h3>
					{#if !file}
						<div class="drop {dragOver ? 'over' : ''}" role="button" tabindex="0" onclick={() => fileInputEl.click()} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputEl.click()} ondragover={(e) => { e.preventDefault(); dragOver = true; }} ondragleave={() => (dragOver = false)} ondrop={onDrop}>
							<p class="drop-t">Drop STL or click</p>
							<p class="drop-h">.stl · ≤ {MAX_MB} MB</p>
						</div>
						{#if sharedNonStl}
							<p class="hint warn">The current studio model is <strong>{sharedFile.name}</strong> (STEP/3MF). The editor works on <strong>.stl</strong> only — upload an STL here, or switch back to the mould generator.</p>
						{/if}
					{:else}
						<div class="file-row"><span class="fname">{workName}</span><button class="ghost" onclick={() => fileInputEl.click()}>Replace</button></div>
					{/if}
					{#if fileError}<p class="err">{fileError}</p>{/if}
					<p class="hint">Edits chain: each operation returns a new STL that becomes the working model. When you're done, send it straight to the mould generator.</p>
				</section>
			{/if}

			{#if tab === 'resize'}
				<section class="grp">
					<h3>Resize</h3>
					<div class="field">
						<span class="lbl">Mode</span>
						<div class="segs">
							{#each [['uniform', 'Uniform'], ['axes', 'Per-axis'], ['target', 'To size'], ['units', 'Units']] as [v, l]}
								<button class="seg {rzMode === v ? 'on' : ''}" onclick={() => (rzMode = v)}>{l}</button>
							{/each}
						</div>
					</div>
					{#if rzMode === 'uniform'}
						<div class="field"><label class="lbl" for="rzs">Scale factor</label><div class="num"><input id="rzs" type="number" step="0.05" bind:value={rzScale} />×</div></div>
					{:else if rzMode === 'axes'}
						<div class="g3">
							<div class="field"><label class="lbl">X</label><div class="num"><input type="number" step="0.05" bind:value={rzX} /></div></div>
							<div class="field"><label class="lbl">Y</label><div class="num"><input type="number" step="0.05" bind:value={rzY} /></div></div>
							<div class="field"><label class="lbl">Z</label><div class="num"><input type="number" step="0.05" bind:value={rzZ} /></div></div>
						</div>
					{:else if rzMode === 'target'}
						<div class="g3">
							<div class="field"><label class="lbl">X mm</label><div class="num"><input type="number" step="1" bind:value={rzTX} /></div></div>
							<div class="field"><label class="lbl">Y mm</label><div class="num"><input type="number" step="1" bind:value={rzTY} /></div></div>
							<div class="field"><label class="lbl">Z mm</label><div class="num"><input type="number" step="1" bind:value={rzTZ} /></div></div>
						</div>
						<label class="check"><input type="checkbox" bind:checked={rzKeep} /><span>Keep aspect ratio (0 = free axis)</span></label>
					{:else}
						<div class="g2">
							<div class="field"><span class="lbl">From</span><select bind:value={rzFrom}><option>micron</option><option>mm</option><option>cm</option><option>m</option><option>inch</option><option>foot</option></select></div>
							<div class="field"><span class="lbl">To</span><select bind:value={rzTo}><option>micron</option><option>mm</option><option>cm</option><option>m</option><option>inch</option><option>foot</option></select></div>
						</div>
					{/if}
					<div class="field">
						<span class="lbl">Recenter</span>
						<div class="segs">
							{#each [['none', 'None'], ['origin_min', 'Min→origin'], ['origin_center', 'Center→origin']] as [v, l]}
								<button class="seg {rzRecenter === v ? 'on' : ''}" onclick={() => (rzRecenter = v)}>{l}</button>
							{/each}
						</div>
					</div>
					<button class="cta" disabled={!file || phase === 'busy'} onclick={applyResize}>Apply resize</button>
				</section>
			{/if}

			{#if tab === 'planes'}
				<section class="grp">
					<h3>Reference planes</h3>
					<div class="field">
						<span class="lbl">Standard</span>
						<div class="segs">
							<button class="seg" onclick={() => setStandard('front')}>Front</button>
							<button class="seg" onclick={() => setStandard('top')}>Top</button>
							<button class="seg" onclick={() => setStandard('right')}>Right</button>
						</div>
					</div>
					<div class="field"><label class="lbl" for="poff">Plane offset (along normal)</label><div class="num"><input id="poff" type="number" step="1" bind:value={planeOffset} /><span class="u">mm</span></div></div>
					<button class="cta light" disabled={!file || phase === 'busy'} onclick={computePrincipal}>Compute principal-axis planes</button>
					{#if principalPlanes}
						<div class="field" style="margin-top:12px;">
							<span class="lbl">Principal (inertia)</span>
							<div class="segs">
								{#each Object.keys(principalPlanes) as key}
									<button class="seg" onclick={() => setPrincipal(key)}>{key.replace('p_', '')}</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if activePlane}
						<p class="hint">Active: <strong>{activePlane.name}</strong>. <button class="linkbtn" onclick={() => vp?.lookAtPlane()}>Look at plane</button></p>
					{:else}
						<p class="hint">Pick a plane to sketch and extrude on.</p>
					{/if}
				</section>
			{/if}

			{#if tab === 'sketch'}
				<section class="grp">
					<h3>Sketch</h3>
					{#if !activePlane}
						<p class="hint warn">Pick a reference plane in the Planes tab first.</p>
					{:else}
						<label class="check"><input type="checkbox" bind:checked={sketchMode} /><span><strong>Draw mode</strong> — click on the plane to add points</span></label>
						<div class="segs" style="margin-top:10px;">
							<button class="seg" onclick={closeContour} disabled={currentContour.length < 3}>Close contour</button>
							<button class="seg" onclick={undoPoint} disabled={!currentContour.length}>Undo point</button>
							<button class="seg" onclick={clearSketch} disabled={!sketch.length && !currentContour.length}>Clear</button>
						</div>
						<p class="hint">In-progress points: {currentContour.length} · closed contours: {sketch.length}</p>

						<div class="field" style="margin-top:14px;">
							<span class="lbl">Fill rule</span>
							<div class="segs">
								<button class="seg {fillRule === 'even_odd' ? 'on' : ''}" onclick={() => (fillRule = 'even_odd')}>Even-odd</button>
								<button class="seg {fillRule === 'nonzero' ? 'on' : ''}" onclick={() => (fillRule = 'nonzero')}>Non-zero</button>
							</div>
						</div>

						<h3 style="margin-top:18px;">Primitives</h3>
						<div class="g3">
							<div class="field"><label class="lbl">Rect W</label><div class="num"><input type="number" bind:value={rectW} /></div></div>
							<div class="field"><label class="lbl">H</label><div class="num"><input type="number" bind:value={rectH} /></div></div>
							<div class="field"><label class="lbl">u,v</label><div class="num"><input type="number" bind:value={rectU} /></div></div>
						</div>
						<button class="seg" onclick={addRect}>Add rectangle</button>
						<div class="g3" style="margin-top:12px;">
							<div class="field"><label class="lbl">Circle Ø/2</label><div class="num"><input type="number" bind:value={circR} /></div></div>
							<div class="field"><label class="lbl">u</label><div class="num"><input type="number" bind:value={circU} /></div></div>
							<div class="field"><label class="lbl">v</label><div class="num"><input type="number" bind:value={circV} /></div></div>
						</div>
						<button class="seg" onclick={addCircle}>Add circle</button>
						<div class="g3" style="margin-top:12px;">
							<div class="field"><label class="lbl">Poly n</label><div class="num"><input type="number" bind:value={polyN} /></div></div>
							<div class="field"><label class="lbl">r</label><div class="num"><input type="number" bind:value={polyR} /></div></div>
							<div class="field"><label class="lbl">u</label><div class="num"><input type="number" bind:value={polyU} /></div></div>
						</div>
						<button class="seg" onclick={addPoly}>Add polygon</button>

						{#if sketch.length}
							<div class="clist">
								{#each sketch as c, i}
									<div class="crow"><span>Contour {i + 1} · {c.length} pts</span><button class="ghost" onclick={() => delContour(i)}>✕</button></div>
								{/each}
							</div>
						{/if}
					{/if}
				</section>
			{/if}

			{#if tab === 'extrude'}
				<section class="grp">
					<h3>Extrude</h3>
					<div class="field">
						<span class="lbl">Operation</span>
						<div class="segs">
							<button class="seg {extrudeOp === 'extrude_boss' ? 'on' : ''}" onclick={() => (extrudeOp = 'extrude_boss')}>Boss / Base</button>
							<button class="seg {extrudeOp === 'extrude_cut' ? 'on' : ''}" onclick={() => (extrudeOp = 'extrude_cut')}>Cut</button>
						</div>
					</div>
					<div class="g2">
						<div class="field"><label class="lbl" for="dep">Depth</label><div class="num"><input id="dep" type="number" step="0.5" min="0.1" bind:value={depth} /><span class="u">mm</span></div></div>
						<div class="field"><label class="lbl" for="dr">Draft</label><div class="num"><input id="dr" type="number" step="0.5" min="0" max="30" bind:value={draft} /><span class="u">°</span></div></div>
					</div>
					<div class="field">
						<span class="lbl">End condition</span>
						<div class="segs">
							{#each [['blind', 'Blind'], ['symmetric', 'Mid-plane'], ['through_all', 'Through all']] as [v, l]}
								<button class="seg {endCondition === v ? 'on' : ''}" onclick={() => (endCondition = v)}>{l}</button>
							{/each}
						</div>
					</div>
					<label class="check"><input type="checkbox" bind:checked={reverse} /><span>Reverse direction (flip along plane normal)</span></label>
					<p class="hint">Green preview = added material · red = removed. Cut usually wants Reverse or Through all so it enters the part.</p>
					<button class="cta" disabled={!file || !activePlane || !sketch.length || phase === 'busy'} onclick={() => applyFeature('extrude')}>Apply {extrudeOp === 'extrude_cut' ? 'cut' : 'boss'}</button>
				</section>
			{/if}

			{#if tab === 'text'}
				<section class="grp">
					<h3>Text</h3>
					<div class="field"><label class="lbl" for="tx">Text (use ⏎ for lines)</label><textarea id="tx" rows="2" bind:value={textStr}></textarea></div>
					<div class="field">
						<span class="lbl">Style</span>
						<div class="segs">
							<button class="seg {textOp === 'text_emboss' ? 'on' : ''}" onclick={() => (textOp = 'text_emboss')}>Emboss (raised)</button>
							<button class="seg {textOp === 'text_engrave' ? 'on' : ''}" onclick={() => (textOp = 'text_engrave')}>Engrave (cut)</button>
						</div>
					</div>
					<div class="g2">
						<div class="field"><label class="lbl" for="fs">Size (em)</label><div class="num"><input id="fs" type="number" step="1" min="1" bind:value={fontSize} /><span class="u">mm</span></div></div>
						<div class="field"><label class="lbl" for="td">Depth</label><div class="num"><input id="td" type="number" step="0.25" min="0.1" bind:value={textDepth} /><span class="u">mm</span></div></div>
						<div class="field"><label class="lbl" for="ls">Letter spacing</label><div class="num"><input id="ls" type="number" step="0.25" bind:value={letterSpacing} /><span class="u">mm</span></div></div>
						<div class="field"><label class="lbl" for="lf">Line factor</label><div class="num"><input id="lf" type="number" step="0.05" min="0.5" bind:value={lineFactor} /></div></div>
						<div class="field"><label class="lbl" for="pu">Pos u</label><div class="num"><input id="pu" type="number" step="1" bind:value={textPosU} /></div></div>
						<div class="field"><label class="lbl" for="pv">Pos v</label><div class="num"><input id="pv" type="number" step="1" bind:value={textPosV} /></div></div>
					</div>
					<div class="field">
						<span class="lbl">Align</span>
						<div class="segs">
							{#each ['left', 'center', 'right'] as a}
								<button class="seg {textAlign === a ? 'on' : ''}" onclick={() => (textAlign = a)}>{a}</button>
							{/each}
						</div>
					</div>
					<div class="field">
						<span class="lbl">Font</span>
						<button class="seg" onclick={() => fontInputEl.click()}>{fontName || 'Upload TTF/OTF'}</button>
						<p class="hint">Optional if the server has STL_EDITOR_FONT_PATH set. Otherwise upload a font.</p>
					</div>
					<button class="cta" disabled={!file || !activePlane || !textStr.trim() || phase === 'busy'} onclick={() => applyFeature('text')}>Apply text</button>
				</section>
			{/if}

			{#if tab === 'quality'}
				<section class="grp">
					<h3>Resolution &amp; precision</h3>
					<div class="field">
						<span class="lbl">Voxel size</span>
						<div class="segs">
							{#each seg.resolution as o}
								<button class="seg {resolution === o.v ? 'on' : ''}" onclick={() => (resolution = o.v)}>{o.l}</button>
							{/each}
						</div>
						{#if resolution === 'custom'}
							<div class="inline"><label for="vx">Custom</label><div class="num"><input id="vx" type="number" step="0.05" min="0.15" max="2" bind:value={voxel} /><span class="u">mm</span></div></div>
						{/if}
					</div>
					<label class="check"><input type="checkbox" bind:checked={cadRestore} /><span><strong>CAD surface restore</strong> — snap the untouched body back onto the original mesh (only the edited zone is remeshed).</span></label>
				</section>
			{/if}
		</div>
	</aside>

	<!-- CENTER: VIEWPORT -->
	<main class="viewport">
		{#if workBuffer}
			{#if active}<StlEditorViewport bind:this={vp} modelBuffer={workBuffer} fileName={workName} plane={activePlane} {sketch} {currentContour} {sketchMode} {preview} {onSketchPoint} {onBBox} />{/if}
		{:else}
			<div class="vp-drop {dragOver ? 'over' : ''}" role="button" tabindex="0" onclick={() => fileInputEl.click()} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputEl.click()} ondragover={(e) => { e.preventDefault(); dragOver = true; }} ondragleave={() => (dragOver = false)} ondrop={onDrop}>
				<p class="vp-t">Drop an STL to start editing</p>
				<p class="vp-h">Resize · planes · extrude boss/cut · text — up to {MAX_MB} MB</p>
				{#if sharedNonStl}<p class="vp-h warn">Studio model {sharedFile.name} is STEP/3MF — the editor needs an STL.</p>{/if}
			</div>
		{/if}
	</main>

	<!-- RIGHT: INSPECTOR -->
	<aside class="inspector">
		<div class="ins-scroll">
			<section class="grp">
				<h3>Summary</h3>
				<div class="rows">
					<div class="row"><span>Model</span><span class="v">{file ? workName : '—'}</span></div>
					<div class="row"><span>Size</span><span class="v">{fmt(dims[0])} × {fmt(dims[1])} × {fmt(dims[2])} mm</span></div>
					<div class="row"><span>Plane</span><span class="v">{activePlane ? activePlane.name : 'none'}</span></div>
					<div class="row"><span>Sketch</span><span class="v">{sketch.length} contour{sketch.length === 1 ? '' : 's'}</span></div>
					<div class="row"><span>Edits</span><span class="v">{undoStack.length}</span></div>
				</div>

				{#if phase === 'busy'}<p class="note pulse">{busyMsg} {elapsed}s</p>{/if}
				{#if phase === 'error'}<div class="alert err-a"><strong>Failed</strong><p>{errorMsg}</p></div>{/if}
				{#if warnings.length}<div class="alert warn-a"><strong>Notes</strong><ul>{#each warnings as w}<li>{w}</li>{/each}</ul></div>{/if}

				<div class="segs" style="margin-top:14px;">
					<button class="seg" onclick={undo} disabled={!undoStack.length}>Undo</button>
					<button class="seg" onclick={resetOriginal} disabled={!originalBuffer}>Reset</button>
					<button class="seg" onclick={() => vp?.fitView()} disabled={!workBuffer}>Fit</button>
				</div>
				<button class="cta" style="margin-top:12px;" disabled={!workBuffer} onclick={download}>Download STL</button>
				<button class="cta light" style="margin-top:10px;" disabled={!workBuffer} onclick={sendToMould}>Send to Mould generator →</button>
				<p class="note">"Send to Mould generator" hands this edited model straight to the mould tool — no re-upload.</p>
			</section>
		</div>
	</aside>

	<input type="file" accept=".stl" bind:this={fileInputEl} onchange={onPick} hidden />
	<input type="file" accept=".ttf,.otf" bind:this={fontInputEl} onchange={onFontPick} hidden />
</div>

<style>
	.studio { position: fixed; inset: 0; z-index: 60; display: grid; grid-template-columns: 320px 1fr 280px; grid-template-rows: 54px auto 1fr; background: #f8fafc; color: #0f172a; font-family: 'Inter', system-ui, sans-serif; font-size: 14px; overflow: hidden; --line:#e5e7eb; --muted:#64748b; --blue:#3b82f6; --ink:#0f172a; }
	.bar { grid-column: 1/-1; display: flex; align-items: center; gap: 16px; padding: 0 16px; background: #fff; border-bottom: 1px solid var(--line); }
	.brand { font-weight: 700; color: #0f172a; } .brand b { font-weight: 500; color: var(--muted); }
	.mode { display: inline-flex; gap: 2px; background: #f1f5f9; border: 1px solid var(--line); border-radius: 999px; padding: 3px; }
	.mode-b { font: inherit; font-size: 12px; font-weight: 600; color: var(--muted); background: transparent; border: none; border-radius: 999px; padding: 6px 13px; cursor: pointer; transition: color .15s, background .15s; }
	.mode-b:hover { color: var(--ink); }
	.mode-b.on { background: var(--ink); color: #fff; }
	.bar-file { display: flex; gap: 8px; align-items: center; } .fchip { background: #f1f5f9; border: 1px solid var(--line); border-radius: 999px; padding: 5px 12px; max-width: 240px; } .fname { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; max-width: 220px; }
	.mini { font: inherit; font-size: 12.5px; font-weight: 600; border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 6px 14px; cursor: pointer; } .mini.solid { background: #0f172a; color: #fff; }
	.bar-link { margin-left: auto; font-size: 13px; color: var(--muted); }
	.tabs { grid-column: 1/-1; grid-row: 2; display: flex; gap: 4px; padding: 8px 16px; background: #fff; border-bottom: 1px solid var(--line); overflow-x: auto; }
	.tab { font: inherit; font-size: 12.5px; font-weight: 600; color: var(--muted); background: transparent; border: 1px solid transparent; border-radius: 8px; padding: 6px 12px; cursor: pointer; white-space: nowrap; } .tab.on { color: #fff; background: #0f172a; }
	.props { grid-row: 3; background: #fff; border-right: 1px solid var(--line); overflow: hidden; } .props-body { height: 100%; overflow-y: auto; padding: 16px; }
	.grp h3 { font-size: 14px; font-weight: 650; margin: 0 0 14px; } .grp + .grp { margin-top: 22px; }
	.field { margin-bottom: 16px; } .lbl { display: block; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 7px; font-family: ui-monospace, monospace; }
	.hint { font-size: 12px; color: var(--muted); line-height: 1.5; margin: 8px 0 0; } .hint.warn { color: #92400e; } .err { color: #dc2626; font-size: 12.5px; }
	.segs { display: flex; flex-wrap: wrap; gap: 6px; } .seg { border: 1px solid var(--line); background: #fff; color: #475569; border-radius: 8px; padding: 7px 12px; font: inherit; font-size: 12.5px; font-weight: 550; cursor: pointer; } .seg.on { background: var(--blue); border-color: var(--blue); color: #fff; } .seg:disabled { opacity: .4; cursor: not-allowed; }
	.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; } .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px; } .g2 .field, .g3 .field { margin-bottom: 0; }
	.num { display: flex; align-items: center; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; background: #fff; } .num input { border: none; outline: none; padding: 9px 11px; font: inherit; font-size: 13.5px; width: 100%; min-width: 0; background: transparent; } .u { font-size: 10.5px; color: var(--muted); padding: 0 10px 0 4px; }
	select, textarea { width: 100%; border: 1px solid var(--line); border-radius: 9px; padding: 9px 11px; font: inherit; font-size: 13.5px; background: #fff; }
	.inline { display: flex; align-items: center; gap: 10px; margin-top: 10px; } .inline label { font-size: 12.5px; color: #475569; }
	.check { display: flex; gap: 10px; align-items: flex-start; font-size: 12.5px; line-height: 1.5; color: #475569; cursor: pointer; margin-top: 6px; } .check input { margin-top: 2px; width: 15px; height: 15px; accent-color: var(--blue); } .check strong { color: #0f172a; }
	.drop { border: 1.5px dashed var(--line); border-radius: 12px; padding: 24px; text-align: center; cursor: pointer; } .drop.over { border-color: #8b5cf6; background: #faf9ff; } .drop-t { font-weight: 550; margin: 0 0 3px; } .drop-h { font-size: 10.5px; color: var(--muted); margin: 0; }
	.file-row { display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--line); border-radius: 10px; padding: 12px; } .ghost { border: 1px solid var(--line); background: transparent; border-radius: 999px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
	.linkbtn { background: none; border: none; color: var(--blue); cursor: pointer; font: inherit; padding: 0; text-decoration: underline; }
	.clist { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; } .crow { display: flex; justify-content: space-between; align-items: center; font-size: 12px; border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; }
	.viewport { grid-row: 3; position: relative; min-width: 0; }
	.vp-drop { position: absolute; inset: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; color: var(--muted); border: 2px dashed #cbd5e1; border-radius: 20px; cursor: pointer; } .vp-drop.over { border-color: #8b5cf6; } .vp-t { font-size: 18px; font-weight: 600; color: #0f172a; margin: 0; } .vp-h { font-size: 13px; margin: 0; } .vp-h.warn { color: #92400e; }
	.inspector { grid-row: 3; background: #fff; border-left: 1px solid var(--line); overflow: hidden; } .ins-scroll { height: 100%; overflow-y: auto; padding: 16px; }
	.rows { display: flex; flex-direction: column; } .row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 12.5px; color: var(--muted); } .row .v { color: #0f172a; font-weight: 550; text-align: right; max-width: 62%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.cta { width: 100%; margin-top: 14px; background: #0f172a; color: #fff; border: none; border-radius: 10px; padding: 12px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; } .cta.light { background: var(--blue); } .cta:disabled { opacity: .4; cursor: not-allowed; }
	.note { font-size: 11.5px; color: var(--muted); margin: 10px 0 0; text-align: center; } .pulse { animation: pulse 1.6s infinite; } @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
	.alert { border-radius: 9px; padding: 12px; font-size: 12.5px; line-height: 1.5; margin-top: 14px; } .alert strong { display: block; margin-bottom: 4px; } .alert ul { margin: 6px 0 0; padding-left: 16px; } .err-a { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; } .warn-a { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
	@media (max-width: 1100px) { .studio { grid-template-columns: 300px 1fr; grid-template-rows: 54px auto 1fr auto; } .inspector { grid-column: 1/-1; grid-row: 4; border-left: none; border-top: 1px solid var(--line); max-height: 40vh; } }
</style>