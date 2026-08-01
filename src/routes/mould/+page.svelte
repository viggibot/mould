<script>
	// ==========================================================================
	// MOULD STUDIO — a full-screen design studio for the mould generator.
	// Centre viewport shows a live preview that updates as settings change.
	// No accounts, no payments, no quotas — every option is available.
	//
	// Param names match the backend MouldParams serde contract exactly
	// (snake_case, `mould_type` / `mould_style`). Do not rename them.
	//
	// DEVICE SUPPORT: the studio needs a wide landscape canvas (live 3D preview
	// + two control panels side by side). On phones and tablets held in
	// portrait, the studio is hidden and a "use a bigger screen" note is shown
	// instead — handled entirely by CSS media queries (no JS, no load flash).
	// ==========================================================================
	import { PUBLIC_API_BASE_URL } from '$env/static/public';
	import MouldPreview from '$lib/components/MouldPreview.svelte';

	const API = PUBLIC_API_BASE_URL;
	const MAX_UPLOAD_MB = 200;
	const ACCEPT = ['.stl', '.step', '.stp', '.3mf'];

	// ---- file state ---------------------------------------------------------
	let file = $state(null);
	let modelBuffer = $state(null);
	let fileError = $state('');
	let dragOver = $state(false);
	let fileInputEl;

	// ---- params (names MUST match backend MouldParams serde) ----------------
	let params = $state({
		mould_type: 'two_part',
		mould_style: 'block',
		radial_orientation: 'auto',
		parting_axis: 'z',
		parting_mode: 'auto',
		parting_offset_mm: 0,
		parting_surface: 'flat',

		wall_thickness_mm: 8,
		cavity_clearance_mm: 0.15,
		shrinkage_percent: 0,
		draft_angle_deg: 1.0,
		undercut_relief: true,

		// conformal clamshell parting flange (only used when mould_style === 'conformal')
		flange_thickness_mm: 6,
		flange_reach_mm: 10,

		// silicone mould box (only used when mould_style === 'silicone_box')
		silicone_gap_mm: 12,
		box_wall_mm: 3,
		master_seat: true,
		master_clearance_mm: 0.3,
		base_flange_mm: 8,

		resolution: 'standard',
		voxel_size_mm: 0.5,
		surface_refinement: 'standard',

		gate_type: 'top',
		sprue_type: 'straight',
		sprue_diameter_mm: 6,
		sprue_taper_deg: 2,
		funnel_top_diameter_mm: 16,
		sprue_offset_x_mm: 0,
		sprue_offset_y_mm: 0,
		runner_diameter_mm: 5,

		valve_type: 'none',
		valve_count: 2,
		valve_diameter_mm: 4,
		valve_ring_factor: 0.6,
		parting_vents: false,
		vent_width_mm: 1.0,
		vent_count: 4,

		key_shape: 'dome',
		key_count: 4,
		key_diameter_mm: 8,
		key_clearance_mm: 0.15
	});

	// ---- option metadata ----------------------------------------------------
	const seg = {
		mould_type: [
			{ v: 'two_part', l: 'Two-part' },
			{ v: 'four_part', l: 'Four-part' },
			{ v: 'six_part', l: 'Six-part' },
			{ v: 'one_part', l: 'Open pour' }
		],
		radial_orientation: [
			{ v: 'auto', l: 'Auto' },
			{ v: 'axis', l: 'Axis pulls' },
			{ v: 'diagonal', l: '45° pulls' }
		],
		mould_style: [
			{ v: 'block', l: 'Block' },
			{ v: 'silicone_box', l: 'Silicone' }
		],
		parting_axis: [
			{ v: 'x', l: 'X' },
			{ v: 'y', l: 'Y' },
			{ v: 'z', l: 'Z' }
		],
		parting_mode: [
			{ v: 'auto', l: 'Auto' },
			{ v: 'center', l: 'Center' },
			{ v: 'offset', l: 'Offset' }
		],
		parting_surface: [
			{ v: 'flat', l: 'Flat plane' },
			{ v: 'follow', l: 'Silhouette' }
		],
		gate_type: [
			{ v: 'top', l: 'Top' },
			{ v: 'side', l: 'Side' },
			{ v: 'none', l: 'None' }
		],
		sprue_type: [
			{ v: 'straight', l: 'Straight' },
			{ v: 'tapered', l: 'Tapered' },
			{ v: 'funnel', l: 'Funnel' }
		],
		valve_type: [
			{ v: 'none', l: 'None' },
			{ v: 'straight', l: 'Straight' },
			{ v: 'tapered', l: 'Tapered' }
		],
		key_shape: [
			{ v: 'dome', l: 'Dome' },
			{ v: 'cone', l: 'Cone' },
			{ v: 'none', l: 'None' }
		],
		key_count: [
			{ v: 2, l: '2' },
			{ v: 4, l: '4' },
			{ v: 6, l: '6' }
		],
		resolution: [
			{ v: 'draft', l: 'Draft · 0.8' },
			{ v: 'standard', l: 'Standard · 0.5' },
			{ v: 'fine', l: 'Fine · 0.3' },
			{ v: 'custom', l: 'Custom' }
		],
		surface_refinement: [
			{ v: 'standard', l: 'Voxel' },
			{ v: 'cad_exact', l: 'CAD-exact ±0.01' }
		]
	};

	// ---- derived ------------------------------------------------------------
	let isTwoPart = $derived(params.mould_type === 'two_part');
	let isFourPart = $derived(params.mould_type === 'four_part');
	let isSixPart = $derived(params.mould_type === 'six_part');
	let isRadial = $derived(isFourPart || isSixPart);
	let isOnePart = $derived(params.mould_type === 'one_part');
	let isConformal = $derived(false); // Conformal style retired — Block + Silicone only
	// Silicone mould: a rigid mother-mould the user pours silicone into around a
	// printed master. Two-part = split clamshell; one-part = open tray.
	let isSilicone = $derived(params.mould_style === 'silicone_box' && !isRadial);
	let showPartingSurface = $derived(isTwoPart && !isSilicone);
	let showFlange = $derived(false);
	// Silicone offers Split (two-part) and Tray (one-part); block keeps its full set.
	let mouldTypeOptions = $derived(
		params.mould_style === 'silicone_box'
			? [ { v: 'two_part', l: 'Split (2-part)' }, { v: 'one_part', l: 'Tray (1-part)' } ]
			: seg.mould_type
	);
	let showOffset = $derived(params.parting_mode === 'offset');
	let showCustomVoxel = $derived(params.resolution === 'custom');
	let showSprue = $derived(params.gate_type !== 'none' && !isOnePart);
	let showFunnel = $derived(params.sprue_type === 'funnel' && showSprue);
	let showTaper = $derived(params.sprue_type === 'tapered' && showSprue);
	let showRunner = $derived(params.gate_type === 'side' && isTwoPart);
	let showValves = $derived(params.valve_type !== 'none' && !isOnePart);
	let effectiveVoxel = $derived(
		params.resolution === 'draft'
			? 0.8
			: params.resolution === 'standard'
				? 0.5
				: params.resolution === 'fine'
					? 0.3
					: Number(params.voxel_size_mm) || 0.5
	);
	let canSubmit = $derived(!!file && phase !== 'uploading');

	// ---- tabs ---------------------------------------------------------------
	const TABS = [
		{ id: 'model', label: 'Model' },
		{ id: 'mould', label: 'Mould' },
		{ id: 'box', label: 'Box' },
		{ id: 'cavity', label: 'Cavity' },
		{ id: 'feed', label: 'Feed' },
		{ id: 'vents', label: 'Vents' },
		{ id: 'keys', label: 'Keys' },
		{ id: 'quality', label: 'Quality' }
	];
	let tab = $state('model');
	let visibleTabs = $derived(
		TABS.filter((t) => {
			if (t.id === 'box') return isSilicone; // silicone-only settings
			if (isSilicone) {
				// silicone hides the block/casting tabs (cavity, feed, vents)
				if (t.id === 'cavity' || t.id === 'feed' || t.id === 'vents') return false;
				if (t.id === 'keys') return isTwoPart; // split box has flange keys; tray has none
				return true; // model, mould, box, quality
			}
			// block: hide silicone-only Box; hide feed/vents/keys for a one-part block
			if ((t.id === 'feed' || t.id === 'vents' || t.id === 'keys') && isOnePart) return false;
			return true;
		})
	);
	$effect(() => {
		// Silicone can't be radial (four/six-part) — fall back to a split box.
		if (params.mould_style === 'silicone_box' && (isFourPart || isSixPart)) {
			params.mould_type = 'two_part';
		}
	});
	$effect(() => {
		if (!visibleTabs.some((t) => t.id === tab)) tab = 'mould';
	});

	// ---- request state ------------------------------------------------------
	let phase = $state('idle'); // idle | uploading | done | error
	let errorMsg = $state('');
	let report = $state(null);
	let mouldToken = $state('');
	let downloadUrl = $state('');
	let zipDownloaded = $state(false);
	let downloading = $state(false);
	let elapsed = $state(0);
	let elapsedTimer = null;

	// ---- helpers ------------------------------------------------------------
	function fmtSize(bytes) {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}
	function fmt(n, d = 2) {
		if (n === null || n === undefined || isNaN(n)) return '—';
		return Number(n).toFixed(d);
	}
	function num(n) {
		return typeof n === 'number' ? n.toLocaleString() : (n ?? '—');
	}

	function acceptFile(f) {
		fileError = '';
		if (!f) return;
		const name = f.name.toLowerCase();
		if (!ACCEPT.some((ext) => name.endsWith(ext))) {
			fileError = 'Unsupported format. Upload an STL, STEP or 3MF file.';
			return;
		}
		if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
			fileError = `That file is ${fmtSize(f.size)}. The limit is ${MAX_UPLOAD_MB} MB.`;
			return;
		}
		file = f;
		modelBuffer = null;
		f.arrayBuffer()
			.then((b) => {
				if (file === f) modelBuffer = b;
			})
			.catch(() => {});
		resetResult();
	}

	function resetResult() {
		report = null;
		mouldToken = '';
		downloadUrl = '';
		zipDownloaded = false;
		downloading = false;
		phase = 'idle';
		errorMsg = '';
	}
	function clearFile() {
		file = null;
		modelBuffer = null;
		fileError = '';
		resetResult();
	}
	function onPick(e) {
		if (e.target.files && e.target.files.length) acceptFile(e.target.files[0]);
		e.target.value = '';
	}
	function onDrop(e) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
			acceptFile(e.dataTransfer.files[0]);
		}
	}
	function onVoxelBlur() {
		let v = Number(params.voxel_size_mm);
		if (!isFinite(v)) v = 0.3;
		params.voxel_size_mm = Math.min(2, Math.max(0.15, v));
	}

	// Mirrors the backend MouldParams::clamp() so the UI never shows a value the
	// server would silently rewrite.
	function clampParams(p) {
		const c = { ...p };
		const n = (v, def) => {
			const x = Number(v);
			return isFinite(x) ? x : def;
		};
		const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

		if (!['auto', 'axis', 'diagonal'].includes(c.radial_orientation)) c.radial_orientation = 'auto';
		c.parting_offset_mm = clamp(n(c.parting_offset_mm, 0), -500, 500);
		c.wall_thickness_mm = clamp(n(c.wall_thickness_mm, 8), 3, 40);
		c.cavity_clearance_mm = clamp(n(c.cavity_clearance_mm, 0.15), 0, 2);
		c.flange_thickness_mm = clamp(n(c.flange_thickness_mm, 6), 2, 20);
		c.flange_reach_mm = clamp(n(c.flange_reach_mm, 10), 3, 40);
		c.shrinkage_percent = clamp(n(c.shrinkage_percent, 0), -5, 8);
		c.draft_angle_deg = clamp(n(c.draft_angle_deg, 1), 0, 10);
		c.voxel_size_mm = clamp(n(c.voxel_size_mm, 0.5), 0.15, 2);
		c.sprue_diameter_mm = clamp(n(c.sprue_diameter_mm, 6), 2, 30);
		c.sprue_taper_deg = clamp(n(c.sprue_taper_deg, 2), 0, 15);
		c.funnel_top_diameter_mm = clamp(n(c.funnel_top_diameter_mm, 16), c.sprue_diameter_mm, 60);
		c.sprue_offset_x_mm = n(c.sprue_offset_x_mm, 0);
		c.sprue_offset_y_mm = n(c.sprue_offset_y_mm, 0);
		c.runner_diameter_mm = clamp(n(c.runner_diameter_mm, 5), 2, 20);
		c.valve_count = clamp(Math.round(n(c.valve_count, 2)), 0, 8);
		c.valve_diameter_mm = clamp(n(c.valve_diameter_mm, 4), 1, 15);
		c.valve_ring_factor = clamp(n(c.valve_ring_factor, 0.6), 0.1, 0.9);
		c.vent_width_mm = clamp(n(c.vent_width_mm, 1), 0.3, 4);
		c.vent_count = clamp(Math.round(n(c.vent_count, 4)), 1, 8);
		const kc = Math.round(n(c.key_count, 4));
		c.key_count = kc <= 2 ? 2 : kc <= 4 ? 4 : 6;
		c.key_diameter_mm = clamp(n(c.key_diameter_mm, 8), 3, 20);
		c.key_clearance_mm = clamp(n(c.key_clearance_mm, 0.15), 0, 1);
		if (!['standard', 'cad_exact'].includes(c.surface_refinement)) c.surface_refinement = 'standard';
		if (!['flat', 'follow'].includes(c.parting_surface)) c.parting_surface = 'flat';
		if (c.mould_type !== 'two_part' && c.parting_surface === 'follow') c.parting_surface = 'flat';
		// Conformal moulds always split on a flat parting flange — the backend
		// ignores silhouette-follow for conformal, so send 'flat' to match.
		if (c.mould_style === 'conformal' && c.parting_surface === 'follow') c.parting_surface = 'flat';
		c.silicone_gap_mm = clamp(n(c.silicone_gap_mm, 12), 3, 50);
		c.box_wall_mm = clamp(n(c.box_wall_mm, 3), 1.5, 12);
		c.master_seat = !!c.master_seat;
		c.master_clearance_mm = clamp(n(c.master_clearance_mm, 0.3), 0, 2);
		c.base_flange_mm = clamp(n(c.base_flange_mm, 8), 0, 30);
		if (c.mould_style === 'silicone_box') {
			// silicone builds a split box (two-part) or an open tray (one-part)
			if (c.mould_type !== 'two_part' && c.mould_type !== 'one_part') c.mould_type = 'two_part';
			c.parting_surface = 'flat';
		}
		if (c.mould_style === 'conformal') c.mould_style = 'block'; // conformal retired
		return c;
	}

	// ---- submit -------------------------------------------------------------
	async function generate() {
		if (!canSubmit) return;
		phase = 'uploading';
		errorMsg = '';
		report = null;
		mouldToken = '';
		downloadUrl = '';
		zipDownloaded = false;
		downloading = false;
		elapsed = 0;
		elapsedTimer = setInterval(() => (elapsed += 1), 1000);

		try {
			const clean = clampParams(params);
			const fd = new FormData();
			fd.append('params', JSON.stringify(clean));
			fd.append('file', file, file.name);

			const res = await fetch(`${API}/calc/mould/v2/generate?source=mould_studio`, {
				method: 'POST',
				body: fd
			});

			let body = null;
			let rawText = '';
			try {
				rawText = await res.text();
				body = JSON.parse(rawText);
			} catch (e) {
				/* plain-text error body */
			}

			const okStatus = body && (body.status === 'ok' || body.status === 'success');
			if (!res.ok || !body || !okStatus) {
				const msg =
					(body && (body.message || body.error)) || rawText || `Generation failed (HTTP ${res.status}).`;
				throw new Error(msg);
			}

			report = body.report || null;
			mouldToken = body.token || '';
			downloadUrl = body.download_url || '';
			phase = 'done';
		} catch (err) {
			errorMsg = err && err.message ? err.message : 'The mould could not be generated. Try again.';
			phase = 'error';
		} finally {
			if (elapsedTimer) {
				clearInterval(elapsedTimer);
				elapsedTimer = null;
			}
		}
	}

	// Robust download. The old version navigated the top window to the download
	// URL (window.location.href), which silently failed in several cases
	// (cross-origin navigation downloads, the page's unload guard, and the
	// single-use link being marked "downloaded" before the browser committed the
	// save). Instead we fetch the ZIP as a blob and click a synthetic <a download>
	// — this reliably saves the file, lets us name it, and surfaces the real
	// server message (expired / already collected) instead of a blank failure.
	async function downloadZip() {
		if (zipDownloaded || downloading) return;
		const target = downloadUrl
			? `${API}${downloadUrl}`
			: mouldToken
				? `${API}/calc/mould/v2/download/${mouldToken}`
				: '';
		if (!target) return;

		downloading = true;
		errorMsg = '';
		try {
			const res = await fetch(target, { method: 'GET' });
			const ct = res.headers.get('content-type') || '';
			// The server returns a JSON error (with a `code`) instead of a ZIP
			// when the package is gone (DOWNLOAD_EXPIRED) or came back empty
			// (DOWNLOAD_EMPTY). Surface the message and let the user regenerate.
			if (!res.ok || ct.includes('application/json') || ct.includes('text/')) {
				let msg = `Download failed (HTTP ${res.status}).`;
				let code = '';
				try {
					const j = await res.json();
					msg = j.message || j.error || msg;
					code = j.code || '';
				} catch (_) {}
				if (code === 'DOWNLOAD_EXPIRED' || code === 'DOWNLOAD_EMPTY') {
					// the package is no longer downloadable — clear it so the
					// Generate button is armed again for a fresh package
					mouldToken = '';
					downloadUrl = '';
					zipDownloaded = false;
				}
				throw new Error(msg);
			}
			const blob = await res.blob();
			if (!blob || blob.size === 0) {
				mouldToken = '';
				downloadUrl = '';
				throw new Error('The download came back empty. Please generate the mould again.');
			}
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.rel = 'noopener';
			const raw = file && file.name ? file.name.replace(/\.[^.]+$/, '') : 'model';
			const base = (raw || 'model').replace(/[^\w.-]+/g, '_'); // safe filename
			a.download = `${base}_mould.zip`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 4000);
			zipDownloaded = true;
		} catch (err) {
			errorMsg =
				err && err.message
					? err.message
					: 'The download could not be completed. Packages are single-use — please generate the mould again.';
		} finally {
			downloading = false;
		}
	}

	let typeLabel = $derived(
		params.mould_type === 'two_part'
			? 'Two-part'
			: params.mould_type === 'four_part'
				? 'Four-part radial'
				: params.mould_type === 'six_part'
					? 'Six-part radial'
					: 'Open pour'
	);
