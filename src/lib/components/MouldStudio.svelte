<script>
	// ==========================================================================
	// MOULD STUDIO — full-screen design studio for the mould generator.
	//
	// MOULD SYSTEMS (params.mould_system):
	//   box            Two-part box — rigid block, two / four / six-part, open pour
	//   adaptive       Adapted box — shape-following rigid jacket for silicone
	//   tray           Tray box — one-piece open tray for flat-backed parts
	//   multipart      Multi-part silicone — jacket split on 2–3 planes
	//   core           Inner cavity — jacket + pull-out core (plug a bore / hollow a vessel)
	//   slip           Slip casting — plaster-mould jacket, spare + top trim
	//   direct_open    Direct mould · open base — rigid mould you cast straight into
	//   direct_funnel  Direct mould · top funnel — closed rigid mould + funnel + risers
	//   skin           Printed mould · skin — printed core + outer shell for latex/silicone skins
	//   fixture        Fixture — holder block with drop-in pocket
	//   shell          Protective shell — fitted clamshell case
	//
	// Every system previews live (MouldPreview + its worker). Generation posts
	// the same params to the backend; `mould_system` is new, and `mould_style`
	// / `silicone_type` / `mould_type` are still sent in the old shape for the
	// systems the current server already understands (box, adaptive, tray,
	// core). See SERVER_SYSTEMS.
	//
	// ACCESS FLOW (unchanged):
	//   • Generation REQUIRES login — every request goes through authFetch().
	//   • The plan is (re)checked on mount AFTER initAuth(), on tab focus, and
	//     after any 402; if the account is actually Pro the request is retried.
	//   • Premium options are locked in the UI for free accounts (all systems
	//     except the two-part box, four/six-part, Fine/Custom voxel, CAD-exact).
	//   • Free accounts get 1 mould/day; the backend returns 429.
	//
	// Param names still match the backend MouldParams serde contract exactly
	// (snake_case). Do not rename existing ones.
	// ==========================================================================
	import { onMount } from 'svelte';
	import { PUBLIC_API_BASE_URL } from '$env/static/public';
	import MouldPreview from '$lib/components/MouldPreview.svelte';
	// ADJUST the path if your auth store lives elsewhere.
	import { initAuth, authFetch, getValidAccessToken, fetchSubscriptionStatus } from '$lib/stores/auth.js';

	const API = PUBLIC_API_BASE_URL;
	const MAX_UPLOAD_MB = 200;
	const ACCEPT = ['.stl', '.step', '.stp', '.3mf'];

	// Systems the backend generates (mould_systems.rs + the block pipeline).
	// Keep in sync with the server if a system is ever disabled there.
	const SERVER_SYSTEMS = new Set(['box', 'adaptive', 'tray', 'multipart', 'core', 'slip', 'direct_open', 'direct_funnel', 'skin', 'fixture', 'shell']);

	// ---- access / subscription config --------------------------------------
	const LOGIN_PATH = '/login';
	const PRICING_PATH = '/pricing';
	const SUB_RECHECK_MS = 10_000;

	// ---- shared file state (hosted by the studio shell) --------------------
	let {
		file: fileProp = null,
		modelBuffer: bufferProp = null,
		active = true,
		onShared,
		onSwitch
	} = $props();

	let localFile = $state(null);
	let localBuffer = $state(null);
	let file = $derived(fileProp ?? localFile);
	let modelBuffer = $derived(bufferProp ?? localBuffer);
	function setShared(f, b) {
		localFile = f;
		localBuffer = b;
		onShared?.(f, b);
	}

	let fileError = $state('');
	// live estimate from the preview worker
	let previewStats = $state(null);
	let dragOver = $state(false);
	let fileInputEl;

	// ---- access state -------------------------------------------------------
	let loggedIn = $state(false);
	let isPremium = $state(false);
	let subChecked = $state(false);
	let subError = $state('');
	let showUpgrade = $state(false);
	let lastSubCheck = 0;

	function goLogin() {
		if (typeof window !== 'undefined') window.location.assign(LOGIN_PATH);
	}
	function goUpgrade() {
		if (typeof window !== 'undefined') window.location.assign(PRICING_PATH);
	}

	async function checkSubscription(force = false) {
		const now = Date.now();
		if (!force && now - lastSubCheck < SUB_RECHECK_MS) return;
		lastSubCheck = now;
		const s = await fetchSubscriptionStatus();
		if (s.error) {
			subError = s.error;
			loggedIn = s.loggedIn;
		} else {
			subError = '';
			loggedIn = s.loggedIn;
			isPremium = s.active;
		}
		subChecked = true;
	}

	// ---- mould systems --------------------------------------------------------
	const FAMILY = {
		box: 'block',
		adaptive: 'silicone',
		multipart: 'silicone',
		core: 'silicone',
		slip: 'silicone',
		tray: 'tray',
		direct_open: 'direct_open',
		direct_funnel: 'direct_funnel',
		skin: 'skin',
		fixture: 'fixture',
		shell: 'shell'
	};
	const SPLIT_X = { axis: 'x', offset_mm: 0, angle_deg: 0 };
	const SPLIT_Y = { axis: 'y', offset_mm: 0, angle_deg: 0 };
	const SPLIT_Z = { axis: 'z', offset_mm: 0, angle_deg: 0 };

	const SYSTEMS = [
		{
			id: 'box', group: 'Rigid', title: 'Two-part box', tags: ['Candles', 'Soap', 'Wax'], splits: [],
			hint: 'A solid rigid block split into halves (or four / six radial pieces). Cast plaster, wax or soap straight into it — no silicone needed.',
			svg: '<rect x="4" y="7" width="9" height="20" rx="1.5"/><rect x="19" y="7" width="9" height="20" rx="1.5"/>'
		},
		{
			id: 'adaptive', group: 'Silicone', title: 'Adapted box', tags: ['Figures', 'Resin', 'Detail'], splits: [SPLIT_X],
			hint: 'The everyday silicone system. A thin rigid jacket follows the master at an even gap, split into two, with a base plate, pour funnel, risers and bolt-on flange. Pour silicone into the gap, cure, peel off a reusable negative.',
			svg: '<path d="M16 5 C9 5 6 10 6 16 C6 23 10 27 16 27" fill="none" stroke-width="2.4"/><path d="M16 5 C23 5 26 10 26 16 C26 23 22 27 16 27" fill="none" stroke-width="2.4"/>'
		},
		{
			id: 'tray', group: 'Silicone', title: 'Tray box', tags: ['Reliefs', 'Coins', 'Tiles'], splits: [],
			hint: 'An open one-piece tray for flat-backed masters. The master nests in the base; silicone is poured over the top in a single pour.',
			svg: '<path d="M5 12 h22 v11 a2 2 0 0 1 -2 2 h-18 a2 2 0 0 1 -2 -2 z" fill="none" stroke-width="2.2"/><ellipse cx="16" cy="12" rx="11" ry="3"/>'
		},
		{
			id: 'multipart', group: 'Silicone', title: 'Multi-part silicone', tags: ['Busts', 'Complex', 'Undercuts'], splits: [SPLIT_X, SPLIT_Y],
			hint: 'An enclosed jacket cut on two or three planes you control, for forms that need defined parting lines. The silicone is cut on the same planes into keyed pieces (round natches), and every jacket piece gets flange keys and clamp holes.',
			svg: '<path d="M14 4a12 12 0 0 0-10 10h10z M18 4a12 12 0 0 1 10 10H18z M4 18a12 12 0 0 0 10 10V18z M28 18a12 12 0 0 1-10 10V18z" fill="none" stroke-width="2"/>'
		},
		{
			id: 'core', group: 'Silicone', title: 'Inner cavity', tags: ['Vases', 'Planters', 'Rings'], splits: [SPLIT_X],
			hint: 'For hollow casts and vessels. The jacket stays open at the mouth, and a shape-adapted, drafted core with a T-bar drops in and rests across the rim, so the cast comes out hollow at your wall thickness. Masters with a bore (rings, tubes) get the bore plugged instead. No manual core modelling.',
			svg: '<path d="M8 8 v14 a8 8 0 0 0 16 0 v-14" fill="none" stroke-width="2.2"/><ellipse cx="16" cy="8" rx="8" ry="2.6"/><circle cx="16" cy="15" r="4.5" fill="none" stroke-width="2"/>'
		},
		{
			id: 'slip', group: 'Ceramics', title: 'Slip casting', tags: ['Ceramics', 'Plaster', 'Slip'], splits: [SPLIT_X],
			hint: 'Builds the open-top case for pouring a plaster mould. The gap is the plaster wall; the master gets a shape-matched spare (pour reservoir) on top and an optional flat top trim. Pour one half at a time against the split — the plaster pieces come out keyed with natches.',
			svg: '<path d="M9 9h14l-2 16a3 3 0 0 1-3 2h-4a3 3 0 0 1-3-2z" fill="none" stroke-width="2"/><path d="M12 4h8v5h-8z" fill="none" stroke-width="2"/>'
		},
		{
			id: 'direct_open', group: 'Direct print', title: 'Direct · open base', tags: ['Resin', 'Wax', 'Plaster'], splits: [SPLIT_X],
			hint: 'A rigid printed mould you cast straight into — no silicone. The base is open for easy pouring and extraction, with a stable wing to stand it on.',
			svg: '<path d="M6 27V13a10 10 0 0 1 20 0v14" fill="none" stroke-width="2.4"/><path d="M11 27V14a5 5 0 0 1 10 0v13" fill="none" stroke-width="1.6"/>'
		},
		{
			id: 'direct_funnel', group: 'Direct print', title: 'Direct · top funnel', tags: ['Resin', 'Concrete', 'Jesmonite'], splits: [SPLIT_X],
			hint: 'A closed rigid printed mould with an integrated top funnel and risers at the high points for a controlled fill.',
			svg: '<path d="M6 17a10 9 0 0 0 20 0a10 9 0 0 0-20 0z" fill="none" stroke-width="2.2"/><path d="M11 3h10l-3 6h-4z" fill="none" stroke-width="2"/><line x1="16" y1="9" x2="16" y2="8" stroke-width="2"/>'
		},
		{
			id: 'skin', group: 'Direct print', title: 'Printed mould · skin', tags: ['Masks', 'Latex', 'Prosthetics'], splits: [],
			hint: 'Prints a core (your master on a base) and a matching outer shell. The even gap between them forms a flexible latex or silicone skin.',
			svg: '<path d="M8 6c5-2 11-2 16 0v9c0 7-4 12-8 12s-8-5-8-12z" fill="none" stroke-width="2.2"/><circle cx="12.5" cy="13" r="1.8"/><circle cx="19.5" cy="13" r="1.8"/>'
		},
		{
			id: 'fixture', group: 'Utility', title: 'Fixture', tags: ['Pad print', 'Painting', 'Engraving'], splits: [],
			hint: 'A holder that grips the part for pad printing, soldering, painting or engraving. The pocket is swept straight up so the part drops in and lifts out.',
			svg: '<rect x="3" y="17" width="26" height="9" rx="2" fill="none" stroke-width="2.2"/><path d="M10 17a6 6 0 0 1 12 0" fill="none" stroke-width="2"/>'
		},
		{
			id: 'shell', group: 'Utility', title: 'Protective shell', tags: ['Shipping', 'Storage', 'Gifts'], splits: [SPLIT_X],
			hint: 'A fitted clamshell case that keeps delicate models safe in shipping and storage, with keyed halves.',
			svg: '<rect x="5" y="4" width="22" height="24" rx="6" fill="none" stroke-width="2.2"/><line x1="5" y1="16" x2="27" y2="16" stroke-width="2"/>'
		}
	];
	const SYSTEM_BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

	// ---- which options are Pro-only (mirrors backend premium_features_used) --
	const PREMIUM_SYSTEMS = new Set(SYSTEMS.filter((s) => s.id !== 'box').map((s) => s.id));
	const PREMIUM_MOULD_TYPES = new Set(['four_part', 'six_part']);
	const PREMIUM_RESOLUTIONS = new Set(['fine', 'custom']);
	const PREMIUM_REFINEMENTS = new Set(['cad_exact']);

	function lockedCard(id) { return subChecked && !isPremium && PREMIUM_SYSTEMS.has(id); }
	function lockedType(v) { return subChecked && !isPremium && PREMIUM_MOULD_TYPES.has(v); }
	function lockedRes(v) { return subChecked && !isPremium && PREMIUM_RESOLUTIONS.has(v); }
	function lockedRefine(v) { return subChecked && !isPremium && PREMIUM_REFINEMENTS.has(v); }

	// ---- params (existing names MUST match backend MouldParams serde) -------
	let params = $state({
		mould_system: 'box',
		splits: [],

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

		// mating flange along every split (all split systems)
		flange_thickness_mm: 5,
		flange_reach_mm: 10,

		// silicone jacket / tray
		silicone_gap_mm: 12,
		box_wall_mm: 3,
		master_seat: true,
		master_clearance_mm: 0.3,
		base_flange_mm: 8,
		silicone_type: 'box',
		base_style: 'rect',
		base_bolts: true,
		bolt_diameter_mm: 3.4,
		master_seal: true,
		base_key_count: 4,
		base_key_diameter_mm: 6,

		// master prep
		foundation_mm: 0,
		air_trap_detect: true,
		air_trap_pillars: false,
		pillar_diameter_mm: 3,

		// pour system (jacket, direct funnel, skin)
		pour_diameter_mm: 14,
		pour_top_diameter_mm: 24,
		riser_count: 2,
		riser_diameter_mm: 4,

		// split keys + clamps (non-block systems)
		split_key_count: 4,
		clamp_holes: true,
		clamp_hole_diameter_mm: 3.4,

		// inner cavity
		core_mode: 'auto',
		cast_wall_mm: 3,
		core_draft_deg: 1.5,

		// slip casting
		plaster_thickness_mm: 25,
		slip_spare_diameter_mm: 30,
		slip_spare_height_mm: 25,
		top_trim_mm: 0,

		// direct print
		direct_clearance_mm: 0.3,
		direct_wall_mm: 3,

		// skin
		skin_thickness_mm: 3,

		// fixture
		fixture_depth_pct: 40,
		fixture_margin_mm: 8,
		fixture_base_mm: 4,
		fixture_clearance_mm: 0.4,

		// protective shell
		shell_clearance_mm: 1.5,
		shell_wall_mm: 3,

		// branding + mesh
		brand_text: '',
		brand_mode: 'engrave',
		brand_size_mm: 6,
		brand_volume_label: false,
		mesh_repair: true,

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
		base_style: [
			{ v: 'rect', l: 'Rectangular' },
			{ v: 'contour', l: 'Follows outline' }
		],
		core_mode: [
			{ v: 'auto', l: 'Auto' },
			{ v: 'plug', l: 'Plug a bore' },
			{ v: 'hollow', l: 'Hollow vessel' }
		],
		brand_mode: [
			{ v: 'engrave', l: 'Engraved' },
			{ v: 'raise', l: 'Raised' }
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
	let sys = $derived(params.mould_system);
	let fam = $derived(FAMILY[params.mould_system] || 'block');
	let sysInfo = $derived(SYSTEM_BY_ID[params.mould_system] || SYSTEMS[0]);
	let isBlock = $derived(fam === 'block');
	let isTwoPart = $derived(params.mould_type === 'two_part');
	let isFourPart = $derived(params.mould_type === 'four_part');
	let isSixPart = $derived(params.mould_type === 'six_part');
	let isRadial = $derived(isBlock && (isFourPart || isSixPart));
	let isOnePart = $derived(params.mould_type === 'one_part');
	let splitCapable = $derived(!isBlock && fam !== 'fixture');
	let hasSplits = $derived(splitCapable && params.splits.length > 0);
	let coreHollow = $derived(
		params.mould_system === 'core' &&
			(params.core_mode === 'hollow' || (params.core_mode === 'auto' && previewStats?.core_mode === 'hollow'))
	);
	let hasPour = $derived(
		fam === 'skin' || fam === 'direct_funnel' || (fam === 'silicone' && params.mould_system !== 'slip' && !coreHollow)
	);
	let hasBase = $derived(fam === 'silicone' || fam === 'tray');
	let pourFromTop = $derived(fam === 'silicone' || fam === 'tray' || fam === 'skin');
	let showPartingSurface = $derived(isBlock && isTwoPart);
	let showOffset = $derived(params.parting_mode === 'offset');
	let serverReady = $derived(SERVER_SYSTEMS.has(params.mould_system));

	function selectSystem(s) {
		if (lockedCard(s.id)) { goUpgrade(); return; }
		if (params.mould_system === s.id) return;
		params.mould_system = s.id;
		params.splits = s.splits.map((r) => ({ ...r }));
		// backend-compat fields for the systems the current server knows
		if (s.id === 'box') { params.mould_style = 'block'; if (!['two_part', 'four_part', 'six_part', 'one_part'].includes(params.mould_type)) params.mould_type = 'two_part'; }
		else if (s.id === 'adaptive') { params.mould_style = 'silicone_box'; params.silicone_type = 'box'; params.mould_type = 'two_part'; }
		else if (s.id === 'tray') { params.mould_style = 'silicone_box'; params.silicone_type = 'box'; params.mould_type = 'one_part'; }
		else if (s.id === 'core') { params.mould_style = 'silicone_box'; params.silicone_type = 'core'; params.mould_type = 'two_part'; }
		else { params.mould_style = s.id; params.mould_type = s.splits.length ? 'two_part' : 'one_part'; }
		if (s.id === 'core') params.core_mode = 'auto';
		params.base_style = s.id === 'tray' ? 'contour' : 'rect';
		if (s.id === 'slip' && params.top_trim_mm < 0) params.top_trim_mm = 0;
	}

	// ---- split plane editor ---------------------------------------------------
	function addSplit() {
		if (params.splits.length >= 3) return;
		const used = new Set(params.splits.map((r) => r.axis));
		const axis = ['x', 'y', 'z'].find((a) => !used.has(a)) || 'x';
		params.splits = [...params.splits, { axis, offset_mm: 0, angle_deg: 0 }];
	}
	function removeSplit(i) {
		params.splits = params.splits.filter((_, k) => k !== i);
	}

	// gated setters for the premium segmented controls
	function setMouldType(v) { if (lockedType(v)) { goUpgrade(); return; } params.mould_type = v; }
	function setResolution(v) { if (lockedRes(v)) { goUpgrade(); return; } params.resolution = v; }
	function setRefinement(v) { if (lockedRefine(v)) { goUpgrade(); return; } params.surface_refinement = v; }

	let showCustomVoxel = $derived(params.resolution === 'custom');
	let showSprue = $derived(params.gate_type !== 'none' && !isOnePart);
	let showFunnel = $derived(params.sprue_type === 'funnel' && showSprue);
	let showTaper = $derived(params.sprue_type === 'tapered' && showSprue);
	let showRunner = $derived(params.gate_type === 'side' && isTwoPart);
	let showValves = $derived(params.valve_type !== 'none' && !isOnePart);
	let effectiveVoxel = $derived(
		params.resolution === 'draft' ? 0.8
		: params.resolution === 'standard' ? 0.5
		: params.resolution === 'fine' ? 0.3
		: Number(params.voxel_size_mm) || 0.5
	);
	let canSubmit = $derived(!!file && phase !== 'uploading');

	// ---- tabs ---------------------------------------------------------------
	const TABS = [
		{ id: 'model', label: 'Model' },
		{ id: 'mould', label: 'System' },
		{ id: 'shell', label: 'Shell' },
		{ id: 'cavity', label: 'Cavity' },
		{ id: 'feed', label: 'Feed' },
		{ id: 'pour', label: 'Pour' },
		{ id: 'vents', label: 'Vents' },
		{ id: 'keys', label: 'Keys' },
		{ id: 'master', label: 'Master' },
		{ id: 'extras', label: 'Extras' },
		{ id: 'quality', label: 'Quality' }
	];
	let shellTabLabel = $derived(
		fam === 'silicone' ? 'Jacket'
		: fam === 'tray' ? 'Tray'
		: fam === 'fixture' ? 'Fixture'
		: fam === 'shell' ? 'Case'
		: 'Shell'
	);
	let tab = $state('model');
	let visibleTabs = $derived(
		TABS.filter((t) => {
			switch (t.id) {
				case 'model': case 'mould': case 'extras': case 'quality': return true;
				case 'shell': return !isBlock;
				case 'cavity': return isBlock;
				case 'feed': case 'vents': return isBlock && !isOnePart;
				case 'pour': return hasPour;
				case 'keys': return isBlock ? !isOnePart : hasSplits;
				case 'master': return !isBlock && fam !== 'fixture' && fam !== 'shell';
				default: return true;
			}
		}).map((t) => (t.id === 'shell' ? { ...t, label: shellTabLabel } : t))
	);
	$effect(() => {
		if (!visibleTabs.some((t) => t.id === tab)) tab = 'mould';
	});


	// ---- request state ------------------------------------------------------
	let phase = $state('idle');
	let errorMsg = $state('');
	let report = $state(null);
	let mouldToken = $state('');
	let downloadUrl = $state('');
	let zipDownloaded = $state(false);
	let downloading = $state(false);
	let elapsed = $state(0);
	let elapsedTimer = null;
	let freeUsedToday = $state(false);

	onMount(() => {
		let alive = true;
		(async () => {
			await initAuth();
			if (alive) await checkSubscription(true);
		})();

		const onFocus = () => { checkSubscription(false); };
		const onVisible = () => { if (document.visibilityState === 'visible') checkSubscription(false); };
		window.addEventListener('focus', onFocus);
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			alive = false;
			window.removeEventListener('focus', onFocus);
			document.removeEventListener('visibilitychange', onVisible);
			if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
		};
	});

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
		setShared(f, null);
		f.arrayBuffer()
			.then((b) => { if (file === f) setShared(f, b); })
			.catch(() => {});
		resetResult();
	}

	function resetResult() {
		report = null;
		mouldToken = '';
		downloadUrl = '';
		zipDownloaded = false;
		downloading = false;
		showUpgrade = false;
		phase = 'idle';
		errorMsg = '';
	}
	function clearFile() {
		setShared(null, null);
		fileError = '';
		previewStats = null;
		resetResult();
	}
	function onPick(e) {
		if (e.target.files && e.target.files.length) acceptFile(e.target.files[0]);
		e.target.value = '';
	}
	function onDrop(e) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) acceptFile(e.dataTransfer.files[0]);
	}
	function onVoxelBlur() {
		let v = Number(params.voxel_size_mm);
		if (!isFinite(v)) v = 0.3;
		params.voxel_size_mm = Math.min(2, Math.max(0.15, v));
	}

	// Mirrors the backend MouldParams::clamp() so the UI never shows a value the
	// server would silently rewrite.
	function clampParams(p) {
		const c = JSON.parse(JSON.stringify(p));
		const n = (v, def) => {
			const x = Number(v);
			return isFinite(x) ? x : def;
		};
		const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
		const bool = (v) => !!v;

		if (!FAMILY[c.mould_system]) c.mould_system = 'box';
		if (!['auto', 'axis', 'diagonal'].includes(c.radial_orientation)) c.radial_orientation = 'auto';
		c.parting_offset_mm = clamp(n(c.parting_offset_mm, 0), -500, 500);
		c.wall_thickness_mm = clamp(n(c.wall_thickness_mm, 8), 3, 40);
		c.cavity_clearance_mm = clamp(n(c.cavity_clearance_mm, 0.15), 0, 2);
		c.flange_thickness_mm = clamp(n(c.flange_thickness_mm, 5), 2, 20);
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

		// silicone jacket / tray / base
		c.silicone_gap_mm = clamp(n(c.silicone_gap_mm, 12), 3, 50);
		c.box_wall_mm = clamp(n(c.box_wall_mm, 3), 1.5, 12);
		c.master_seat = bool(c.master_seat);
		c.master_clearance_mm = clamp(n(c.master_clearance_mm, 0.3), 0, 2);
		c.base_flange_mm = clamp(n(c.base_flange_mm, 8), 0, 30);
		c.base_style = c.base_style === 'contour' ? 'contour' : 'rect';
		c.base_bolts = bool(c.base_bolts);
		c.bolt_diameter_mm = clamp(n(c.bolt_diameter_mm, 3.4), 2, 8);
		c.master_seal = bool(c.master_seal);
		c.base_key_count = clamp(Math.round(n(c.base_key_count, 4)), 0, 8);
		c.base_key_diameter_mm = clamp(n(c.base_key_diameter_mm, 6), 2, 16);
		if (c.silicone_type !== 'core') c.silicone_type = 'box';

		// master prep
		c.foundation_mm = clamp(n(c.foundation_mm, 0), 0, 20);
		c.air_trap_detect = bool(c.air_trap_detect);
		c.air_trap_pillars = bool(c.air_trap_pillars) && c.air_trap_detect;
		c.pillar_diameter_mm = clamp(n(c.pillar_diameter_mm, 3), 1.5, 8);

		// pour
		c.pour_diameter_mm = clamp(n(c.pour_diameter_mm, 14), 4, 40);
		c.pour_top_diameter_mm = clamp(n(c.pour_top_diameter_mm, 24), c.pour_diameter_mm, 70);
		c.riser_count = clamp(Math.round(n(c.riser_count, 2)), 0, 6);
		c.riser_diameter_mm = clamp(n(c.riser_diameter_mm, 4), 1.5, 12);

		// split keys / clamps
		c.split_key_count = clamp(Math.round(n(c.split_key_count, 4)), 0, 8);
		c.clamp_holes = bool(c.clamp_holes);
		c.clamp_hole_diameter_mm = clamp(n(c.clamp_hole_diameter_mm, 3.4), 2, 8);
		if (!['dome', 'cone', 'none'].includes(c.key_shape)) c.key_shape = 'dome';

		// splits
		c.splits = (Array.isArray(c.splits) ? c.splits : []).slice(0, 3).map((r) => ({
			axis: ['x', 'y', 'z'].includes(r.axis) ? r.axis : 'x',
			offset_mm: clamp(n(r.offset_mm, 0), -500, 500),
			angle_deg: clamp(n(r.angle_deg, 0), -89, 89)
		}));
		if (c.mould_system === 'fixture' || c.mould_system === 'box') c.splits = [];

		// inner cavity / slip
		if (!['auto', 'plug', 'hollow'].includes(c.core_mode)) c.core_mode = 'auto';
		c.cast_wall_mm = clamp(n(c.cast_wall_mm, 3), 1, 20);
		c.core_draft_deg = clamp(n(c.core_draft_deg, 1.5), 0, 10);
		c.plaster_thickness_mm = clamp(n(c.plaster_thickness_mm, 25), 10, 60);
		c.slip_spare_diameter_mm = clamp(n(c.slip_spare_diameter_mm, 30), 0, 120);
		c.slip_spare_height_mm = clamp(n(c.slip_spare_height_mm, 25), 0, 80);
		c.top_trim_mm = clamp(n(c.top_trim_mm, 0), 0, 200);

		// direct / skin / fixture / shell
		c.direct_clearance_mm = clamp(n(c.direct_clearance_mm, 0.3), 0, 2);
		c.direct_wall_mm = clamp(n(c.direct_wall_mm, 3), 1.5, 15);
		c.skin_thickness_mm = clamp(n(c.skin_thickness_mm, 3), 0.8, 15);
		c.fixture_depth_pct = clamp(n(c.fixture_depth_pct, 40), 10, 90);
		c.fixture_margin_mm = clamp(n(c.fixture_margin_mm, 8), 3, 40);
		c.fixture_base_mm = clamp(n(c.fixture_base_mm, 4), 2, 30);
		c.fixture_clearance_mm = clamp(n(c.fixture_clearance_mm, 0.4), 0, 3);
		c.shell_clearance_mm = clamp(n(c.shell_clearance_mm, 1.5), 0.2, 10);
		c.shell_wall_mm = clamp(n(c.shell_wall_mm, 3), 1.2, 12);

		// branding
		c.brand_text = String(c.brand_text || '').slice(0, 40);
		c.brand_mode = c.brand_mode === 'raise' ? 'raise' : 'engrave';
		c.brand_size_mm = clamp(n(c.brand_size_mm, 6), 3, 30);
		c.brand_volume_label = bool(c.brand_volume_label);
		c.mesh_repair = bool(c.mesh_repair);

		// backend-compat mirror of the first split
		if (c.splits.length) {
			c.parting_axis = c.splits[0].axis;
			c.parting_mode = c.splits[0].offset_mm ? 'offset' : 'center';
			c.parting_offset_mm = c.splits[0].offset_mm;
		}
		if (c.mould_system === 'box') {
			c.mould_style = 'block';
		} else if (c.mould_system === 'adaptive' || c.mould_system === 'core') {
			c.mould_style = 'silicone_box';
			c.silicone_type = c.mould_system === 'core' ? 'core' : 'box';
			c.mould_type = 'two_part';
			c.parting_surface = 'flat';
		} else if (c.mould_system === 'tray') {
			c.mould_style = 'silicone_box';
			c.silicone_type = 'box';
			c.mould_type = 'one_part';
			c.parting_surface = 'flat';
		} else {
			c.mould_style = c.mould_system;
			c.mould_type = c.splits.length ? 'two_part' : 'one_part';
			c.parting_surface = 'flat';
		}
		return c;
	}

	// ---- submit -------------------------------------------------------------
	async function generate(retried = false) {
		if (!canSubmit) return;

		const token = await getValidAccessToken();
		if (!token) {
			showUpgrade = false;
			loggedIn = false;
			errorMsg = 'Please sign in to generate a mould.';
			phase = 'error';
			setTimeout(goLogin, 900);
			return;
		}

		phase = 'uploading';
		errorMsg = '';
		showUpgrade = false;
		report = null;
		mouldToken = '';
		downloadUrl = '';
		zipDownloaded = false;
		downloading = false;
		elapsed = 0;
		elapsedTimer = setInterval(() => (elapsed += 1), 1000);

		let retryAsPro = false;

		try {
			const clean = clampParams(params);
			const fd = new FormData();
			fd.append('params', JSON.stringify(clean));
			fd.append('file', file, file.name);

			const res = await authFetch(`${API}/calc/mould/v2/generate?source=mould_studio`, {
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

			if (res.status === 401) {
				loggedIn = false;
				errorMsg = 'Your session has expired — please sign in again.';
				phase = 'error';
				setTimeout(goLogin, 1000);
				return;
			}
			if (res.status === 402) {
				await checkSubscription(true);
				if (isPremium && !retried) {
					retryAsPro = true;
					return;
				}
				const locked = (body && body.locked_features) || [];
				errorMsg = locked.length
					? `These options need Akritio Pro: ${locked.join(', ')}.`
					: (body && body.message) || 'That configuration needs Akritio Pro.';
				showUpgrade = true;
				phase = 'error';
				return;
			}
			if (res.status === 429) {
				await checkSubscription(true);
				if (isPremium && !retried) {
					retryAsPro = true;
					return;
				}
				errorMsg =
					(body && body.message) ||
					'The free plan includes 1 mould per day. Upgrade to Akritio Pro for unlimited moulds.';
				showUpgrade = true;
				phase = 'error';
				return;
			}

			const okStatus = body && (body.status === 'ok' || body.status === 'success');
			if (!res.ok || !body || !okStatus) {
				let msg = (body && (body.message || body.error)) || rawText || `Generation failed (HTTP ${res.status}).`;
				if (!serverReady && (res.status === 400 || res.status === 422))
					msg += ` — the “${sysInfo.title}” system needs the updated generator backend; the preview above is exact to your settings.`;
				throw new Error(msg);
			}

			report = body.report || null;
			mouldToken = body.token || '';
			downloadUrl = body.download_url || '';
			phase = 'done';
			if (!isPremium) freeUsedToday = true;
		} catch (err) {
			errorMsg = err && err.message ? err.message : 'The mould could not be generated. Try again.';
			phase = 'error';
		} finally {
			if (elapsedTimer) {
				clearInterval(elapsedTimer);
				elapsedTimer = null;
			}
			if (retryAsPro) {
				phase = 'idle';
				setTimeout(() => generate(true), 0);
			}
		}
	}

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
			const res = await authFetch(target, { method: 'GET' });
			const ct = res.headers.get('content-type') || '';
			if (!res.ok || ct.includes('application/json') || ct.includes('text/')) {
				let msg = `Download failed (HTTP ${res.status}).`;
				let code = '';
				try {
					const j = await res.json();
					msg = j.message || j.error || msg;
					code = j.code || '';
				} catch (_) {}
				if (code === 'DOWNLOAD_EXPIRED' || code === 'DOWNLOAD_EMPTY') {
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
			const base = (raw || 'model').replace(/[^\w.-]+/g, '_');
			a.download = `${base}_${params.mould_system}_mould.zip`;
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
		!isBlock
			? sysInfo.title
			: params.mould_type === 'two_part' ? 'Two-part box'
			: params.mould_type === 'four_part' ? 'Four-part radial'
			: params.mould_type === 'six_part' ? 'Six-part radial'
			: 'Open pour block'
	);
	let splitLabel = $derived(
		params.splits.length
			? params.splits.map((r) => `${r.axis.toUpperCase()}${r.offset_mm ? (r.offset_mm > 0 ? '+' : '') + r.offset_mm : ''}${r.angle_deg ? ' ∠' + r.angle_deg + '°' : ''}`).join(' · ')
			: 'none (one piece)'
	);
	let fillName = $derived(
		sys === 'slip' ? 'Plaster needed' : fam === 'direct_open' || fam === 'direct_funnel' ? 'Casting volume' : fam === 'skin' ? 'Skin material' : 'Silicone needed'
	);
	let piecesText = $derived(
		previewStats
			? `${previewStats.pieces} ${fam === 'silicone' ? 'jacket' : 'mould'} piece${previewStats.pieces === 1 ? '' : 's'}${previewStats.has_core ? ' + core' : ''}`
			: '—'
	);
</script>

<svelte:head>
	<title>Mould Studio — design a print-ready mould</title>
	<meta name="description" content="Interactive studio for turning a 3D model into a print-ready mould system — silicone jackets, trays, cores, slip-casting cases, direct-print moulds, skins, fixtures and protective shells — with a live 3D preview." />
	<meta name="robots" content="noindex" />
</svelte:head>

<!-- ===================== TAB ICONS (second navbar) ===================== -->
{#snippet tabIcon(id)}
	{#if id === 'model'}
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M12 2.5 20.5 7.25 20.5 16.75 12 21.5 3.5 16.75 3.5 7.25Z" />
			<path d="M12 12V2.5M12 12 3.5 7.25M12 12 20.5 7.25" />
		</svg>
	{:else if id === 'mould'}
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<line x1="12" y1="2.5" x2="12" y2="21.5" stroke-dasharray="2.4 2.4" />
			<path d="M7.8 18.5A6.5 7.5 0 0 1 7.8 5.5" />
			<path d="M16.2 5.5A6.5 7.5 0 0 1 16.2 18.5" />
		</svg>
	{:else if id === 'shell'}
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M4 6v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6" />
			<path d="M2.5 6h19" />
			<rect x="9" y="11" width="6" height="6" rx="1" />
		</svg>
	{:else if id === 'cavity'}
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<rect x="3" y="3" width="18" height="18" rx="4" />
			<rect x="7.5" y="7.5" width="9" height="9" rx="2.5" />
		</svg>
	{:else if id === 'feed' || id === 'pour'}
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M3 5h18l-7 8v6l-4-2.2V13z" />
		</svg>
	{:else if id === 'vents'}
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M3 8h12a3 3 0 1 0-3-3" />
			<path d="M3 12h16a3 3 0 1 1-3 3" />
			<path d="M3 16h9a2.6 2.6 0 1 1-2.6 2.6" />
		</svg>
	{:else if id === 'keys'}
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<circle cx="7" cy="12" r="3.4" />
			<circle cx="17" cy="12" r="3.4" />
			<line x1="10.4" y1="12" x2="13.6" y2="12" stroke-dasharray="1.5 1.8" />
		</svg>
	{:else if id === 'master'}
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<circle cx="12" cy="7" r="3.5" />
			<path d="M7 20c0-4 2.2-7 5-7s5 3 5 7" />
			<path d="M4 20.5h16" />
		</svg>
	{:else if id === 'extras'}
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M3 12V4h8l10 10-8 8z" />
			<circle cx="7.5" cy="8.5" r="1.4" />
		</svg>
	{:else if id === 'quality'}
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<circle cx="12" cy="12" r="8" />
			<circle cx="12" cy="12" r="3.2" />
			<path d="M12 1.5V5M12 19v3.5M1.5 12H5M19 12h3.5" />
		</svg>
	{/if}
{/snippet}

{#snippet proTag()}<span class="pro-tag">PRO</span>{/snippet}

{#snippet numField(id, label, key, step, min, max, unit)}
	<div class="field">
		<label class="lbl" for={id}>{label}</label>
		<div class="num"><input {id} type="number" {step} {min} {max} bind:value={params[key]} />{#if unit}<span class="u">{unit}</span>{/if}</div>
	</div>
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

		<div class="bar-account">
			{#if !subChecked}
				<!-- status loading -->
			{:else if !loggedIn}
				<a class="mini" href={LOGIN_PATH}>Sign in</a>
			{:else if isPremium}
				<span class="plan-chip pro">Pro</span>
			{:else if subError}
				<span class="plan-chip free" title={subError}>Plan unknown</span>
				<button class="mini" type="button" onclick={() => checkSubscription(true)}>Retry</button>
			{:else}
				<span class="plan-chip free">Free · 1/day</span>
				<button class="mini" type="button" onclick={() => checkSubscription(true)} title="Already paid? Re-check your plan">Refresh plan</button>
				<a class="mini solid violet" href={PRICING_PATH}>Upgrade</a>
			{/if}
		</div>

		<a class="bar-link" href="/">← Back to site</a>
	</header>

	<!-- ===================== SECOND NAVBAR: SECTION TABS ===================== -->
	<nav class="tabs">
		{#each visibleTabs as t (t.id)}
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
							ondragover={(e) => { e.preventDefault(); dragOver = true; }}
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
					<p class="hint">The mesh should be watertight so the tool can define an inside. Orient the model the way it should stand in the mould — the preview uses +Z as up.</p>
					<label class="check" style="margin-top:14px;">
						<input type="checkbox" bind:checked={params.mesh_repair} />
						<span><strong>Repair mesh</strong> — close small holes, fix flipped faces and simplify dense meshes before building the mould.</span>
					</label>
					{#if subChecked && !loggedIn}
						<p class="hint" style="margin-top:12px;">You'll need to <a href={LOGIN_PATH} style="color:#2563eb;font-weight:600;">sign in</a> to generate — it's free, one mould per day.</p>
					{/if}
				</section>
			{/if}

			<!-- SYSTEM -->
			{#if tab === 'mould'}
				<section class="grp">
					<h3>Mould system</h3>
					<div class="field">
						<div class="mcards">
							{#each SYSTEMS as c (c.id)}
								<button type="button" class="mcard {sys === c.id ? 'on' : ''} {lockedCard(c.id) ? 'locked' : ''}" onclick={() => selectSystem(c)}>
									{#if lockedCard(c.id)}{@render proTag()}{/if}
									<span class="mcard-grp">{c.group}</span>
									<svg class="mcard-ic" viewBox="0 0 32 32" aria-hidden="true">{@html c.svg}</svg>
									<span class="mcard-ti">{c.title}</span>
									<span class="mcard-tags">{#each c.tags as t}<em>{t}</em>{/each}</span>
								</button>
							{/each}
						</div>
						<p class="hint">{sysInfo.hint}</p>
						{#if !serverReady}
							<p class="hint soon">Preview is exact to your settings. Server generation for this system rolls out with the next backend update.</p>
						{/if}
					</div>

					<!-- block-only controls -->
					{#if isBlock}
						<div class="field">
							<span class="lbl">Block pieces</span>
							<div class="segs">
								{#each seg.mould_type as o}
									<button type="button" class="seg {params.mould_type === o.v ? 'on' : ''} {lockedType(o.v) ? 'locked' : ''}" onclick={() => setMouldType(o.v)}>
										{o.l}{#if lockedType(o.v)}{@render proTag()}{/if}
									</button>
								{/each}
							</div>
							<p class="hint">Two-part splits on a plane. Four-part adds sideways wedges for side undercuts; six-part adds top and bottom caps. Open pour is a single open-top block.</p>
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
							<span class="lbl">Pull axis</span>
							<div class="segs narrow">
								{#each seg.parting_axis as o}
									<button type="button" class="seg {params.parting_axis === o.v ? 'on' : ''}" onclick={() => (params.parting_axis = o.v)}>{o.l}</button>
								{/each}
							</div>
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
					{/if}

					<!-- split plane editor (every split-capable system) -->
					{#if splitCapable}
						<div class="field">
							<span class="lbl">Split planes</span>
							{#if !params.splits.length}
								<p class="hint" style="margin-top:0;">No splits — the {shellTabLabel.toLowerCase()} is one piece{fam === 'skin' ? ' that lifts straight off the core' : ''}.</p>
							{/if}
							{#each params.splits as r, i (i)}
								<div class="split-row">
									<div class="split-head">
										<span class="split-n">Plane {i + 1}</span>
										<div class="segs narrow">
											{#each seg.parting_axis as o}
												<button type="button" class="seg sm {r.axis === o.v ? 'on' : ''}" onclick={() => (r.axis = o.v)}>{o.l}</button>
											{/each}
										</div>
										<button type="button" class="x-btn" onclick={() => removeSplit(i)} aria-label="Remove split plane {i + 1}">×</button>
									</div>
									<div class="g2 tight">
										<div class="field">
											<label class="lbl" for="soff{i}">Offset</label>
											<div class="num"><input id="soff{i}" type="number" step="0.5" min="-500" max="500" bind:value={r.offset_mm} /><span class="u">mm</span></div>
										</div>
										<div class="field">
											<label class="lbl" for="sang{i}">{r.axis === 'z' ? 'Tilt' : 'Rotate'}</label>
											<div class="num"><input id="sang{i}" type="number" step="5" min="-89" max="89" bind:value={r.angle_deg} /><span class="u">°</span></div>
										</div>
									</div>
								</div>
							{/each}
							{#if params.splits.length < 3}
								<button type="button" class="add-btn" onclick={addSplit}>+ Add split plane</button>
							{/if}
							<p class="hint">
								X / Y planes give vertical clamshells that pull apart sideways; Z gives a horizontal lid. Offset slides the plane from the part centre; rotate turns an X / Y plane around the vertical axis, tilt leans a Z plane. Each plane gets a mating flange{params.key_shape !== 'none' ? ' with keys' : ''}{params.clamp_holes ? ' and clamp holes' : ''}.
							</p>
						</div>
					{/if}
				</section>
			{/if}

			<!-- SHELL (per system) -->
			{#if tab === 'shell' && !isBlock}
				<section class="grp">
					{#if fam === 'silicone'}
						<h3>{sys === 'slip' ? 'Plaster case' : 'Silicone jacket'}</h3>
						<div class="g2">
							{#if sys === 'slip'}
								{@render numField('plt', 'Plaster wall', 'plaster_thickness_mm', 1, 10, 60, 'mm')}
							{:else}
								{@render numField('sgap', 'Silicone gap', 'silicone_gap_mm', 1, 3, 50, 'mm')}
							{/if}
							{@render numField('bwall', 'Jacket wall', 'box_wall_mm', 0.5, 1.5, 12, 'mm')}
						</div>
						<p class="hint">{sys === 'slip' ? 'The printed case follows the master at this distance — fill it with plaster to make the slip-casting mould. 20–30 mm keeps the plaster absorbent and strong.' : 'The jacket follows the master at an even gap; silicone fills the gap. A bigger gap makes a thicker, stiffer silicone mould.'}</p>
					{:else if fam === 'tray'}
						<h3>Tray</h3>
						<div class="g2">
							{@render numField('sgap', 'Silicone gap', 'silicone_gap_mm', 1, 3, 50, 'mm')}
							{@render numField('bwall', 'Tray wall', 'box_wall_mm', 0.5, 1.5, 12, 'mm')}
						</div>
						<p class="hint">Gap around and over the master — the silicone covers the top by the same amount.</p>
					{:else if fam === 'direct_open' || fam === 'direct_funnel'}
						<h3>Direct mould</h3>
						<div class="g2">
							{@render numField('dclr', 'Cavity clearance', 'direct_clearance_mm', 0.05, 0, 2, 'mm')}
							{@render numField('dwall', 'Mould wall', 'direct_wall_mm', 0.5, 1.5, 15, 'mm')}
							{@render numField('shr', 'Shrinkage', 'shrinkage_percent', 0.1, -5, 8, '%')}
							{@render numField('draft', 'Draft angle', 'draft_angle_deg', 0.5, 0, 10, '°')}
						</div>
						<label class="check">
							<input type="checkbox" bind:checked={params.undercut_relief} />
							<span><strong>Clear extraction</strong> — remove undercuts along each piece's pull direction so it releases cleanly.</span>
						</label>
					{:else if fam === 'skin'}
						<h3>Skin shell</h3>
						<div class="g2">
							{@render numField('skt', 'Skin thickness', 'skin_thickness_mm', 0.5, 0.8, 15, 'mm')}
							{@render numField('bwall', 'Shell wall', 'box_wall_mm', 0.5, 1.5, 12, 'mm')}
						</div>
						<p class="hint">The printed core is your master on a base; the outer shell sits over it at the skin thickness. Pour latex or silicone through the funnel to form the skin.</p>
					{:else if fam === 'fixture'}
						<h3>Fixture</h3>
						<div class="g2">
							{@render numField('fdp', 'Pocket depth', 'fixture_depth_pct', 5, 10, 90, '%')}
							{@render numField('fmg', 'Margin', 'fixture_margin_mm', 1, 3, 40, 'mm')}
							{@render numField('fbs', 'Base under part', 'fixture_base_mm', 0.5, 2, 30, 'mm')}
							{@render numField('fcl', 'Fit clearance', 'fixture_clearance_mm', 0.05, 0, 3, 'mm')}
						</div>
						<div class="field">
							<span class="lbl">Outline</span>
							<div class="segs">
								{#each seg.base_style as o}
									<button type="button" class="seg {params.base_style === o.v ? 'on' : ''}" onclick={() => (params.base_style = o.v)}>{o.l}</button>
								{/each}
							</div>
						</div>
						<p class="hint">Depth is how much of the part's height sits in the pocket. Finger notches are cut at both ends so the part lifts out.</p>
					{:else if fam === 'shell'}
						<h3>Protective case</h3>
						<div class="g2">
							{@render numField('scl', 'Clearance', 'shell_clearance_mm', 0.1, 0.2, 10, 'mm')}
							{@render numField('swl', 'Case wall', 'shell_wall_mm', 0.5, 1.2, 12, 'mm')}
						</div>
						<p class="hint">Clearance is the gap around the model — add a little for foam or tissue lining.</p>
					{/if}

					{#if hasBase}
						<div class="g2" style="margin-top:14px;">
							{@render numField('bflange', 'Base flange', 'base_flange_mm', 1, 0, 30, 'mm')}
							<div class="field">
								<span class="lbl">Base plate</span>
								<div class="segs">
									{#each seg.base_style as o}
										<button type="button" class="seg sm {params.base_style === o.v ? 'on' : ''}" onclick={() => (params.base_style = o.v)}>{o.l}</button>
									{/each}
								</div>
							</div>
						</div>
						<label class="check">
							<input type="checkbox" bind:checked={params.base_bolts} />
							<span><strong>Base bolt holes</strong> — four holes through the base flange (needs ≥ 5 mm flange) to bolt the system to a board.</span>
						</label>
						{#if params.base_bolts}
							<div class="inline">
								<label for="bolt">Bolt hole Ø</label>
								<div class="num"><input id="bolt" type="number" step="0.1" min="2" max="8" bind:value={params.bolt_diameter_mm} /><span class="u">mm</span></div>
							</div>
						{/if}
					{/if}

					{#if hasSplits || fam === 'direct_open' || fam === 'skin'}
						<div class="g2" style="margin-top:14px;">
							{@render numField('flt', fam === 'direct_open' ? 'Flange / wing thickness' : fam === 'skin' ? 'Skirt thickness' : 'Collar thickness', 'flange_thickness_mm', 0.5, 2, 20, 'mm')}
							{@render numField('flr', fam === 'direct_open' ? 'Flange / wing reach' : fam === 'skin' ? 'Skirt reach' : 'Collar reach', 'flange_reach_mm', 1, 3, 40, 'mm')}
						</div>
						<p class="hint">
							{#if fam === 'direct_open'}The flat wing around the open base lets the mould stand steady; the same collar runs down every split.{:else if fam === 'skin'}The shell's skirt rests on the core base and registers on pins.{:else}Each half gets a collar of this thickness along the split, sticking out by the reach — room for keys and clamp holes.{/if}
						</p>
					{/if}
				</section>
			{/if}

			<!-- CAVITY (block) -->
			{#if tab === 'cavity' && isBlock}
				<section class="grp">
					<h3>Cavity &amp; fit</h3>
					<div class="g2">
						{@render numField('wall', 'Wall thickness', 'wall_thickness_mm', 0.5, 3, 40, 'mm')}
						{@render numField('clr', 'Cavity clearance', 'cavity_clearance_mm', 0.05, 0, 2, 'mm')}
						{@render numField('shr', 'Shrinkage', 'shrinkage_percent', 0.1, -5, 8, '%')}
						{@render numField('draft', 'Draft angle', 'draft_angle_deg', 0.5, 0, 10, '°')}
					</div>
					<label class="check">
						<input type="checkbox" bind:checked={params.undercut_relief} />
						<span><strong>Undercut relief</strong> — sweep each half so it demoulds cleanly even with overhangs.</span>
					</label>
					<p class="hint">Clearance is the gap around the part for release. Set draft to 0 if holes must stay perfectly cylindrical.</p>
				</section>
			{/if}

			<!-- FEED (block) -->
			{#if tab === 'feed' && isBlock && !isOnePart}
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
							{@render numField('spd', 'Sprue Ø', 'sprue_diameter_mm', 0.5, 2, 30, 'mm')}
							{#if showTaper}{@render numField('spt', 'Taper', 'sprue_taper_deg', 0.5, 0, 15, '°')}{/if}
							{#if showFunnel}{@render numField('fnl', 'Funnel top Ø', 'funnel_top_diameter_mm', 1, params.sprue_diameter_mm, 60, 'mm')}{/if}
							{#if showRunner}{@render numField('run', 'Runner Ø', 'runner_diameter_mm', 0.5, 2, 20, 'mm')}{/if}
							{@render numField('sox', 'Sprue offset X', 'sprue_offset_x_mm', 0.5, -500, 500, 'mm')}
							{@render numField('soy', 'Sprue offset Y', 'sprue_offset_y_mm', 0.5, -500, 500, 'mm')}
						</div>
						<p class="hint">Keep the pour point over the part or the sprue lands blind.</p>
					{/if}
				</section>
			{/if}

			<!-- POUR (jacket / direct funnel / skin) -->
			{#if tab === 'pour' && hasPour}
				<section class="grp">
					<h3>Pour funnel &amp; risers</h3>
					<div class="g2">
						{@render numField('pd', 'Pour channel Ø', 'pour_diameter_mm', 1, 4, 40, 'mm')}
						{@render numField('ptd', 'Funnel top Ø', 'pour_top_diameter_mm', 1, 4, 70, 'mm')}
						{@render numField('rc', 'Risers', 'riser_count', 1, 0, 6, '')}
						{@render numField('rd', 'Riser Ø', 'riser_diameter_mm', 0.5, 1.5, 12, 'mm')}
					</div>
					<p class="hint">The funnel sits over the master's highest point. Risers are placed automatically on the other high points so trapped air and excess {sys === 'slip' ? 'plaster' : fam === 'direct_funnel' ? 'resin' : 'silicone'} can escape.</p>
				</section>
			{/if}

			<!-- VENTS (block) -->
			{#if tab === 'vents' && isBlock && !isOnePart}
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
							{@render numField('vc', 'Count', 'valve_count', 1, 0, 8, '')}
							{@render numField('vd', 'Ø', 'valve_diameter_mm', 0.5, 1, 15, 'mm')}
							{@render numField('vr', 'Ring', 'valve_ring_factor', 0.05, 0.1, 0.9, '')}
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
								{@render numField('vn', 'Vent count', 'vent_count', 1, 1, 8, '')}
							</div>
						{/if}
					{/if}
				</section>
			{/if}

			<!-- KEYS -->
			{#if tab === 'keys'}
				<section class="grp">
					<h3>Registration keys</h3>
					<div class="field">
						<span class="lbl">Key shape</span>
						<div class="segs">
							{#each seg.key_shape as o}
								<button type="button" class="seg {params.key_shape === o.v ? 'on' : ''}" onclick={() => (params.key_shape = o.v)}>{o.l}</button>
							{/each}
						</div>
						<p class="hint">{isBlock ? 'Bosses on one half, sockets in the other — keeps alignment perfect.' : 'Bosses on one piece, sockets in its neighbour, spaced evenly down each mating flange.'}</p>
					</div>

					{#if params.key_shape !== 'none'}
						{#if isRadial}
							<p class="hint">Keys are placed automatically — one per wedge seam{isSixPart ? ', with caps registering on the seams' : ''}.</p>
						{/if}
						<div class="g3">
							{#if isBlock && !isRadial}
								<div class="field">
									<span class="lbl">Count</span>
									<div class="segs narrow">
										{#each seg.key_count as o}
											<button type="button" class="seg {params.key_count === o.v ? 'on' : ''}" onclick={() => (params.key_count = o.v)}>{o.l}</button>
										{/each}
									</div>
								</div>
							{:else if !isBlock}
								{@render numField('skc', 'Per split', 'split_key_count', 1, 0, 8, '')}
							{/if}
							{@render numField('kd', 'Ø', 'key_diameter_mm', 0.5, 3, 20, 'mm')}
							{@render numField('kc', 'Clearance', 'key_clearance_mm', 0.05, 0, 1, 'mm')}
						</div>
						<p class="hint">0.1–0.2 mm for FDM, 0.05–0.1 mm for resin.{#if !isBlock} Key size is capped by the collar thickness and reach.{/if}</p>
					{/if}

					{#if !isBlock}
						<label class="check" style="margin-top:14px;">
							<input type="checkbox" bind:checked={params.clamp_holes} />
							<span><strong>Clamp holes</strong> — holes straight through the mating collars, between the keys, to bolt the pieces shut.</span>
						</label>
						{#if params.clamp_holes}
							<div class="inline">
								<label for="clh">Hole Ø</label>
								<div class="num"><input id="clh" type="number" step="0.1" min="2" max="8" bind:value={params.clamp_hole_diameter_mm} /><span class="u">mm</span></div>
							</div>
						{/if}
					{/if}
				</section>
			{/if}

			<!-- MASTER -->
			{#if tab === 'master' && !isBlock}
				<section class="grp">
					<h3>Master</h3>

					{#if hasBase}
						<label class="check">
							<input type="checkbox" bind:checked={params.master_seat} />
							<span><strong>Locator socket</strong> — recess the master's footprint into the base so it seats centred with even silicone all round.</span>
						</label>
						{#if params.master_seat}
							<div class="inline">
								<label for="mclr">Fit clearance</label>
								<div class="num"><input id="mclr" type="number" step="0.05" min="0" max="2" bind:value={params.master_clearance_mm} /><span class="u">mm</span></div>
							</div>
						{/if}
						<label class="check" style="margin-top:12px;">
							<input type="checkbox" bind:checked={params.master_seal} />
							<span><strong>Smart seal</strong> — a thin collar hugs the master where it meets the base, so silicone can't creep underneath.</span>
						</label>
						<div class="g2" style="margin-top:14px;">
							{@render numField('bkc', 'Base keys', 'base_key_count', 1, 0, 8, '')}
							{@render numField('bkd', 'Base key Ø', 'base_key_diameter_mm', 0.5, 2, 16, 'mm')}
						</div>
						<p class="hint">Pockets placed evenly around the master in the base. Silicone fills them, so the finished silicone mould drops back into the jacket in exact register.</p>
					{/if}

					{#if fam !== 'fixture'}
						<div class="field" style="margin-top:14px;">
							<label class="lbl" for="fnd">Foundation</label>
							<div class="num"><input id="fnd" type="number" step="0.5" min="0" max="20" bind:value={params.foundation_mm} /><span class="u">mm</span></div>
							<p class="hint">Adds a solid, flat base of this height under the master's footprint so rough or uneven bottoms stand and seal properly. 0 = off.</p>
						</div>
					{/if}

					{#if pourFromTop}
						<label class="check" style="margin-top:6px;">
							<input type="checkbox" bind:checked={params.air_trap_detect} />
							<span><strong>Air-trap check</strong> — find pockets under overhangs where rising {fam === 'skin' ? 'material' : sys === 'slip' ? 'plaster' : 'silicone'} would trap air (red markers in the preview).</span>
						</label>
						{#if params.air_trap_detect}
							<label class="check" style="margin-top:10px;">
								<input type="checkbox" bind:checked={params.air_trap_pillars} />
								<span><strong>Support pillars</strong> — add thin pillars under each trap so the pocket vents and the master is supported.</span>
							</label>
							{#if params.air_trap_pillars}
								<div class="inline">
									<label for="pil">Pillar Ø</label>
									<div class="num"><input id="pil" type="number" step="0.5" min="1.5" max="8" bind:value={params.pillar_diameter_mm} /><span class="u">mm</span></div>
								</div>
							{/if}
						{/if}
					{/if}

					{#if sys === 'core'}
						<div class="field" style="margin-top:16px;">
							<span class="lbl">Inner core</span>
							<div class="segs">
								{#each seg.core_mode as o}
									<button type="button" class="seg {params.core_mode === o.v ? 'on' : ''}" onclick={() => (params.core_mode = o.v)}>{o.l}</button>
								{/each}
							</div>
							<p class="hint">Auto plugs any bore it finds (rings, tubes); otherwise it hollows the master into a vessel: the jacket is left open at the mouth, and the core drops in with a T-bar resting across the rim. The core pulls straight up, so the vessel's opening must face +Z.</p>
						</div>
						<div class="g3">
							{@render numField('cw', 'Cast wall', 'cast_wall_mm', 0.5, 1, 20, 'mm')}
							{@render numField('cdr', 'Core draft', 'core_draft_deg', 0.5, 0, 10, '°')}
							{@render numField('trim', 'Top trim', 'top_trim_mm', 0.5, 0, 200, 'mm')}
						</div>
						<p class="hint">Cast wall is the minimum wall of the hollow cast. Draft tapers the core so it releases — walls get slightly thicker toward the bottom, and wider below a narrow neck (a one-piece core can only be as wide as the mouth). Top trim cuts the master flat to open or widen the mouth. Toggle “Silicone + cast” in the preview to check the cast.</p>
					{/if}

					{#if sys === 'slip'}
						<div class="g2" style="margin-top:16px;">
							{@render numField('spd2', 'Spare Ø', 'slip_spare_diameter_mm', 1, 0, 120, 'mm')}
							{@render numField('sph', 'Spare height', 'slip_spare_height_mm', 1, 0, 80, 'mm')}
							{@render numField('trim', 'Top trim', 'top_trim_mm', 0.5, 0, 200, 'mm')}
						</div>
						<p class="hint">The spare is a flared reservoir added on top of the master: it forms the pour opening in the plaster and holds extra slip as the walls build up. Trim cuts the cast top flat before the spare. Spare Ø 0 = off.</p>
					{/if}
				</section>
			{/if}

			<!-- EXTRAS -->
			{#if tab === 'extras'}
				<section class="grp">
					<h3>Branding &amp; labels</h3>
					<div class="field">
						<label class="lbl" for="brand">Text</label>
						<div class="num"><input id="brand" type="text" maxlength="40" placeholder="Your logo text, part no…" bind:value={params.brand_text} /></div>
					</div>
					<div class="g2">
						<div class="field">
							<span class="lbl">Style</span>
							<div class="segs">
								{#each seg.brand_mode as o}
									<button type="button" class="seg sm {params.brand_mode === o.v ? 'on' : ''}" onclick={() => (params.brand_mode = o.v)}>{o.l}</button>
								{/each}
							</div>
						</div>
						{@render numField('bsz', 'Text height', 'brand_size_mm', 0.5, 3, 30, 'mm')}
					</div>
					<label class="check">
						<input type="checkbox" bind:checked={params.brand_volume_label} />
						<span><strong>Volume label</strong> — add the {fam === 'silicone' || fam === 'tray' ? 'silicone' : 'casting'} volume (ml) to the mould, so you mix the right amount every time.</span>
					</label>
					<p class="hint">Text is placed on the base or outer wall by the server. It isn't drawn in the live preview.</p>
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
								<button type="button" class="seg {params.resolution === o.v ? 'on' : ''} {lockedRes(o.v) ? 'locked' : ''}" onclick={() => setResolution(o.v)}>
									{o.l}{#if lockedRes(o.v)}{@render proTag()}{/if}
								</button>
							{/each}
						</div>
						{#if showCustomVoxel}
							<div class="inline">
								<label for="vox">Custom</label>
								<div class="num"><input id="vox" type="number" step="0.05" min="0.15" max="2" bind:value={params.voxel_size_mm} onblur={onVoxelBlur} /><span class="u">mm</span></div>
							</div>
						{/if}
						<p class="hint">Finer voxels capture more detail but take longer. Large parts at fine resolution are auto-coarsened on the server. The live preview always runs at a coarse draft resolution.</p>
					</div>

					<div class="field">
						<span class="lbl">Cavity precision</span>
						<div class="segs">
							{#each seg.surface_refinement as o}
								<button type="button" class="seg {params.surface_refinement === o.v ? 'on' : ''} {lockedRefine(o.v) ? 'locked' : ''}" onclick={() => setRefinement(o.v)}>
									{o.l}{#if lockedRefine(o.v)}{@render proTag()}{/if}
								</button>
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
		{#if file && modelBuffer && active}
			<MouldPreview {modelBuffer} fileName={file.name} {params} onStats={(s) => (previewStats = s)} />
		{:else if file && !modelBuffer}
			<div class="vp-empty"><div class="spinner"></div><p>Reading {file.name}…</p></div>
		{:else if !file}
			<div
				class="vp-drop {dragOver ? 'over' : ''}"
				role="button"
				tabindex="0"
				onclick={() => fileInputEl.click()}
				onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInputEl.click())}
				ondragover={(e) => { e.preventDefault(); dragOver = true; }}
				ondragleave={() => (dragOver = false)}
				ondrop={onDrop}>
				<svg viewBox="0 0 24 24" class="vp-icon" aria-hidden="true">
					<path d="M12 3v12m0-12l-4 4m4-4l4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
				</svg>
				<p class="vp-t">Drop a 3D model to start</p>
				<p class="vp-h">STL · 3MF · STEP · up to {MAX_UPLOAD_MB} MB — then pick a mould system and tune it live</p>
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
					<div class="row"><span>System</span><span class="v">{typeLabel}</span></div>
					{#if isBlock}
						<div class="row"><span>Pull / parting</span><span class="v">{#if isRadial}{isSixPart ? '4 radial + 2 caps' : 'radial ±X ±Y'}{:else}{params.parting_axis.toUpperCase()}{#if isTwoPart} · {params.parting_mode}{params.parting_surface === 'follow' ? ' · silhouette' : ''}{/if}{/if}</span></div>
						<div class="row"><span>Wall / clr</span><span class="v">{params.wall_thickness_mm} / {params.cavity_clearance_mm} mm</span></div>
						<div class="row"><span>Draft / shrink</span><span class="v">{params.draft_angle_deg}° / {params.shrinkage_percent}%</span></div>
						{#if !isOnePart}
							<div class="row"><span>Gate</span><span class="v">{params.gate_type === 'none' ? 'None' : `${params.gate_type} · ${params.sprue_type} · Ø${params.sprue_diameter_mm}`}</span></div>
							<div class="row"><span>Valves</span><span class="v">{params.valve_type === 'none' ? 'None' : `${params.valve_count} × Ø${params.valve_diameter_mm}`}</span></div>
						{/if}
						{#if isTwoPart}
							<div class="row"><span>Keys</span><span class="v">{params.key_shape === 'none' ? 'None' : `${params.key_count} × ${params.key_shape}`}</span></div>
						{/if}
					{:else}
						{#if splitCapable}
							<div class="row"><span>Splits</span><span class="v">{splitLabel}</span></div>
						{/if}
						{#if fam === 'silicone' || fam === 'tray'}
							<div class="row"><span>{sys === 'slip' ? 'Plaster wall' : 'Silicone gap'}</span><span class="v">{sys === 'slip' ? params.plaster_thickness_mm : params.silicone_gap_mm} mm</span></div>
							<div class="row"><span>Wall / base</span><span class="v">{params.box_wall_mm} / {params.base_flange_mm} mm · {params.base_style === 'rect' ? 'rect' : 'outline'}</span></div>
							<div class="row"><span>Master</span><span class="v">{params.master_seat ? 'socket' : 'flat'}{params.master_seal ? ' · seal' : ''}{params.base_key_count ? ` · ${params.base_key_count} base keys` : ''}</span></div>
						{:else if fam === 'direct_open' || fam === 'direct_funnel'}
							<div class="row"><span>Clr / wall</span><span class="v">{params.direct_clearance_mm} / {params.direct_wall_mm} mm</span></div>
						{:else if fam === 'skin'}
							<div class="row"><span>Skin / wall</span><span class="v">{params.skin_thickness_mm} / {params.box_wall_mm} mm</span></div>
						{:else if fam === 'fixture'}
							<div class="row"><span>Pocket</span><span class="v">{params.fixture_depth_pct}% · margin {params.fixture_margin_mm} mm</span></div>
						{:else if fam === 'shell'}
							<div class="row"><span>Clr / wall</span><span class="v">{params.shell_clearance_mm} / {params.shell_wall_mm} mm</span></div>
						{/if}
						{#if hasPour}
							<div class="row"><span>Pour</span><span class="v">Ø{params.pour_diameter_mm} funnel · {params.riser_count} risers</span></div>
						{/if}
						{#if hasSplits}
							<div class="row"><span>Keys / clamps</span><span class="v">{params.key_shape === 'none' ? 'no keys' : `${params.split_key_count}/split ${params.key_shape}`}{params.clamp_holes ? ` · Ø${params.clamp_hole_diameter_mm}` : ''}</span></div>
						{/if}
						{#if sys === 'core'}
							<div class="row"><span>Core</span><span class="v">{coreHollow ? 'hollow · T-bar' : params.core_mode === 'auto' ? 'auto' : params.core_mode} · wall {params.cast_wall_mm} mm · {params.core_draft_deg}°</span></div>
						{/if}
						{#if sys === 'slip'}
							<div class="row"><span>Spare</span><span class="v">Ø{params.slip_spare_diameter_mm} × {params.slip_spare_height_mm} mm</span></div>
						{/if}
						{#if params.foundation_mm > 0}
							<div class="row"><span>Foundation</span><span class="v">{params.foundation_mm} mm</span></div>
						{/if}
					{/if}
					{#if params.brand_text || params.brand_volume_label}
						<div class="row"><span>Branding</span><span class="v">{params.brand_text ? `“${params.brand_text}”` : ''}{params.brand_volume_label ? (params.brand_text ? ' + ' : '') + 'volume' : ''}</span></div>
					{/if}
					<div class="row"><span>Voxel</span><span class="v">{effectiveVoxel} mm</span></div>
					<div class="row"><span>Precision</span><span class="v">{params.surface_refinement === 'cad_exact' ? 'CAD-exact ±0.01' : 'Voxel'}</span></div>
				</div>

				{#if !isBlock && file}
					<div class="est">
						<p class="est-h">Live estimate <span>from preview</span></p>
						{#if previewStats}
							<div class="res">
								<div class="res-i"><span class="rl">Master</span><span class="rv">{fmt(previewStats.master_cm3, 0)} cm³</span></div>
								{#if fam !== 'fixture' && fam !== 'shell'}
									<div class="res-i hl"><span class="rl">{fillName}</span><span class="rv">≈ {fmt(previewStats.fill_cm3, 0)} ml</span></div>
								{/if}
								{#if sys === 'core' && previewStats.core_mode === 'hollow'}
									<div class="res-i"><span class="rl">Hollow cast</span><span class="rv">{fmt(previewStats.cast_cm3, 0)} cm³</span></div>
								{/if}
								<div class="res-i"><span class="rl">Printed</span><span class="rv">{fmt(previewStats.printed_cm3, 0)} cm³ · ≈{fmt(previewStats.printed_cm3 * 1.24, 0)} g PLA</span></div>
								<div class="res-i"><span class="rl">Pieces</span><span class="rv">{piecesText}</span></div>
								<div class="res-i"><span class="rl">Footprint</span><span class="rv">{previewStats.box_mm.map((v) => fmt(v, 0)).join(' × ')} mm</span></div>
								{#if pourFromTop && params.air_trap_detect}
									<div class="res-i {previewStats.air_traps ? 'bad' : ''}"><span class="rl">Air traps</span><span class="rv">{previewStats.air_traps ? `${previewStats.air_traps} found` : 'none'}</span></div>
								{/if}
							</div>
							<p class="note">Solid-voxel estimate at {fmt(previewStats.voxel_mm, 1)} mm; the generated report is exact.{#if fam === 'silicone' && sys !== 'slip'} Mix ~10% extra silicone.{/if}</p>
						{:else}
							<p class="note" style="text-align:left;">Building…</p>
						{/if}
					</div>
				{/if}

				<button class="cta" type="button" disabled={!canSubmit} onclick={() => generate()}>
					{#if phase === 'uploading'}Generating… {elapsed}s{:else if subChecked && !loggedIn}Sign in to generate{:else}Generate mould{/if}
				</button>

				{#if phase === 'uploading'}
					<p class="note pulse">Voxelising, building the mould system and meshing on the server. Typically 10–60 s.</p>
				{:else if !file}
					<p class="note">Upload a model to begin.</p>
				{:else if subChecked && !loggedIn}
					<p class="note">Generating a mould is free — you just need an account (1 mould/day).</p>
				{:else if subChecked && !isPremium && !subError}
					<p class="note">Free plan: 1 mould/day · Two-part box · Draft/Standard voxel. <a href={PRICING_PATH} style="color:#7c3aed;font-weight:600;">Go Pro</a> for every mould system, multi-part, Fine/CAD-exact & unlimited.</p>
				{:else if subError}
					<p class="note">{subError} <button class="linkish" type="button" onclick={() => checkSubscription(true)}>Retry</button></p>
				{/if}

				{#if phase === 'error'}
					<div class="alert err-a">
						<strong>{showUpgrade ? 'Upgrade required' : 'Generation failed'}</strong>
						<p>{errorMsg}</p>
						{#if showUpgrade}
							<button class="up-btn" type="button" onclick={goUpgrade}>See Akritio Pro →</button>
							<button class="linkish" type="button" style="margin-top:8px;" onclick={() => checkSubscription(true)}>Already paid? Refresh my plan</button>
						{/if}
					</div>
				{/if}
			</section>

			{#if phase === 'done' && report}
				<section class="grp">
					<h3>Result</h3>
					<div class="res">
						{#if report.part_l_mm !== undefined}
							<div class="res-i"><span class="rl">Part size</span><span class="rv">{fmt(report.part_l_mm, 1)} × {fmt(report.part_w_mm, 1)} × {fmt(report.part_h_mm, 1)} mm</span></div>
						{/if}
						{#if report.part_volume_cm3 !== undefined}
							<div class="res-i"><span class="rl">{isBlock ? 'Part volume' : 'Master volume'}</span><span class="rv">{fmt(report.part_volume_cm3)} cm³</span></div>
						{/if}
						{#if report.block_x_mm !== undefined}
							<div class="res-i"><span class="rl">{isBlock ? 'Mould block' : 'System size'}</span><span class="rv">{fmt(report.block_x_mm, 1)} × {fmt(report.block_y_mm, 1)} × {fmt(report.block_z_mm, 1)} mm</span></div>
						{/if}
						{#if report.silicone_volume_cm3}
							<div class="res-i hl"><span class="rl">{sys === 'slip' ? 'Plaster needed' : fam === 'skin' ? 'Skin material' : 'Silicone needed'}</span><span class="rv">≈ {fmt(report.silicone_volume_cm3, 0)} ml</span></div>
						{/if}
						{#if report.plaster_volume_cm3}
							<div class="res-i hl"><span class="rl">Plaster needed</span><span class="rv">≈ {fmt(report.plaster_volume_cm3, 0)} ml</span></div>
						{/if}
						{#if report.casting_volume_cm3}
							<div class="res-i"><span class="rl">{sys === 'core' ? 'Hollow cast' : 'Casting volume'}</span><span class="rv">{fmt(report.casting_volume_cm3)} cm³</span></div>
						{/if}
						{#if report.pieces >= 4 && isBlock}
							<div class="res-i"><span class="rl">Pieces</span><span class="rv">{report.pieces === 6 ? '4 wedges + 2 caps' : '4 wedges'}</span></div>
							<div class="res-i"><span class="rl">Piece vols</span><span class="rv">{fmt(report.mould_a_volume_cm3, 0)} / {fmt(report.mould_b_volume_cm3, 0)} / {fmt(report.mould_c_volume_cm3, 0)} / {fmt(report.mould_d_volume_cm3, 0)}{report.pieces === 6 ? ` / ${fmt(report.mould_e_volume_cm3, 0)} / ${fmt(report.mould_f_volume_cm3, 0)}` : ''} cm³</span></div>
						{:else if report.pieces}
							<div class="res-i"><span class="rl">Pieces</span><span class="rv">{report.pieces}</span></div>
							{#if report.mould_a_volume_cm3 > 0}
								<div class="res-i"><span class="rl">Piece A</span><span class="rv">{fmt(report.mould_a_volume_cm3)} cm³</span></div>
							{/if}
							{#if report.mould_b_volume_cm3 > 0}
								<div class="res-i"><span class="rl">Piece B</span><span class="rv">{fmt(report.mould_b_volume_cm3)} cm³</span></div>
							{/if}
						{/if}
						{#if report.parting_z_mm !== undefined && isBlock}
							<div class="res-i"><span class="rl">Parting</span><span class="rv">{report.parting_surface === 'follow' ? 'Silhouette' : 'Flat'} · Z {fmt(report.parting_z_mm, 2)}</span></div>
						{/if}
						{#if isBlock && report.undercut_relief_cm3 !== undefined}
							<div class="res-i"><span class="rl">Undercut relief</span><span class="rv">{fmt(report.undercut_relief_cm3)} cm³</span></div>
						{/if}
						{#if report.refined_vertices > 0}
							<div class="res-i hl"><span class="rl">CAD-exact</span><span class="rv">{num(report.refined_vertices)} v · rms {fmt(report.refine_rms_mm, 3)}</span></div>
						{/if}
						{#if report.grid}
							<div class="res-i"><span class="rl">Grid</span><span class="rv">{report.grid.join(' × ')} @ {fmt(report.voxel_mm, 2)}</span></div>
						{/if}
						{#if report.triangles_out_a !== undefined}
							<div class="res-i"><span class="rl">Triangles</span><span class="rv">A {num(report.triangles_out_a)}{#if report.triangles_out_b > 0} · B {num(report.triangles_out_b)}{/if}</span></div>
						{/if}
					</div>

					{#if report.warnings && report.warnings.length}
						<div class="alert warn-a"><strong>Warnings</strong><ul>{#each report.warnings as w}<li>{w}</li>{/each}</ul></div>
					{/if}

					<button class="cta light" type="button" disabled={zipDownloaded || downloading} onclick={downloadZip}>{downloading ? 'Preparing ZIP…' : zipDownloaded ? 'Downloaded ✓' : 'Download mould (ZIP)'}</button>
					{#if errorMsg && !downloading && !zipDownloaded}
						<div class="alert err-a" style="margin-top:10px;"><strong>Download problem</strong><p>{errorMsg}{#if !mouldToken && !downloadUrl} Press <em>Generate mould</em> again to make a fresh package.{/if}</p></div>
					{/if}
					<p class="note">{zipDownloaded ? 'Saved to your device — the package is removed from the server once delivered.' : downloading ? 'Fetching the package…' : 'The ZIP contains every component as its own ready-to-print STL, plus report.json. It can be downloaded once.'}</p>
					{#if !isPremium && freeUsedToday}
						<p class="note">That's today's free mould. <a href={PRICING_PATH} style="color:#7c3aed;font-weight:600;">Upgrade to Pro</a> for unlimited generations.</p>
					{/if}
				</section>
			{/if}
		</div>
	</aside>

	<input type="file" accept=".stl,.step,.stp,.3mf" bind:this={fileInputEl} onchange={onPick} hidden />
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
		grid-template-columns: 340px 1fr 300px;
		grid-template-rows: 54px auto 1fr;
		background: var(--soft);
		color: var(--ink);
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 14px;
		overflow: hidden;
	}
	.bar { grid-column: 1 / -1; display: flex; align-items: center; gap: 18px; padding: 0 16px; background: #fff; border-bottom: 1px solid var(--line); }
	.brand { display: inline-flex; align-items: center; gap: 9px; font-family: 'Space Grotesk', 'Inter', sans-serif; font-weight: 700; font-size: 15px; color: var(--ink); letter-spacing: -0.01em; text-decoration: none; }
	.brand b { font-weight: 500; color: var(--muted); }
	.bar-file { display: flex; align-items: center; gap: 8px; margin-left: 6px; min-width: 0; }
	.fchip { display: inline-flex; align-items: center; gap: 8px; background: var(--soft); border: 1px solid var(--line); border-radius: 999px; padding: 5px 12px; max-width: 260px; }
	.fname { font-size: 12.5px; font-weight: 550; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.fsize { font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; color: var(--muted); flex: none; }
	.mini { font-family: inherit; font-size: 12.5px; font-weight: 600; border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 999px; padding: 6px 14px; cursor: pointer; transition: border-color 0.15s; text-decoration: none; white-space: nowrap; }
	.mini:hover { border-color: var(--violet); }
	.mini.solid { background: var(--ink); color: #fff; border-color: var(--ink); }
	.mini.solid.violet { background: #7c3aed; border-color: #7c3aed; }
	.mini.solid.violet:hover { background: #6d28d9; border-color: #6d28d9; }
	.bar-account { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; }
	.plan-chip { font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
	.plan-chip.free { color: var(--muted); background: var(--soft); border: 1px solid var(--line); }
	.plan-chip.pro { color: #6d28d9; background: #f5f3ff; border: 1px solid #ddd6fe; }
	.bar-link { margin-left: 16px; font-size: 13px; color: var(--muted); text-decoration: none; white-space: nowrap; }
	.bar-link:hover { color: var(--ink); }

	.tabs { grid-column: 1 / -1; grid-row: 2; display: flex; align-items: center; gap: 4px; padding: 8px 16px; background: #fff; border-bottom: 1px solid var(--line); overflow-x: auto; scrollbar-width: thin; }
	.props { grid-row: 3; display: flex; flex-direction: column; background: #fff; border-right: 1px solid var(--line); min-height: 0; }
	.tab { display: inline-flex; align-items: center; gap: 7px; font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--muted); background: transparent; border: 1px solid transparent; border-radius: 8px; padding: 6px 11px; cursor: pointer; white-space: nowrap; transition: all 0.14s; }
	.tab:hover { color: var(--ink); background: var(--soft); }
	.tab.on { color: #fff; background: var(--ink); }
	.tab-ico { display: inline-flex; flex: none; color: inherit; }
	.tab-ico svg { display: block; }
	.tab-lbl { line-height: 1; }
	.props-body { flex: 1; overflow-y: auto; padding: 18px 16px 40px; min-height: 0; }

	.grp + .grp { margin-top: 26px; }
	.grp h3 { font-family: 'Space Grotesk', 'Inter', sans-serif; font-size: 14px; font-weight: 650; margin: 0 0 16px; }

	.drop { border: 1.5px dashed var(--line); border-radius: 12px; padding: 26px 16px; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
	.drop:hover, .drop.over { border-color: var(--violet); background: #faf9ff; }
	.drop-t { font-size: 13.5px; font-weight: 550; margin: 0 0 3px; }
	.drop-h { font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; letter-spacing: 0.06em; color: var(--muted); margin: 0; }

	.file-row { display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
	.file-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
	.file-name { font-size: 13px; font-weight: 550; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.file-size { font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; color: var(--muted); }
	.ghost { border: 1px solid var(--line); background: transparent; border-radius: 999px; padding: 6px 13px; font-size: 12px; cursor: pointer; color: var(--ink); flex: none; font-family: inherit; }
	.ghost:hover { border-color: var(--ink); }

	.field { margin-bottom: 18px; }
	.field:last-child { margin-bottom: 0; }
	.lbl { display: block; font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
	.hint { font-size: 12px; color: var(--muted); line-height: 1.5; margin: 8px 0 0; }
	.hint a { text-decoration: none; }
	.hint a:hover { text-decoration: underline; }
	.hint.soon { color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 7px 10px; }
	.err { color: #dc2626; font-size: 12.5px; margin: 8px 0 0; }

	.segs { display: flex; flex-wrap: wrap; gap: 6px; }
	.segs.narrow .seg { min-width: 44px; justify-content: center; }
	.seg { border: 1px solid var(--line); background: #fff; color: var(--body); border-radius: 8px; padding: 7px 12px; font-size: 12.5px; font-weight: 550; cursor: pointer; transition: all 0.14s; font-family: inherit; display: inline-flex; align-items: center; }
	.seg.sm { padding: 5px 9px; font-size: 12px; }
	.segs.narrow .seg.sm { min-width: 34px; }
	.seg:hover { border-color: #cbd5e1; color: var(--ink); }
	.seg.on { background: var(--blue); border-color: var(--blue); color: #fff; }
	.seg.locked { border-style: dashed; border-color: #ddd6fe; color: #94a3b8; background: #fbfaff; }
	.seg.locked:hover { border-color: #c4b5fd; color: #7c3aed; }
	.seg.locked.on { background: var(--blue); border-color: var(--blue); color: #fff; }
	.pro-tag { font-size: 8.5px; font-weight: 800; letter-spacing: 0.06em; color: #7c3aed; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 4px; padding: 1px 4px; margin-left: 6px; line-height: 1.4; }
	.seg.on .pro-tag { color: #fff; background: rgba(255, 255, 255, 0.22); border-color: rgba(255, 255, 255, 0.4); }

	.mcards { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
	.mcard { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; border: 1.5px solid var(--line); background: #fff; border-radius: 12px; padding: 10px 12px 10px; cursor: pointer; text-align: left; transition: border-color 0.14s, background 0.14s; font-family: inherit; }
	.mcard:hover { border-color: #c7d2fe; }
	.mcard.on { border-color: var(--blue); background: #f5f8ff; }
	.mcard.locked { border-style: dashed; border-color: #e9d5ff; background: #fbfaff; }
	.mcard.locked:hover { border-color: #c4b5fd; }
	.mcard.locked .pro-tag { position: absolute; top: 8px; right: 8px; margin: 0; }
	.mcard-grp { font-family: ui-monospace, Menlo, monospace; font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; color: #94a3b8; }
	.mcard.on .mcard-grp { color: var(--blue-600); }
	.mcard-ic { width: 26px; height: 26px; stroke: #64748b; fill: #64748b; }
	.mcard.on .mcard-ic { stroke: var(--blue); fill: var(--blue); }
	.mcard-ti { font-size: 13px; font-weight: 650; color: var(--ink); line-height: 1.15; }
	.mcard-tags { display: flex; flex-wrap: wrap; gap: 4px; }
	.mcard-tags em { font-style: normal; font-size: 9.5px; font-weight: 600; color: #94a3b8; background: #f1f5f9; border-radius: 5px; padding: 1px 5px; }
	.mcard.on .mcard-tags em { color: #6366f1; background: #eef2ff; }

	.split-row { border: 1px solid var(--line); border-radius: 10px; padding: 10px 11px; margin-bottom: 8px; background: var(--soft); }
	.split-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
	.split-n { font-size: 12px; font-weight: 650; color: var(--ink); flex: none; }
	.x-btn { margin-left: auto; width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--line); background: #fff; color: var(--muted); font-size: 15px; line-height: 1; cursor: pointer; font-family: inherit; }
	.x-btn:hover { color: #dc2626; border-color: #fecaca; }
	.add-btn { width: 100%; border: 1.5px dashed #cbd5e1; background: #fff; color: var(--body); border-radius: 10px; padding: 9px; font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
	.add-btn:hover { border-color: var(--blue); color: var(--blue-600); }

	.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
	.g2.tight { gap: 10px; margin-bottom: 0; }
	.g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 14px; }
	.g2 .field, .g3 .field { margin-bottom: 0; }
	.num { display: flex; align-items: center; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; background: #fff; transition: border-color 0.15s; }
	.num:focus-within { border-color: var(--blue); }
	.num input { border: none; outline: none; padding: 9px 11px; font-size: 13.5px; width: 100%; min-width: 0; font-family: inherit; color: var(--ink); background: transparent; }
	.num input::-webkit-outer-spin-button, .num input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
	.num input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
	.u { font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; color: var(--muted); padding: 0 11px 0 4px; flex: none; }
	.inline { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
	.inline label { font-size: 12.5px; color: var(--body); flex: none; }
	.inline .num { max-width: 150px; }
	.check { display: flex; gap: 10px; align-items: flex-start; font-size: 12.5px; line-height: 1.5; color: var(--body); cursor: pointer; margin-top: 4px; }
	.check input { margin-top: 2px; width: 15px; height: 15px; accent-color: var(--blue); cursor: pointer; flex: none; }
	.check strong { color: var(--ink); font-weight: 600; }

	.viewport { grid-row: 3; position: relative; min-width: 0; min-height: 0; background: #eef2f7; }
	.vp-drop, .vp-empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; color: var(--muted); }
	.vp-drop { cursor: pointer; margin: 22px; border: 2px dashed #cbd5e1; border-radius: 20px; transition: border-color 0.15s, background 0.15s; }
	.vp-drop.over { border-color: var(--violet); background: #f5f3ff; }
	.vp-icon { width: 40px; height: 40px; color: #94a3b8; margin-bottom: 8px; }
	.vp-t { font-family: 'Space Grotesk', 'Inter', sans-serif; font-size: 18px; font-weight: 600; color: var(--ink); margin: 0; }
	.vp-h { font-size: 13px; margin: 0; padding: 0 16px; }
	.spinner { width: 26px; height: 26px; border: 3px solid #e2e8f0; border-top-color: var(--blue); border-radius: 50%; animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	.inspector { grid-row: 3; background: #fff; border-left: 1px solid var(--line); min-height: 0; overflow: hidden; }
	.ins-scroll { height: 100%; overflow-y: auto; padding: 18px 16px 40px; }
	.rows { display: flex; flex-direction: column; margin-bottom: 8px; }
	.row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 12.5px; color: var(--muted); }
	.row:last-child { border-bottom: none; }
	.row .v { color: var(--ink); font-weight: 550; text-align: right; max-width: 64%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

	.est { margin-top: 10px; border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: var(--soft); }
	.est-h { margin: 0 0 10px; font-size: 12.5px; font-weight: 650; color: var(--ink); }
	.est-h span { font-family: ui-monospace, Menlo, monospace; font-size: 9.5px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-left: 6px; }
	.est .note { text-align: left; }

	.cta { width: 100%; margin-top: 14px; background: var(--ink); color: #fff; border: none; border-radius: 10px; padding: 12px 20px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity 0.15s, transform 0.1s; }
	.cta:hover:not(:disabled) { opacity: 0.92; }
	.cta:active:not(:disabled) { transform: scale(0.99); }
	.cta:disabled { opacity: 0.4; cursor: not-allowed; }
	.cta.light { background: var(--blue); }
	.note { font-size: 11.5px; color: var(--muted); line-height: 1.5; margin: 10px 0 0; text-align: center; }
	.note a { text-decoration: none; }
	.note a:hover { text-decoration: underline; }
	.linkish { font-family: inherit; font-size: 12px; font-weight: 600; color: #7c3aed; background: none; border: none; padding: 0; cursor: pointer; display: inline-block; }
	.linkish:hover { text-decoration: underline; }
	.pulse { animation: pulse 1.6s ease-in-out infinite; }
	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

	.alert { border-radius: 9px; padding: 12px 14px; font-size: 12.5px; line-height: 1.5; margin-top: 14px; }
	.alert strong { display: block; margin-bottom: 4px; }
	.alert p { margin: 0; }
	.alert ul { margin: 6px 0 0; padding-left: 16px; }
	.err-a { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
	.warn-a { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
	.up-btn { margin-top: 10px; width: 100%; border: none; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700; color: #fff; background: #7c3aed; border-radius: 9px; padding: 10px 14px; transition: background 0.15s; }
	.up-btn:hover { background: #6d28d9; }

	.res { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 14px; }
	.res-i { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
	.res-i.hl .rv { color: var(--violet); }
	.res-i.bad .rv { color: #dc2626; }
	.rl { font-family: ui-monospace, Menlo, monospace; font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
	.rv { font-size: 12.5px; font-weight: 550; color: var(--ink); }

	@media (max-width: 1100px) {
		.studio { grid-template-columns: 320px 1fr; grid-template-rows: 54px auto 1fr auto; }
		.inspector { grid-column: 1 / -1; grid-row: 4; border-left: none; border-top: 1px solid var(--line); max-height: 42vh; }
	}
	@media (max-width: 720px) {
		.studio { position: absolute; min-height: 100dvh; grid-template-columns: 1fr; grid-template-rows: 54px auto 52vh auto auto; }
		.tabs { grid-row: 2; }
		.viewport { grid-row: 3; }
		.props { grid-row: 4; border-right: none; border-top: 1px solid var(--line); }
		.inspector { grid-row: 5; max-height: none; }
		.bar-link { display: none; }
		.bar { gap: 10px; }
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner, .pulse { animation: none; }
	}
</style>