</script>

<svelte:head>
	<title>Mould Studio — design a print-ready mould</title>
	<meta name="description" content="Interactive studio for turning a 3D model into a print-ready casting mould, with a live 3D preview of the cavity, parting, sprue, vents and keys." />
	<meta name="robots" content="noindex" />
</svelte:head>

<!-- ===================== TAB ICONS (second navbar) ===================== -->
<!-- Small stroke-line marks in the same family as the brand logo, so each
     section of the properties navbar is recognisable at a glance. -->
{#snippet tabIcon(id)}
	{#if id === 'model'}
		<!-- uploaded 3D part: an isometric cube -->
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M12 2.5 20.5 7.25 20.5 16.75 12 21.5 3.5 16.75 3.5 7.25Z" />
			<path d="M12 12V2.5M12 12 3.5 7.25M12 12 20.5 7.25" />
		</svg>
	{:else if id === 'mould'}
		<!-- the two mould halves + parting line — echoes the brand mark -->
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<line x1="12" y1="2.5" x2="12" y2="21.5" stroke-dasharray="2.4 2.4" />
			<path d="M7.8 18.5A6.5 7.5 0 0 1 7.8 5.5" />
			<path d="M16.2 5.5A6.5 7.5 0 0 1 16.2 18.5" />
		</svg>
	{:else if id === 'box'}
		<!-- silicone box: an open-top frame with the master seated inside -->
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M4 6v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6" />
			<path d="M2.5 6h19" />
			<rect x="9" y="11" width="6" height="6" rx="1" />
		</svg>
	{:else if id === 'cavity'}
		<!-- hollowed shell: outer block with an inner offset cavity -->
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<rect x="3" y="3" width="18" height="18" rx="4" />
			<rect x="7.5" y="7.5" width="9" height="9" rx="2.5" />
		</svg>
	{:else if id === 'feed'}
		<!-- feed system: a pouring funnel / sprue -->
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M3 5h18l-7 8v6l-4-2.2V13z" />
		</svg>
	{:else if id === 'vents'}
		<!-- venting: air escaping -->
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M3 8h12a3 3 0 1 0-3-3" />
			<path d="M3 12h16a3 3 0 1 1-3 3" />
			<path d="M3 16h9a2.6 2.6 0 1 1-2.6 2.6" />
		</svg>
	{:else if id === 'keys'}
		<!-- registration keys: two pegs aligning across the seam -->
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<circle cx="7" cy="12" r="3.4" />
			<circle cx="17" cy="12" r="3.4" />
			<line x1="10.4" y1="12" x2="13.6" y2="12" stroke-dasharray="1.5 1.8" />
		</svg>
	{:else if id === 'quality'}
		<!-- resolution / precision: a target -->
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<circle cx="12" cy="12" r="8" />
			<circle cx="12" cy="12" r="3.2" />
			<path d="M12 1.5V5M12 19v3.5M1.5 12H5M19 12h3.5" />
		</svg>
	{/if}
{/snippet}

<div class="studio">
	<!-- ===================== HEADER ===================== -->
	<header class="bar">
		<a class="brand" href="/">
			<svg width="26" height="26" viewBox="0 0 30 30" aria-hidden="true">
				<rect x="1" y="1" width="28" height="28" rx="8" fill="#0f172a" />
				<line x1="15" y1="4" x2="15" y2="26" stroke="#8b5cf6" stroke-width="1.6" stroke-dasharray="2.5 2.5" />
				<path d="M9.5 20 A5.5 6.5 0 0 1 9.5 8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
				<path d="M20.5 8 A5.5 6.5 0 0 1 20.5 20" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
				<circle cx="15" cy="14" r="2.4" fill="#22d3ee" />
			</svg>
			<span>Mould<b>Studio</b></span>
		</a>

		<div class="bar-file">
			{#if file}
				<span class="fchip"><span class="fname">{file.name}</span><span class="fsize">{fmtSize(file.size)}</span></span>
				<button class="mini" type="button" onclick={clearFile}>Remove</button>
			{:else}
				<button class="mini solid" type="button" onclick={() => fileInputEl.click()}>Upload model</button>
			{/if}
		</div>

		<a class="bar-link" href="/">← Back to site</a>
	</header>

	<!-- ===================== SECOND NAVBAR: SECTION TABS ===================== -->
	<!-- Full-width tab bar spanning the whole app, so every section label shows
	     in full instead of being clipped/scrolled inside the narrow left panel. -->
	<nav class="tabs">
		{#each visibleTabs as t}
			<button type="button" class="tab {tab === t.id ? 'on' : ''}" onclick={() => (tab = t.id)}>
				<span class="tab-ico">{@render tabIcon(t.id)}</span>
				<span class="tab-lbl">{t.label}</span>
			</button>
		{/each}
	</nav>

	<!-- ===================== LEFT: PROPERTIES ===================== -->
	<aside class="props">
		<div class="props-body">
			<!-- MODEL -->
			{#if tab === 'model'}
				<section class="grp">
					<h3>Model</h3>
					{#if !file}
						<div
							class="drop {dragOver ? 'over' : ''}"
							role="button"
							tabindex="0"
							onclick={() => fileInputEl.click()}
							onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInputEl.click())}
							ondragover={(e) => {
								e.preventDefault();
								dragOver = true;
							}}
							ondragleave={() => (dragOver = false)}
							ondrop={onDrop}>
							<p class="drop-t">Drop model or click</p>
							<p class="drop-h">STL · 3MF · STEP · ≤ {MAX_UPLOAD_MB} MB</p>
						</div>
					{:else}
						<div class="file-row">
							<div class="file-meta">
								<span class="file-name">{file.name}</span>
								<span class="file-size">{fmtSize(file.size)}</span>
							</div>
							<button class="ghost" type="button" onclick={clearFile}>Remove</button>
						</div>
					{/if}
					{#if fileError}<p class="err">{fileError}</p>{/if}
					<p class="hint">The mesh should be watertight so the tool can define an inside to hollow out.</p>
				</section>
			{/if}

			<!-- MOULD -->
			{#if tab === 'mould'}
				<section class="grp">
					<h3>Mould setup</h3>

					<div class="field">
						<span class="lbl">Mould type</span>
						<div class="segs">
							{#each mouldTypeOptions as o}
								<button type="button" class="seg {params.mould_type === o.v ? 'on' : ''}" onclick={() => (params.mould_type = o.v)}>{o.l}</button>
							{/each}
						</div>
						<p class="hint">{#if isSilicone}<strong>Split</strong> is a two-part clamshell you open to release the cured silicone and master. <strong>Tray</strong> is a one-part open box the master nests in — pour, cure, then flex it out.{:else}Two-part splits on a plane. Four-part adds sideways wedges for side undercuts; six-part adds top and bottom caps. Open pour is a single open-top block.{/if}</p>
					</div>

					{#if isRadial}
						<div class="field">
							<span class="lbl">Pull orientation</span>
							<div class="segs">
								{#each seg.radial_orientation as o}
									<button type="button" class="seg {params.radial_orientation === o.v ? 'on' : ''}" onclick={() => (params.radial_orientation = o.v)}>{o.l}</button>
								{/each}
							</div>
						</div>
					{/if}

					<div class="field">
						<span class="lbl">Style</span>
						<div class="segs">
							{#each seg.mould_style as o}
								<button type="button" class="seg {params.mould_style === o.v ? 'on' : ''}" onclick={() => (params.mould_style = o.v)}>{o.l}</button>
							{/each}
						</div>
						<p class="hint">{#if isSilicone}A rigid mother-mould that FOLLOWS your part on a base plate. Pour silicone into the gap around the master, cure, release the silicone negative, then cast plaster/resin in it. Set the gap and base in the Box tab.{:else}A solid rectangular mould split into parts. Simple and strong; best when you don't need to save material.{/if}</p>
					</div>

					<div class="field">
						<span class="lbl">{isSilicone ? 'Split axis' : 'Pull axis'}</span>
						<div class="segs narrow">
							{#each seg.parting_axis as o}
								<button type="button" class="seg {params.parting_axis === o.v ? 'on' : ''}" onclick={() => (params.parting_axis = o.v)}>{o.l}</button>
							{/each}
						</div>
						{#if isSilicone && isTwoPart}
							<p class="hint">Which way the box splits. <strong>X or Y</strong> give a vertical clamshell — two halves that lift apart sideways, with the mating flange + keys down the edges (like the swan mould). <strong>Z</strong> gives a horizontal lid split. The base plate always stays at the bottom.</p>
						{:else if isSilicone}
							<p class="hint">A one-part tray doesn't split — the axis only sets orientation. The master nests in the base and you pour from the open top.</p>
						{/if}
					</div>

					{#if isTwoPart}
						<div class="field">
							<span class="lbl">Parting plane</span>
							<div class="segs">
								{#each seg.parting_mode as o}
									<button type="button" class="seg {params.parting_mode === o.v ? 'on' : ''}" onclick={() => (params.parting_mode = o.v)}>{o.l}</button>
								{/each}
							</div>
							{#if showOffset}
								<div class="inline">
									<label for="poff">Offset</label>
									<div class="num"><input id="poff" type="number" step="0.5" min="-500" max="500" bind:value={params.parting_offset_mm} /><span class="u">mm</span></div>
								</div>
							{/if}
						</div>

						{#if showPartingSurface}
							<div class="field">
								<span class="lbl">Parting surface</span>
								<div class="segs">
									{#each seg.parting_surface as o}
										<button type="button" class="seg {params.parting_surface === o.v ? 'on' : ''}" onclick={() => (params.parting_surface = o.v)}>{o.l}</button>
									{/each}
								</div>
								<p class="hint">{params.parting_surface === 'follow' ? 'Halves split on a curved surface tracing the widest silhouette; keys, vents and runner follow the curve.' : 'A flat plane at the parting height.'}</p>
							</div>
						{/if}
					{/if}
				</section>
			{/if}

			<!-- BOX (silicone mould box) -->
			{#if tab === 'box' && isSilicone}
				<section class="grp">
					<h3>Silicone jacket</h3>
					<div class="g2">
						<div class="field">
							<label class="lbl" for="sgap">Silicone gap</label>
							<div class="num"><input id="sgap" type="number" step="1" min="3" max="50" bind:value={params.silicone_gap_mm} /><span class="u">mm</span></div>
						</div>
						<div class="field">
							<label class="lbl" for="bwall">Jacket wall</label>
							<div class="num"><input id="bwall" type="number" step="0.5" min="1.5" max="12" bind:value={params.box_wall_mm} /><span class="u">mm</span></div>
						</div>
					</div>
					<p class="hint">The jacket is a thin rigid shell that <em>follows your part</em>, offset outward by the silicone gap (the silicone fills that gap around the master). Bigger gap = thicker, stronger silicone mould. Jacket wall is the rigid printed shell thickness.</p>

					<div class="field" style="margin-top:14px;">
						<label class="lbl" for="bflange">Base flange</label>
						<div class="num"><input id="bflange" type="number" step="1" min="0" max="30" bind:value={params.base_flange_mm} /><span class="u">mm</span></div>
						<p class="hint">The flat base plate the jacket stands on, extending this far past the wall. ≥5&nbsp;mm adds clamp-bolt holes at the corners so the two halves bolt shut.</p>
					</div>

					<div class="g2" style="margin-top:14px;">
						<div class="field">
							<label class="lbl" for="mflt">Collar thickness</label>
							<div class="num"><input id="mflt" type="number" step="0.5" min="3" max="20" bind:value={params.flange_thickness_mm} /><span class="u">mm</span></div>
						</div>
						<div class="field">
							<label class="lbl" for="mflr">Collar reach</label>
							<div class="num"><input id="mflr" type="number" step="1" min="4" max="30" bind:value={params.flange_reach_mm} /><span class="u">mm</span></div>
						</div>
					</div>
					<p class="hint">The flat mating collar where the two halves meet, running down the split. Thickness is how deep the collar is across the seam (it carries the registration keys — thicker anchors bigger keys); reach is how far it sticks out past the part so you can clamp/bolt the seam.</p>

					<label class="check">
						<input type="checkbox" bind:checked={params.master_seat} />
						<span><strong>Master locator socket</strong> — recess the part's footprint into the base plate so the master seats centred with even silicone all round.</span>
					</label>

					{#if params.master_seat}
						<div class="field" style="margin-top:14px;">
							<label class="lbl" for="mclr">Master fit clearance</label>
							<div class="num"><input id="mclr" type="number" step="0.05" min="0" max="2" bind:value={params.master_clearance_mm} /><span class="u">mm</span></div>
							<p class="hint">Gap around the master in its base socket so it seats without forcing. 0.2–0.4 mm for FDM prints.</p>
						</div>
					{/if}

					<p class="hint">Workflow: print the two jacket halves, seat the master in the base, bolt/clip the halves shut, then pour liquid silicone through the open top to fill the gap. Once cured, open the jacket, peel the silicone off the master — you now have a reusable silicone negative. Pour plaster of Paris or resin into it (held in the jacket) to cast copies.</p>
				</section>
			{/if}

			<!-- CAVITY -->
			{#if tab === 'cavity'}
				<section class="grp">
					<h3>Cavity &amp; fit</h3>
					<div class="g2">
						<div class="field">
							<label class="lbl" for="wall">Wall thickness</label>
							<div class="num"><input id="wall" type="number" step="0.5" min="3" max="40" bind:value={params.wall_thickness_mm} /><span class="u">mm</span></div>
						</div>
						<div class="field">
							<label class="lbl" for="clr">Cavity clearance</label>
							<div class="num"><input id="clr" type="number" step="0.05" min="0" max="2" bind:value={params.cavity_clearance_mm} /><span class="u">mm</span></div>
						</div>
						<div class="field">
							<label class="lbl" for="shr">Shrinkage</label>
							<div class="num"><input id="shr" type="number" step="0.1" min="-5" max="8" bind:value={params.shrinkage_percent} /><span class="u">%</span></div>
						</div>
						<div class="field">
							<label class="lbl" for="draft">Draft angle</label>
							<div class="num"><input id="draft" type="number" step="0.5" min="0" max="10" bind:value={params.draft_angle_deg} /><span class="u">°</span></div>
						</div>
					</div>
					<label class="check">
						<input type="checkbox" bind:checked={params.undercut_relief} />
						<span><strong>Undercut relief</strong> — sweep each half so it demoulds cleanly even with overhangs.</span>
					</label>
					<p class="hint">Clearance is the gap around the part for release. Set draft to 0 if holes must stay perfectly cylindrical.</p>
				</section>
			{/if}

			<!-- FEED -->
			{#if tab === 'feed' && !isOnePart}
				<section class="grp">
					<h3>Feed system</h3>
					<div class="field">
						<span class="lbl">Gate</span>
						<div class="segs">
							{#each seg.gate_type as o}
								<button type="button" class="seg {params.gate_type === o.v ? 'on' : ''}" onclick={() => (params.gate_type = o.v)}>{o.l}</button>
							{/each}
						</div>
						<p class="hint">Top pours straight down; side places the sprue beside the part with a runner along the parting line.</p>
					</div>

					{#if showSprue}
						<div class="field">
							<span class="lbl">Sprue profile</span>
							<div class="segs">
								{#each seg.sprue_type as o}
									<button type="button" class="seg {params.sprue_type === o.v ? 'on' : ''}" onclick={() => (params.sprue_type = o.v)}>{o.l}</button>
								{/each}
							</div>
						</div>
						<div class="g2">
							<div class="field">
								<label class="lbl" for="spd">Sprue Ø</label>
								<div class="num"><input id="spd" type="number" step="0.5" min="2" max="30" bind:value={params.sprue_diameter_mm} /><span class="u">mm</span></div>
							</div>
							{#if showTaper}
								<div class="field">
									<label class="lbl" for="spt">Taper</label>
									<div class="num"><input id="spt" type="number" step="0.5" min="0" max="15" bind:value={params.sprue_taper_deg} /><span class="u">°</span></div>
								</div>
							{/if}
							{#if showFunnel}
								<div class="field">
									<label class="lbl" for="fnl">Funnel top Ø</label>
									<div class="num"><input id="fnl" type="number" step="1" min={params.sprue_diameter_mm} max="60" bind:value={params.funnel_top_diameter_mm} /><span class="u">mm</span></div>
								</div>
							{/if}
							{#if showRunner}
								<div class="field">
									<label class="lbl" for="run">Runner Ø</label>
									<div class="num"><input id="run" type="number" step="0.5" min="2" max="20" bind:value={params.runner_diameter_mm} /><span class="u">mm</span></div>
								</div>
							{/if}
							<div class="field">
								<label class="lbl" for="sox">Sprue offset X</label>
								<div class="num"><input id="sox" type="number" step="0.5" bind:value={params.sprue_offset_x_mm} /><span class="u">mm</span></div>
							</div>
							<div class="field">
								<label class="lbl" for="soy">Sprue offset Y</label>
								<div class="num"><input id="soy" type="number" step="0.5" bind:value={params.sprue_offset_y_mm} /><span class="u">mm</span></div>
							</div>
						</div>
						<p class="hint">Keep the pour point over the part or the sprue lands blind.</p>
					{/if}
				</section>
			{/if}

			<!-- VENTS -->
			{#if tab === 'vents' && !isOnePart}
				<section class="grp">
					<h3>Venting &amp; air valves</h3>
					<div class="field">
						<span class="lbl">Air valves (risers)</span>
						<div class="segs">
							{#each seg.valve_type as o}
								<button type="button" class="seg {params.valve_type === o.v ? 'on' : ''}" onclick={() => (params.valve_type = o.v)}>{o.l}</button>
							{/each}
						</div>
						<p class="hint">Vertical channels that let trapped air escape and act as resin risers.</p>
					</div>

					{#if showValves}
						<div class="g3">
							<div class="field">
								<label class="lbl" for="vc">Count</label>
								<div class="num"><input id="vc" type="number" step="1" min="0" max="8" bind:value={params.valve_count} /></div>
							</div>
							<div class="field">
								<label class="lbl" for="vd">Ø</label>
								<div class="num"><input id="vd" type="number" step="0.5" min="1" max="15" bind:value={params.valve_diameter_mm} /><span class="u">mm</span></div>
							</div>
							<div class="field">
								<label class="lbl" for="vr">Ring</label>
								<div class="num"><input id="vr" type="number" step="0.05" min="0.1" max="0.9" bind:value={params.valve_ring_factor} /></div>
							</div>
						</div>
						<p class="hint">Ring: 0.1 = near center · 0.9 = near edge. Keep valves over the part.</p>
					{/if}

					{#if isRadial}
						<p class="hint">Radial moulds vent through their seams — parting-line vents are not generated.</p>
					{/if}
					{#if isTwoPart}
						<label class="check">
							<input type="checkbox" bind:checked={params.parting_vents} />
							<span><strong>Parting-line vents</strong> — shallow radial channels along the parting surface.</span>
						</label>
						{#if params.parting_vents}
							<div class="g2">
								<div class="field">
									<label class="lbl" for="vw">Vent width</label>
									<div class="num"><input id="vw" type="number" step="0.1" min="0.3" max="4" bind:value={params.vent_width_mm} /><span class="u">mm</span></div>
									<p class="hint">Keep ≥ 2× voxel ({fmt(2 * effectiveVoxel, 2)} mm).</p>
								</div>
								<div class="field">
									<label class="lbl" for="vn">Vent count</label>
									<div class="num"><input id="vn" type="number" step="1" min="1" max="8" bind:value={params.vent_count} /></div>
								</div>
							</div>
						{/if}
					{/if}
				</section>
			{/if}

			<!-- KEYS -->
			{#if tab === 'keys' && !isOnePart}
				<section class="grp">
					<h3>Registration keys</h3>
					<div class="field">
						<span class="lbl">Key shape</span>
						<div class="segs">
							{#each seg.key_shape as o}
								<button type="button" class="seg {params.key_shape === o.v ? 'on' : ''}" onclick={() => (params.key_shape = o.v)}>{o.l}</button>
							{/each}
						</div>
						<p class="hint">{#if isSilicone}Bosses on one half, sockets in the other, seated down the mating flange with a solid rim so they never print thin — they lock the two halves in register.{:else}Bosses on one half, sockets in the other — keeps alignment perfect.{/if}</p>
					</div>

					{#if params.key_shape !== 'none'}
						{#if isRadial}
							<p class="hint">Keys are placed automatically — one per wedge seam{isSixPart ? ', with caps registering on the seams' : ''}.</p>
						{/if}
						<div class="g3">
							{#if !isRadial}
								<div class="field">
									<span class="lbl">Count</span>
									<div class="segs narrow">
										{#each seg.key_count as o}
											<button type="button" class="seg {params.key_count === o.v ? 'on' : ''}" onclick={() => (params.key_count = o.v)}>{o.l}</button>
										{/each}
									</div>
								</div>
							{/if}
							<div class="field">
								<label class="lbl" for="kd">Ø</label>
								<div class="num"><input id="kd" type="number" step="0.5" min="3" max="20" bind:value={params.key_diameter_mm} /><span class="u">mm</span></div>
							</div>
							<div class="field">
								<label class="lbl" for="kc">Clearance</label>
								<div class="num"><input id="kc" type="number" step="0.05" min="0" max="1" bind:value={params.key_clearance_mm} /><span class="u">mm</span></div>
							</div>
						</div>
						<p class="hint">0.1–0.2 mm for FDM, 0.05–0.1 mm for resin.</p>
					{/if}
				</section>
			{/if}

			<!-- QUALITY -->
			{#if tab === 'quality'}
				<section class="grp">
					<h3>Resolution &amp; precision</h3>
					<div class="field">
						<span class="lbl">Voxel size</span>
						<div class="segs">
							{#each seg.resolution as o}
								<button type="button" class="seg {params.resolution === o.v ? 'on' : ''}" onclick={() => (params.resolution = o.v)}>{o.l}</button>
							{/each}
						</div>
						{#if showCustomVoxel}
							<div class="inline">
								<label for="vox">Custom</label>
								<div class="num"><input id="vox" type="number" step="0.05" min="0.15" max="2" bind:value={params.voxel_size_mm} onblur={onVoxelBlur} /><span class="u">mm</span></div>
							</div>
						{/if}
						<p class="hint">Finer voxels capture more detail but take longer. Large parts at fine resolution are auto-coarsened on the server.</p>
					</div>

					<div class="field">
						<span class="lbl">Cavity precision</span>
						<div class="segs">
							{#each seg.surface_refinement as o}
								<button type="button" class="seg {params.surface_refinement === o.v ? 'on' : ''}" onclick={() => (params.surface_refinement = o.v)}>{o.l}</button>
							{/each}
						</div>
						<p class="hint">{params.surface_refinement === 'cad_exact' ? 'Every cavity vertex is projected onto the true offset surface — about ±0.01 mm, independent of voxel size, with sharp edges kept.' : 'Voxel-accurate: exact to within a fraction of the voxel size. Switch to CAD-exact for geometry-exact cavities.'}</p>
					</div>
				</section>
			{/if}
		</div>
	</aside>

	<!-- ===================== CENTRE: VIEWPORT ===================== -->
	<main class="viewport">
		{#if file && modelBuffer}
			<MouldPreview {modelBuffer} fileName={file.name} {params} />
		{:else if file}
			<div class="vp-empty"><div class="spinner"></div><p>Reading {file.name}…</p></div>
		{:else}
			<div
				class="vp-drop {dragOver ? 'over' : ''}"
				role="button"
				tabindex="0"
				onclick={() => fileInputEl.click()}
				onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInputEl.click())}
				ondragover={(e) => {
					e.preventDefault();
					dragOver = true;
				}}
				ondragleave={() => (dragOver = false)}
				ondrop={onDrop}>
				<svg viewBox="0 0 24 24" class="vp-icon" aria-hidden="true">
					<path d="M12 3v12m0-12l-4 4m4-4l4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
				</svg>
				<p class="vp-t">Drop a 3D model to start</p>
				<p class="vp-h">STL · 3MF · STEP · up to {MAX_UPLOAD_MB} MB — then tune the mould live</p>
			</div>
		{/if}
	</main>

	<!-- ===================== RIGHT: OUTPUT ===================== -->
	<aside class="inspector">
		<div class="ins-scroll">
			<section class="grp">
				<h3>Summary</h3>
				<div class="rows">
					<div class="row"><span>Model</span><span class="v">{file ? file.name : '—'}</span></div>
					<div class="row"><span>Type</span><span class="v">{typeLabel} · {isSilicone ? (isTwoPart ? 'split silicone' : 'silicone tray') : 'block'}</span></div>
					<div class="row"><span>Pull / parting</span><span class="v">{#if isRadial}{isSixPart ? '4 radial + 2 caps' : 'radial ±X ±Y'}{:else}{params.parting_axis.toUpperCase()}{#if isTwoPart} · {params.parting_mode}{isConformal ? ' · flange' : params.parting_surface === 'follow' ? ' · silhouette' : ''}{/if}{/if}</span></div>
					{#if isSilicone}
						<div class="row"><span>Silicone gap</span><span class="v">{params.silicone_gap_mm} mm</span></div>
						<div class="row"><span>Jacket wall</span><span class="v">{params.box_wall_mm} mm</span></div>
						<div class="row"><span>Base flange</span><span class="v">{params.base_flange_mm} mm{params.base_flange_mm >= 5 ? ' · bolts' : ''}</span></div>
						<div class="row"><span>Master seat</span><span class="v">{params.master_seat ? `socket · ${params.master_clearance_mm} mm` : 'none'}</span></div>
					{:else}
						<div class="row"><span>Wall / clr</span><span class="v">{params.wall_thickness_mm} / {params.cavity_clearance_mm} mm</span></div>
					{/if}
					{#if showFlange}
						<div class="row"><span>Flange t / reach</span><span class="v">{params.flange_thickness_mm} / {params.flange_reach_mm} mm</span></div>
					{/if}
					<div class="row"><span>Draft / shrink</span><span class="v">{params.draft_angle_deg}° / {params.shrinkage_percent}%</span></div>
					{#if !isOnePart && !isSilicone}
						<div class="row"><span>Gate</span><span class="v">{params.gate_type === 'none' ? 'None' : `${params.gate_type} · ${params.sprue_type} · Ø${params.sprue_diameter_mm}`}</span></div>
						<div class="row"><span>Valves</span><span class="v">{params.valve_type === 'none' ? 'None' : `${params.valve_count} × Ø${params.valve_diameter_mm}`}</span></div>
					{/if}
					{#if isTwoPart}
						<div class="row"><span>Keys</span><span class="v">{params.key_shape === 'none' ? 'None' : `${params.key_count} × ${params.key_shape}`}</span></div>
					{/if}
					<div class="row"><span>Voxel</span><span class="v">{effectiveVoxel} mm</span></div>
					<div class="row"><span>Precision</span><span class="v">{params.surface_refinement === 'cad_exact' ? 'CAD-exact ±0.01' : 'Voxel'}</span></div>
				</div>

				<button class="cta" type="button" disabled={!canSubmit} onclick={generate}>
					{#if phase === 'uploading'}Generating… {elapsed}s{:else}Generate mould{/if}
				</button>

				{#if phase === 'uploading'}
					<p class="note pulse">Voxelising, sweeping cavities and meshing on the server. Typically 10–60 s.</p>
				{:else if !file}
					<p class="note">Upload a model to begin.</p>
				{/if}

				{#if phase === 'error'}
					<div class="alert err-a"><strong>Generation failed</strong><p>{errorMsg}</p></div>
				{/if}
			</section>

			{#if phase === 'done' && report}
				<section class="grp">
					<h3>Result</h3>
					<div class="res">
						<div class="res-i"><span class="rl">Part size</span><span class="rv">{fmt(report.part_l_mm, 1)} × {fmt(report.part_w_mm, 1)} × {fmt(report.part_h_mm, 1)} mm</span></div>
						<div class="res-i"><span class="rl">{report.mould_style === 'silicone_box' ? 'Master volume' : 'Part volume'}</span><span class="rv">{fmt(report.part_volume_cm3)} cm³</span></div>
						<div class="res-i"><span class="rl">{report.mould_style === 'silicone_box' ? 'Box size' : 'Mould block'}</span><span class="rv">{fmt(report.block_x_mm, 1)} × {fmt(report.block_y_mm, 1)} × {fmt(report.block_z_mm, 1)} mm</span></div>
						{#if report.mould_style === 'silicone_box'}
							<div class="res-i hl"><span class="rl">Silicone needed</span><span class="rv">≈ {fmt(report.silicone_volume_cm3, 0)} cm³ ({fmt(report.silicone_volume_cm3, 0)} ml)</span></div>
						{:else}
							<div class="res-i"><span class="rl">Casting volume</span><span class="rv">{fmt(report.casting_volume_cm3)} cm³</span></div>
						{/if}
						{#if report.pieces >= 4}
							<div class="res-i"><span class="rl">Pieces</span><span class="rv">{report.pieces === 6 ? '4 wedges + 2 caps' : '4 wedges'}</span></div>
							<div class="res-i"><span class="rl">Piece vols</span><span class="rv">{fmt(report.mould_a_volume_cm3, 0)} / {fmt(report.mould_b_volume_cm3, 0)} / {fmt(report.mould_c_volume_cm3, 0)} / {fmt(report.mould_d_volume_cm3, 0)}{report.pieces === 6 ? ` / ${fmt(report.mould_e_volume_cm3, 0)} / ${fmt(report.mould_f_volume_cm3, 0)}` : ''} cm³</span></div>
						{:else}
							{#if report.mould_a_volume_cm3 > 0}
								<div class="res-i"><span class="rl">{report.mould_style === 'silicone_box' ? 'Top collar' : 'Mould A'}</span><span class="rv">{fmt(report.mould_a_volume_cm3)} cm³</span></div>
							{/if}
							{#if report.mould_b_volume_cm3 > 0}
								<div class="res-i"><span class="rl">{report.mould_style === 'silicone_box' ? (report.pieces === 1 ? 'Frame' : 'Base tray') : report.pieces === 1 ? 'Mould' : 'Mould B'}</span><span class="rv">{fmt(report.mould_b_volume_cm3)} cm³</span></div>
							{/if}
						{/if}
						<div class="res-i"><span class="rl">Parting</span><span class="rv">{report.parting_surface === 'follow' ? 'Silhouette' : 'Flat'} · Z {fmt(report.parting_z_mm, 2)}</span></div>
						{#if report.mould_style !== 'silicone_box'}
							<div class="res-i"><span class="rl">Undercut relief</span><span class="rv">{fmt(report.undercut_relief_cm3)} cm³</span></div>
						{/if}
						{#if report.refined_vertices > 0}
							<div class="res-i hl"><span class="rl">CAD-exact</span><span class="rv">{num(report.refined_vertices)} v · rms {fmt(report.refine_rms_mm, 3)}</span></div>
						{/if}
						<div class="res-i"><span class="rl">Grid</span><span class="rv">{report.grid ? report.grid.join(' × ') : '—'} @ {fmt(report.voxel_mm, 2)}</span></div>
						<div class="res-i"><span class="rl">Triangles</span><span class="rv">A {num(report.triangles_out_a)}{#if report.triangles_out_b > 0} · B {num(report.triangles_out_b)}{/if}</span></div>
					</div>

					{#if report.warnings && report.warnings.length}
						<div class="alert warn-a"><strong>Warnings</strong><ul>{#each report.warnings as w}<li>{w}</li>{/each}</ul></div>
					{/if}

					<button class="cta light" type="button" disabled={zipDownloaded || downloading} onclick={downloadZip}>{downloading ? 'Preparing ZIP…' : zipDownloaded ? 'Downloaded ✓' : 'Download mould (ZIP)'}</button>
					{#if errorMsg && !downloading && !zipDownloaded}
						<div class="alert err-a" style="margin-top:10px;"><strong>Download problem</strong><p>{errorMsg}{#if !mouldToken && !downloadUrl} Press <em>Generate mould</em> again to make a fresh package.{/if}</p></div>
					{/if}
					<p class="note">{zipDownloaded ? 'Saved to your device — the package is removed from the server once delivered.' : downloading ? 'Fetching the package…' : `The ZIP contains the ${report.mould_style === 'silicone_box' ? 'box STL' : 'mould STL'}${report.pieces > 1 ? 's' : ''} and report.json. It can be downloaded once.`}</p>
				</section>
			{/if}
		</div>
	</aside>

	<input type="file" accept=".stl,.step,.stp,.3mf" bind:this={fileInputEl} onchange={onPick} hidden />
</div>

<!-- ===================== SMALL-SCREEN / PORTRAIT GATE ===================== -->
<!-- Mould Studio needs a wide landscape canvas: a live 3D preview with the
     settings and results panels beside it. On phones (any orientation) and
     tablets held in portrait we hide the studio and show this note instead.
     This is a pure-CSS gate (media query in the stylesheet) so there is no load
     flash and it works without JavaScript. -->
<div class="gate">
	<div class="gate-card">
		<svg class="gate-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<rect x="3" y="4" width="18" height="13" rx="2" />
			<path d="M8 20h8M12 17v3" />
			<path d="M15.5 8.5l2 2-2 2M8.5 12.5l-2-2 2-2" />
		</svg>
		<h1>Open on a bigger screen</h1>
		<p>Mould Studio needs a wide, landscape canvas — a live 3D preview with all the controls and results beside it. That doesn't fit a phone or a tablet held upright.</p>
		<p class="gate-hint">On a tablet, just <strong>rotate to landscape</strong>. On a phone, please open this page on a <strong>desktop or a tablet in landscape</strong>.</p>
		<a class="gate-back" href="/">← Back to site</a>
	</div>
</div>

<style>
	.studio {
		--ink: #0f172a;
		--body: #475569;
		--muted: #64748b;
		--line: #e5e7eb;
		--panel: #ffffff;
		--soft: #f8fafc;
		--blue: #3b82f6;
		--blue-600: #2563eb;
		--violet: #8b5cf6;
		--cyan: #06b6d4;

		position: fixed;
		inset: 0;
		z-index: 60;
		display: grid;
		grid-template-columns: 320px 1fr 300px;
		/* header · full-width section navbar · content */
		grid-template-rows: 54px auto 1fr;
		background: var(--soft);
		color: var(--ink);
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 14px;
		overflow: hidden;
	}

	/* header */
	.bar {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 18px;
		padding: 0 16px;
		background: #fff;
		border-bottom: 1px solid var(--line);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		font-family: 'Space Grotesk', 'Inter', sans-serif;
		font-weight: 700;
		font-size: 15px;
		color: var(--ink);
		letter-spacing: -0.01em;
	}
	.brand b {
		font-weight: 500;
		color: var(--muted);
	}
	.bar-file {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: 6px;
	}
	.fchip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: var(--soft);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 5px 12px;
		max-width: 260px;
	}
	.fname {
		font-size: 12.5px;
		font-weight: 550;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.fsize {
		font-family: ui-monospace, Menlo, monospace;
		font-size: 10.5px;
		color: var(--muted);
		flex: none;
	}
	.mini {
		font-family: inherit;
		font-size: 12.5px;
		font-weight: 600;
		border: 1px solid var(--line);
		background: #fff;
		color: var(--ink);
		border-radius: 999px;
		padding: 6px 14px;
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.mini:hover {
		border-color: var(--violet);
	}
	.mini.solid {
		background: var(--ink);
		color: #fff;
		border-color: var(--ink);
	}
	.bar-link {
		margin-left: auto;
		font-size: 13px;
		color: var(--muted);
	}
	.bar-link:hover {
		color: var(--ink);
	}

	/* full-width section navbar (row 2, spans every column) */
	.tabs {
		grid-column: 1 / -1;
		grid-row: 2;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 16px;
		background: #fff;
		border-bottom: 1px solid var(--line);
		overflow-x: auto;
		scrollbar-width: thin;
	}

	/* left properties */
	.props {
		grid-row: 3;
		display: flex;
		flex-direction: column;
		background: #fff;
		border-right: 1px solid var(--line);
		min-height: 0;
	}
	.tab {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-family: inherit;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--muted);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 8px;
		padding: 6px 11px;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.14s;
	}
	.tab:hover {
		color: var(--ink);
		background: var(--soft);
	}
	.tab.on {
		color: #fff;
		background: var(--ink);
	}
	/* tab icons — inherit the button's text colour so they track hover/active */
	.tab-ico {
		display: inline-flex;
		flex: none;
		color: inherit;
	}
	.tab-ico svg {
		display: block;
	}
	.tab-lbl {
		line-height: 1;
	}
	.props-body {
		flex: 1;
		overflow-y: auto;
		padding: 18px 16px 40px;
		min-height: 0;
	}

	.grp + .grp {
		margin-top: 26px;
	}
	.grp h3 {
		font-family: 'Space Grotesk', 'Inter', sans-serif;
		font-size: 14px;
		font-weight: 650;
		margin: 0 0 16px;
	}

	/* dropzone (left) */
	.drop {
		border: 1.5px dashed var(--line);
		border-radius: 12px;
		padding: 26px 16px;
		text-align: center;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}
	.drop:hover,
	.drop.over {
		border-color: var(--violet);
		background: #faf9ff;
	}
	.drop-t {
		font-size: 13.5px;
		font-weight: 550;
		margin: 0 0 3px;
	}
	.drop-h {
		font-family: ui-monospace, Menlo, monospace;
		font-size: 10.5px;
		letter-spacing: 0.06em;
		color: var(--muted);
		margin: 0;
	}

	.file-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 12px 14px;
	}
	.file-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.file-name {
		font-size: 13px;
		font-weight: 550;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.file-size {
		font-family: ui-monospace, Menlo, monospace;
		font-size: 10.5px;
		color: var(--muted);
	}
	.ghost {
		border: 1px solid var(--line);
		background: transparent;
		border-radius: 999px;
		padding: 6px 13px;
		font-size: 12px;
		cursor: pointer;
		color: var(--ink);
		flex: none;
		font-family: inherit;
	}
	.ghost:hover {
		border-color: var(--ink);
	}

	/* fields */
	.field {
		margin-bottom: 18px;
	}
	.field:last-child {
		margin-bottom: 0;
	}
	.lbl {
		display: block;
		font-family: ui-monospace, Menlo, monospace;
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
		margin-bottom: 8px;
	}
	.hint {
		font-size: 12px;
		color: var(--muted);
		line-height: 1.5;
		margin: 8px 0 0;
	}
	.err {
		color: #dc2626;
		font-size: 12.5px;
		margin: 8px 0 0;
	}

	.segs {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.segs.narrow .seg {
		min-width: 44px;
		justify-content: center;
	}
	.seg {
		border: 1px solid var(--line);
		background: #fff;
		color: var(--body);
		border-radius: 8px;
		padding: 7px 12px;
		font-size: 12.5px;
		font-weight: 550;
		cursor: pointer;
		transition: all 0.14s;
		font-family: inherit;
	}
	.seg:hover {
		border-color: #cbd5e1;
		color: var(--ink);
	}
	.seg.on {
		background: var(--blue);
		border-color: var(--blue);
		color: #fff;
	}

	.g2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		margin-bottom: 16px;
	}
	.g3 {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 12px;
		margin-bottom: 14px;
	}
	.g2 .field,
	.g3 .field {
		margin-bottom: 0;
	}

	.num {
		display: flex;
		align-items: center;
		border: 1px solid var(--line);
		border-radius: 9px;
		overflow: hidden;
		background: #fff;
		transition: border-color 0.15s;
	}
	.num:focus-within {
		border-color: var(--blue);
	}
	.num input {
		border: none;
		outline: none;
		padding: 9px 11px;
		font-size: 13.5px;
		width: 100%;
		min-width: 0;
		font-family: inherit;
		color: var(--ink);
		background: transparent;
	}
	.num input::-webkit-outer-spin-button,
	.num input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.num input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.u {
		font-family: ui-monospace, Menlo, monospace;
		font-size: 10.5px;
		color: var(--muted);
		padding: 0 11px 0 4px;
		flex: none;
	}
	.inline {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 10px;
	}
	.inline label {
		font-size: 12.5px;
		color: var(--body);
		flex: none;
	}
	.inline .num {
		max-width: 150px;
	}

	.check {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--body);
		cursor: pointer;
		margin-top: 4px;
	}
	.check input {
		margin-top: 2px;
		width: 15px;
		height: 15px;
		accent-color: var(--blue);
		cursor: pointer;
		flex: none;
	}
	.check strong {
		color: var(--ink);
		font-weight: 600;
	}

	/* centre viewport */
	.viewport {
		grid-row: 3;
		position: relative;
		min-width: 0;
		min-height: 0;
		background: radial-gradient(ellipse at 30% 20%, #f8fafc 0%, #eef2f7 100%);
	}
	.vp-drop,
	.vp-empty {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		text-align: center;
		color: var(--muted);
	}
	.vp-drop {
		cursor: pointer;
		margin: 22px;
		inset: 0;
		border: 2px dashed #cbd5e1;
		border-radius: 20px;
		transition: border-color 0.15s, background 0.15s;
	}
	.vp-drop.over {
		border-color: var(--violet);
		background: rgba(139, 92, 246, 0.05);
	}
	.vp-icon {
		width: 40px;
		height: 40px;
		color: #94a3b8;
		margin-bottom: 8px;
	}
	.vp-t {
		font-family: 'Space Grotesk', 'Inter', sans-serif;
		font-size: 18px;
		font-weight: 600;
		color: var(--ink);
		margin: 0;
	}
	.vp-h {
		font-size: 13px;
		margin: 0;
	}
	.spinner {
		width: 26px;
		height: 26px;
		border: 3px solid #e2e8f0;
		border-top-color: var(--blue);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* right inspector */
	.inspector {
		grid-row: 3;
		background: #fff;
		border-left: 1px solid var(--line);
		min-height: 0;
		overflow: hidden;
	}
	.ins-scroll {
		height: 100%;
		overflow-y: auto;
		padding: 18px 16px 40px;
	}
	.rows {
		display: flex;
		flex-direction: column;
		margin-bottom: 8px;
	}
	.row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 7px 0;
		border-bottom: 1px solid #f1f5f9;
		font-size: 12.5px;
		color: var(--muted);
	}
	.row:last-child {
		border-bottom: none;
	}
	.row .v {
		color: var(--ink);
		font-weight: 550;
		text-align: right;
		max-width: 62%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cta {
		width: 100%;
		margin-top: 14px;
		background: var(--ink);
		color: #fff;
		border: none;
		border-radius: 10px;
		padding: 12px 20px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		transition: opacity 0.15s, transform 0.1s;
	}
	.cta:hover:not(:disabled) {
		opacity: 0.92;
	}
	.cta:active:not(:disabled) {
		transform: scale(0.99);
	}
	.cta:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.cta.light {
		background: var(--blue);
	}
	.note {
		font-size: 11.5px;
		color: var(--muted);
		line-height: 1.5;
		margin: 10px 0 0;
		text-align: center;
	}
	.pulse {
		animation: pulse 1.6s ease-in-out infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}

	.alert {
		border-radius: 9px;
		padding: 12px 14px;
		font-size: 12.5px;
		line-height: 1.5;
		margin-top: 14px;
	}
	.alert strong {
		display: block;
		margin-bottom: 4px;
	}
	.alert p {
		margin: 0;
	}
	.alert ul {
		margin: 6px 0 0;
		padding-left: 16px;
	}
	.err-a {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #991b1b;
	}
	.warn-a {
		background: #fffbeb;
		border: 1px solid #fde68a;
		color: #92400e;
	}

	.res {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px 14px;
	}
	.res-i {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.res-i.hl .rv {
		color: var(--violet);
	}
	.rl {
		font-family: ui-monospace, Menlo, monospace;
		font-size: 9.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.rv {
		font-size: 12.5px;
		font-weight: 550;
		color: var(--ink);
	}

	/* ======================================================================
	   TABLET-LANDSCAPE OPTIMISATION
	   Phones and tablet-portrait never reach these rules — they're caught by
	   the gate below (studio hidden, note shown). So the only "small" screens
	   that see the studio are tablets in LANDSCAPE (and small laptops). Keep
	   the full three-pane layout but tighten the side panels so the centre
	   viewport keeps usable width.
	   ====================================================================== */
	@media (min-width: 1000px) and (max-width: 1280px) {
		.studio {
			grid-template-columns: 250px 1fr 250px;
			font-size: 13px;
		}
		.bar {
			gap: 12px;
			padding: 0 12px;
		}
		.tabs {
			padding: 6px 12px;
		}
		.tab {
			padding: 6px 9px;
			font-size: 12px;
		}
		.props-body,
		.ins-scroll {
			padding: 14px 12px 34px;
		}
		.g2 {
			gap: 10px;
		}
		.res {
			gap: 10px 12px;
		}
	}
	/* Narrowest tablet landscape (e.g. 1024×768): pull the sidebars in further
	   so the preview stays comfortably wide. */
	@media (min-width: 1000px) and (max-width: 1120px) {
		.studio {
			grid-template-columns: 228px 1fr 232px;
		}
		.seg {
			padding: 6px 10px;
			font-size: 12px;
		}
		.fchip {
			max-width: 180px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner,
		.pulse {
			animation: none;
		}
	}

	/* ======================================================================
	   SMALL-SCREEN / PORTRAIT GATE
	   Hidden on desktop + tablet-landscape. Shown (and the studio hidden) on:
	     • any portrait orientation  → phones + tablets held upright
	     • width  ≤ 999px            → phones, very narrow windows
	     • height ≤ 559px            → phones in landscape (too short)
	   ====================================================================== */
	.gate {
		display: none;
		position: fixed;
		inset: 0;
		z-index: 70;
		align-items: center;
		justify-content: center;
		padding: 28px;
		background: radial-gradient(ellipse at 50% 28%, #f8fafc 0%, #eef2f7 100%);
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		color: #0f172a;
	}
	.gate-card {
		max-width: 430px;
		text-align: center;
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 18px;
		padding: 36px 26px;
		box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
	}
	.gate-ico {
		width: 54px;
		height: 54px;
		color: #8b5cf6;
		margin-bottom: 16px;
	}
	.gate-card h1 {
		font-family: 'Space Grotesk', 'Inter', sans-serif;
		font-size: 20px;
		font-weight: 700;
		margin: 0 0 10px;
	}
	.gate-card p {
		font-size: 14px;
		line-height: 1.6;
		color: #475569;
		margin: 0 0 12px;
	}
	.gate-hint {
		font-size: 13px;
		color: #64748b;
	}
	.gate-card strong {
		color: #0f172a;
		font-weight: 650;
	}
	.gate-back {
		display: inline-block;
		margin-top: 14px;
		font-size: 13px;
		font-weight: 600;
		color: #2563eb;
		text-decoration: none;
	}
	.gate-back:hover {
		text-decoration: underline;
	}

	@media (orientation: portrait), (max-width: 999.98px), (max-height: 559.98px) {
		.studio {
			display: none !important;
		}
		.gate {
			display: flex !important;
		}
	}
</style>