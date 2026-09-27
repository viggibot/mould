<script>
	// ==========================================================================
	// MouldPreview — live 3D preview of every Akritio mould system.
	//   • Two-part box (block): fast bounding-box layout, unchanged — it mirrors
	//     the server's proven block pipeline (two / four / six-part, open pour).
	//   • Every other system (adaptive, multi-part, tray, inner core, slip,
	//     direct open / funnel, skin, fixture, protective shell) is BUILT in a
	//     Web Worker ($lib/workers/mouldPreview.worker.js): distance field ->
	//     system SDF -> closed pieces cut along your split planes, with keys,
	//     clamp holes, base keys, cores, pour funnel, risers and air-trap
	//     markers. Volumes come back for the live estimate in the inspector.
	// Requires: npm i three
	// ==========================================================================
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import { STLLoader } from 'three/addons/loaders/STLLoader.js';
	import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';

	let { modelBuffer = null, fileName = '', params = {}, onStats } = $props();

	let canvasEl, wrapEl;
	let renderer, scene, camera, controls, raf, ro;
	let partGroup = null;
	let partPositions = null; // Float32Array triangle soup (world) for the worker
	let bbox = null;

	let worker = null;
	let reqId = 0;
	let systemGroup = null; // worker-built pieces + fill + markers
	let overlayGroup = null; // block bbox layout
	let pending = null;
	let lastSig = '';

	let ready = $state(false);
	let parseError = $state('');
	let workerError = $state('');
	let computing = $state(false);
	let showOverlay = $state(true);
	let showPart = $state(true);
	let showFill = $state(false);
	let exploded = $state(true);
	let sectionCut = $state(false);
	let legendPieces = $state([]);
	let warnings = $state([]);

	const isBlock = (p) => !p.mould_system || p.mould_system === 'box';
	let blockNow = $derived(isBlock(params));
	let hasFillNow = $derived(!blockNow && !['fixture', 'shell'].includes(params.mould_system));
	let fillLabel = $derived(
		params.mould_system === 'slip' ? 'Plaster'
		: ['direct_open', 'direct_funnel'].includes(params.mould_system) ? 'Cast'
		: params.mould_system === 'skin' ? 'Skin'
		: params.mould_system === 'core' ? 'Silicone + cast'
		: 'Silicone'
	);

	// ---- palette -------------------------------------------------------------
	const PIECE_COLORS = { a: 0x3b82f6, b: 0x14b8a6, c: 0x8b5cf6, d: 0x06b6d4, top: 0xec4899, bot: 0x22c55e };
	const SYSTEM_PIECES = [0x3b82f6, 0x14b8a6, 0x8b5cf6, 0x06b6d4, 0xec4899, 0x6366f1, 0xf97316, 0x0ea5e9];
	const CORE_COLOR = 0xf59e0b;
	const FILL_COLOR = 0xfbbf24;
	const MASTER_ADD_COLOR = 0x64748b;
	const PILLAR_COLOR = 0x22c55e;
	const TRAP_COLOR = 0xef4444;
	const KEY_COLOR = 0xd4a017;
	const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
	const num = (v, d) => {
		const x = Number(v);
		return Number.isFinite(x) ? x : d;
	};

	function axisVec(a) {
		if (a === 'x') return new THREE.Vector3(1, 0, 0);
		if (a === 'y') return new THREE.Vector3(0, 1, 0);
		return new THREE.Vector3(0, 0, 1);
	}
	function axisQuat(a) {
		const q = new THREE.Quaternion();
		q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axisVec(a));
		return q;
	}

	// ---- scene setup ---------------------------------------------------------
	onMount(() => {
		renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.localClippingEnabled = true;
		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(40, 1, 0.1, 8000);
		camera.position.set(160, -180, 140);
		camera.up.set(0, 0, 1);
		controls = new OrbitControls(camera, canvasEl);
		controls.enableDamping = true;
		controls.dampingFactor = 0.08;
		scene.add(new THREE.AmbientLight(0xffffff, 0.62));
		const key = new THREE.DirectionalLight(0xffffff, 0.9);
		key.position.set(120, -160, 220);
		scene.add(key);
		const fill = new THREE.DirectionalLight(0xffffff, 0.35);
		fill.position.set(-140, 120, -60);
		scene.add(fill);

		try {
			worker = new Worker(new URL('../workers/mouldPreview.worker.js', import.meta.url), { type: 'module' });
			worker.onmessage = onWorkerMessage;
			worker.onerror = (e) => {
				computing = false;
				workerError = 'Preview engine failed to start — generation still works.';
				console.warn('Preview worker error:', e);
			};
		} catch (e) {
			workerError = 'Preview engine unavailable in this browser — generation still works.';
			console.warn('Preview worker unavailable:', e);
		}

		const resize = () => {
			if (!wrapEl) return;
			const w = wrapEl.clientWidth;
			const h = wrapEl.clientHeight || Math.max(280, Math.round(w * 0.62));
			renderer.setSize(w, h, false);
			camera.aspect = w / Math.max(1, h);
			camera.updateProjectionMatrix();
		};
		ro = new ResizeObserver(resize);
		ro.observe(wrapEl);
		resize();
		const loop = () => {
			raf = requestAnimationFrame(loop);
			controls.update();
			renderer.render(scene, camera);
		};
		loop();
		ready = true;
	});

	onDestroy(() => {
		if (ro) ro.disconnect();
		cancelAnimationFrame(raf);
		if (pending) clearTimeout(pending);
		if (worker) worker.terminate();
		disposeGroup(partGroup);
		disposeGroup(systemGroup);
		disposeGroup(overlayGroup);
		renderer && renderer.dispose();
	});

	function disposeGroup(g) {
		if (!g) return;
		g.traverse((o) => {
			if (o.geometry) o.geometry.dispose();
			if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
		});
		scene && scene.remove(g);
	}

	// ---- part loading --------------------------------------------------------
	function loadPart() {
		disposeGroup(partGroup);
		disposeGroup(systemGroup);
		partGroup = null;
		systemGroup = null;
		partPositions = null;
		bbox = null;
		parseError = '';
		warnings = [];
		lastSig = '';
		if (!ready || !modelBuffer) {
			rebuildOverlay();
			return;
		}
		const lower = (fileName || '').toLowerCase();
		try {
			const mat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.1, roughness: 0.75, side: THREE.DoubleSide });
			if (lower.endsWith('.stl')) {
				const geo = new STLLoader().parse(modelBuffer);
				geo.computeVertexNormals();
				partGroup = new THREE.Group();
				partGroup.add(new THREE.Mesh(geo, mat));
			} else if (lower.endsWith('.3mf')) {
				const grp = new ThreeMFLoader().parse(modelBuffer);
				grp.traverse((o) => {
					if (o.isMesh) o.material = mat;
				});
				partGroup = grp;
			} else {
				parseError = 'STEP files are tessellated on the server — the preview needs an STL or 3MF. Generation still works.';
			}
		} catch (e) {
			parseError = 'Could not preview this file — generation will still work.';
		}
		if (partGroup) {
			partGroup.visible = showPart;
			bbox = new THREE.Box3().setFromObject(partGroup);
			partPositions = extractPositions(partGroup);
			scene.add(partGroup);
			fitView();
		}
		rebuildOverlay();
	}

	function extractPositions(group) {
		group.updateWorldMatrix(true, true);
		const chunks = [];
		let total = 0;
		group.traverse((o) => {
			if (!o.isMesh || !o.geometry) return;
			const g = o.geometry;
			const pos = g.attributes.position;
			if (!pos) return;
			const m = o.matrixWorld;
			const idx = g.index;
			const count = idx ? idx.count : pos.count;
			const arr = new Float32Array(count * 3);
			const v = new THREE.Vector3();
			for (let n = 0; n < count; n++) {
				const vi = idx ? idx.getX(n) : n;
				v.set(pos.getX(vi), pos.getY(vi), pos.getZ(vi)).applyMatrix4(m);
				arr[n * 3] = v.x;
				arr[n * 3 + 1] = v.y;
				arr[n * 3 + 2] = v.z;
			}
			chunks.push(arr);
			total += arr.length;
		});
		if (!chunks.length) return null;
		if (chunks.length === 1) return chunks[0];
		const out = new Float32Array(total);
		let off = 0;
		for (const c of chunks) {
			out.set(c, off);
			off += c.length;
		}
		return out;
	}

	function fitView() {
		if (!bbox) return;
		const c = bbox.getCenter(new THREE.Vector3());
		const size = bbox.getSize(new THREE.Vector3()).length();
		controls.target.copy(c);
		const dir = new THREE.Vector3(1.0, -1.15, 0.85).normalize();
		camera.position.copy(c.clone().add(dir.multiplyScalar(size * 2.3)));
		camera.near = size / 100;
		camera.far = size * 30;
		camera.updateProjectionMatrix();
	}

	// ---- section view ----------------------------------------------------------
	function applySection() {
		if (!renderer) return;
		if (sectionCut && bbox) {
			const cy = (bbox.min.y + bbox.max.y) / 2;
			renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -cy)];
		} else {
			renderer.clippingPlanes = [];
		}
	}

	// ==========================================================================
	//  Worker systems
	// ==========================================================================
	// split rows -> world planes through the part centre
	function planesFromSplits() {
		if (!bbox) return [];
		const rows = Array.isArray(params.splits) ? params.splits : [];
		const c = bbox.getCenter(new THREE.Vector3());
		return rows.slice(0, 3).map((r) => {
			const a = (num(r.angle_deg, 0) * Math.PI) / 180;
			let n;
			if (r.axis === 'x') n = [Math.cos(a), Math.sin(a), 0];
			else if (r.axis === 'y') n = [-Math.sin(a), Math.cos(a), 0];
			else n = [0, -Math.sin(a), Math.cos(a)];
			const d = n[0] * c.x + n[1] * c.y + n[2] * c.z + num(r.offset_mm, 0);
			return { n, d };
		});
	}

	function workerParams() {
		const p = params;
		const sys = p.mould_system;
		const splitCapable = !['fixture'].includes(sys);
		return {
			system: sys,
			gap: num(p.silicone_gap_mm, 12),
			plaster: num(p.plaster_thickness_mm, 25),
			cavity_clr: num(p.direct_clearance_mm, 0.3),
			skin: num(p.skin_thickness_mm, 3),
			shell_clr: num(p.shell_clearance_mm, 1.5),
			fixture_clr: num(p.fixture_clearance_mm, 0.4),
			box_wall: num(p.box_wall_mm, 3),
			direct_wall: num(p.direct_wall_mm, 3),
			shell_wall: num(p.shell_wall_mm, 3),
			base_flange: num(p.base_flange_mm, 8),
			base_style: p.base_style === 'contour' ? 'contour' : 'rect',
			base_bolts: !!p.base_bolts,
			bolt_d: num(p.bolt_diameter_mm, 3.4),
			flange_t: num(p.flange_thickness_mm, 5),
			flange_reach: num(p.flange_reach_mm, 10),
			master_seat: !!p.master_seat,
			master_clr: num(p.master_clearance_mm, 0.3),
			master_seal: !!p.master_seal,
			base_keys: Math.round(num(p.base_key_count, 0)),
			base_key_d: num(p.base_key_diameter_mm, 6),
			foundation: num(p.foundation_mm, 0),
			air_detect: !!p.air_trap_detect,
			air_pillars: !!p.air_trap_pillars,
			pillar_d: num(p.pillar_diameter_mm, 3),
			pour_d: num(p.pour_diameter_mm, 14),
			pour_top_d: num(p.pour_top_diameter_mm, 24),
			risers: Math.round(num(p.riser_count, 0)),
			riser_d: num(p.riser_diameter_mm, 4),
			key_shape: p.key_shape || 'dome',
			key_count: Math.round(num(p.split_key_count, 4)),
			key_d: num(p.key_diameter_mm, 8),
			key_clr: num(p.key_clearance_mm, 0.2),
			clamp_holes: !!p.clamp_holes,
			clamp_d: num(p.clamp_hole_diameter_mm, 3.4),
			core_mode: p.core_mode || 'auto',
			cast_wall: num(p.cast_wall_mm, 3),
			core_draft: num(p.core_draft_deg, 1.5),
			spare_d: num(p.slip_spare_diameter_mm, 30),
			spare_h: num(p.slip_spare_height_mm, 25),
			trim: num(p.top_trim_mm, 0),
			fixture_depth: num(p.fixture_depth_pct, 40),
			fixture_margin: num(p.fixture_margin_mm, 8),
			fixture_base: num(p.fixture_base_mm, 4),
			planes: splitCapable ? planesFromSplits() : []
		};
	}

	function requestSystem() {
		if (!worker || !partPositions) return;
		const wp = workerParams();
		const sig = fileName + '|' + JSON.stringify(wp);
		if (sig === lastSig && systemGroup) return;
		lastSig = sig;
		if (pending) clearTimeout(pending);
		computing = true;
		workerError = '';
		pending = setTimeout(() => {
			const copy = partPositions.slice();
			const id = ++reqId;
			worker.postMessage({ id, positions: copy, res: partPositions.length > 3_000_000 ? 80 : 96, params: wp }, [copy.buffer]);
		}, 280);
	}

	function onWorkerMessage(ev) {
		const d = ev.data;
		if (d.id !== reqId) return; // stale result
		computing = false;
		if (!d.ok) {
			workerError = d.error || 'Preview failed.';
			warnings = [];
			disposeGroup(systemGroup);
			systemGroup = null;
			onStats?.(null);
			return;
		}
		buildSystemGroup(d);
		warnings = d.stats.warnings || [];
		onStats?.(d.stats);
	}

	function geoFrom(arr) {
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
		geo.computeVertexNormals();
		return geo;
	}

	function buildSystemGroup(d) {
		disposeGroup(systemGroup);
		systemGroup = new THREE.Group();
		const sz = bbox ? bbox.getSize(new THREE.Vector3()) : new THREE.Vector3(50, 50, 50);
		const maxd = Math.max(sz.x, sz.y, sz.z);
		let colorIdx = 0;
		const legend = [];

		for (const p of d.pieces) {
			if (!p.positions || p.positions.length < 9) continue;
			let color = SYSTEM_PIECES[colorIdx % SYSTEM_PIECES.length];
			let opacity = 0.9;
			if (p.role === 'mould') colorIdx++;
			else if (p.role === 'core') color = CORE_COLOR;
			else if (p.role === 'master_add') { color = MASTER_ADD_COLOR; opacity = 1; }
			else if (p.role === 'pillars') { color = PILLAR_COLOR; opacity = 1; }
			const mat = new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.6, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
			const mesh = new THREE.Mesh(geoFrom(p.positions), mat);
			mesh.userData = { role: p.role, dir: p.dir || [0, 0, 0] };
			systemGroup.add(mesh);
			legend.push({ c: color, l: `${p.label} · ${p.vol.toFixed(0)} cm³` });
		}

		const FILL_COLORS = { silicone: FILL_COLOR, plaster: 0xe2e8f0, cast: 0x84cc16, skin: 0xf472b6 };
		const FILL_NAMES = { silicone: 'Silicone', plaster: 'Plaster', cast: 'Cast', skin: 'Skin' };
		const fillTotals = {};
		for (const f of d.fills || []) {
			if (!f.positions || f.positions.length < 9) continue;
			const color = FILL_COLORS[f.kind] || FILL_COLOR;
			const split = f.dir && (f.dir[0] || f.dir[1] || f.dir[2]);
			const fm = new THREE.Mesh(
				geoFrom(f.positions),
				new THREE.MeshStandardMaterial({ color, roughness: 0.45, transparent: !split, opacity: split ? 1 : 0.5, depthWrite: !!split, side: THREE.DoubleSide })
			);
			fm.userData = { role: 'fill', dir: f.dir || [0, 0, 0] };
			fm.visible = showFill;
			systemGroup.add(fm);
			const label = f.label === f.kind ? FILL_NAMES[f.kind] : f.label;
			fillTotals[label] = { c: color, v: f.vol, kind: f.kind };
		}
		for (const [label, t] of Object.entries(fillTotals))
			legend.push({ c: t.c, l: `${label} ≈ ${t.v.toFixed(0)} ${t.kind === 'cast' ? 'cm³' : 'ml'}` });

		if (d.markers && d.markers.length) {
			const r = Math.max(1.5, maxd * 0.018);
			const mg = new THREE.SphereGeometry(r, 16, 12);
			const mm = new THREE.MeshBasicMaterial({ color: TRAP_COLOR });
			for (const m of d.markers) {
				const s = new THREE.Mesh(mg.clone(), mm.clone());
				s.position.set(m[0], m[1], m[2]);
				s.userData = { role: 'marker', dir: [0, 0, 0] };
				systemGroup.add(s);
			}
			mg.dispose();
			mm.dispose();
			legend.push({ c: TRAP_COLOR, l: `${d.markers.length} air trap${d.markers.length > 1 ? 's' : ''}${params.air_trap_pillars ? ' · pillars added' : ''}` });
		}

		const st = d.stats;
		if (st.keys) legend.push({ c: KEY_COLOR, l: `${st.keys} flange keys` });
		if (st.clamps) legend.push({ c: 0x475569, l: `${st.clamps} clamp / bolt holes` });
		if (st.base_keys) legend.push({ c: 0x475569, l: `${st.base_keys} base keys` });
		if (st.risers) legend.push({ c: 0x0ea5e9, l: `Pour funnel + ${st.risers} riser${st.risers > 1 ? 's' : ''}` });

		systemGroup.userData.explode = Math.max(6, 0.12 * maxd);
		systemGroup.userData.lift = Math.max(12, 0.35 * sz.z);
		applyExplode();
		systemGroup.visible = showOverlay;
		scene.add(systemGroup);
		legendPieces = legend;
	}

	function applyExplode() {
		if (!systemGroup) return;
		const e = systemGroup.userData.explode || 0;
		const lift = systemGroup.userData.lift || 0;
		systemGroup.traverse((o) => {
			if (!o.isMesh || !o.userData.dir) return;
			const [dx, dy, dz] = o.userData.dir;
			if (!exploded) { o.position.set(0, 0, 0); return; }
			if (o.userData.role === 'core') o.position.set(0, 0, dz ? lift : 0);
			else if (o.userData.role === 'fill') o.position.set(dx * e * 0.6, dy * e * 0.6, dz * e * 0.6);
			else o.position.set(dx * e, dy * e, dz * e);
		});
	}

	function applyFillVisibility() {
		if (!systemGroup) return;
		systemGroup.traverse((o) => {
			if (o.userData && o.userData.role === 'fill') o.visible = showFill;
		});
	}

	// ==========================================================================
	//  Overlay rebuild (block bbox layout OR trigger the worker)
	// ==========================================================================
	function rebuildOverlay() {
		if (!ready) return;
		disposeGroup(overlayGroup);
		overlayGroup = null;
		const p = params || {};

		if (!isBlock(p)) {
			if (systemGroup) systemGroup.visible = showOverlay;
			if (bbox && showOverlay) requestSystem();
			return;
		}

		// ---------- BLOCK / RADIAL (fast bbox layout) ----------
		if (systemGroup) {
			disposeGroup(systemGroup);
			systemGroup = null;
			lastSig = '';
		}
		warnings = [];
		onStats?.(null);
		overlayGroup = new THREE.Group();
		const legend = [];
		if (!bbox || !showOverlay) {
			scene.add(overlayGroup);
			legendPieces = legend;
			return;
		}
		const type = p.mould_type || 'two_part';
		const axis = p.parting_axis || 'z';
		const q = axisQuat(axis);
		const inv = q.clone().invert();
		const corners = [];
		for (const x of [bbox.min.x, bbox.max.x])
			for (const y of [bbox.min.y, bbox.max.y])
				for (const z of [bbox.min.z, bbox.max.z]) corners.push(new THREE.Vector3(x, y, z).applyQuaternion(inv));
		const lb = new THREE.Box3().setFromPoints(corners);
		const clr = +p.cavity_clearance_mm || 0;
		const wall = +p.wall_thickness_mm || 8;
		const pad = clr + wall;
		const bmin = lb.min.clone().subScalar(pad);
		const bmax = lb.max.clone().addScalar(pad);
		const bsz = bmax.clone().sub(bmin);
		const pc = lb.min.clone().add(lb.max).multiplyScalar(0.5);
		const partH = lb.max.z - lb.min.z;
		const gap = exploded ? Math.max(3, 0.055 * Math.max(bsz.x, bsz.y, bsz.z)) : 0;
		const local = new THREE.Group();
		const rect = [[bmin.x, bmin.y], [bmax.x, bmin.y], [bmax.x, bmax.y], [bmin.x, bmax.y]];
		const inv2 = Math.SQRT1_2;

		if (type === 'one_part') {
			addPiece(local, extrudePoly(rect, bmin.z, bmax.z), PIECE_COLORS.b, null);
			legend.push({ c: PIECE_COLORS.b, l: 'Open-pour block (pour from top)' });
		} else if (type === 'two_part') {
			let pz = p.parting_mode === 'offset' ? pc.z + (+p.parting_offset_mm || 0) : pc.z;
			pz = clampN(pz, lb.min.z, lb.max.z);
			addPiece(local, extrudePoly(rect, pz, bmax.z), PIECE_COLORS.a, new THREE.Vector3(0, 0, gap));
			addPiece(local, extrudePoly(rect, bmin.z, pz), PIECE_COLORS.b, new THREE.Vector3(0, 0, -gap));
			legend.push({ c: PIECE_COLORS.a, l: 'Half A · pulls up' });
			legend.push({ c: PIECE_COLORS.b, l: 'Half B · pulls down' });
			if (p.parting_mode === 'auto') legend.push({ c: 0x94a3b8, l: 'Parting height: auto (server-optimised)' });
		} else {
			const six = type === 'six_part';
			const capBot = six ? lb.min.z + partH * 0.22 : bmin.z;
			const capTop = six ? lb.max.z - partH * 0.22 : bmax.z;
			const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
			const cols = [PIECE_COLORS.a, PIECE_COLORS.b, PIECE_COLORS.c, PIECE_COLORS.d];
			const names = ['+X wedge', '+Y wedge', '−X wedge', '−Y wedge'];
			for (let idx = 0; idx < 4; idx++) {
				const dd = dirs[idx];
				let poly = rect.map((pt) => [pt[0] - pc.x, pt[1] - pc.y]);
				poly = clipPoly(poly, (dd[0] - -dd[1]) * inv2, (dd[1] - dd[0]) * inv2, 0);
				poly = clipPoly(poly, (dd[0] + -dd[1]) * inv2, (dd[1] + dd[0]) * inv2, 0);
				if (poly.length < 3) continue;
				const world = poly.map((pt) => [pt[0] + pc.x, pt[1] + pc.y]);
				addPiece(local, extrudePoly(world, capBot, capTop), cols[idx], new THREE.Vector3(dd[0] * gap, dd[1] * gap, 0));
				legend.push({ c: cols[idx], l: `${names[idx]} · pulls out ${names[idx].includes('X') ? 'X' : 'Y'}` });
			}
			if (six) {
				addPiece(local, extrudePoly(rect, capTop, bmax.z), PIECE_COLORS.top, new THREE.Vector3(0, 0, gap * 1.3));
				addPiece(local, extrudePoly(rect, bmin.z, capBot), PIECE_COLORS.bot, new THREE.Vector3(0, 0, -gap * 1.3));
				legend.push({ c: PIECE_COLORS.top, l: 'Top cap · pulls up' });
				legend.push({ c: PIECE_COLORS.bot, l: 'Bottom cap · pulls down' });
			}
		}

		const gate = p.gate_type || 'top';
		if (type !== 'one_part' && gate !== 'none') {
			const sr = Math.max(0.5, (+p.sprue_diameter_mm || 6) * 0.5);
			const zTop = bmax.z + (type === 'two_part' || type === 'six_part' ? gap : 0);
			const sx = pc.x + (+p.sprue_offset_x_mm || 0);
			const sy = pc.y + (+p.sprue_offset_y_mm || 0);
			const zLand = Math.max(lb.max.z - 2, pc.z);
			const sprue = new THREE.Mesh(new THREE.CylinderGeometry(sr, sr, zTop - zLand, 24), new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.55 }));
			sprue.rotation.x = Math.PI / 2;
			sprue.position.set(sx, sy, (zTop + zLand) / 2);
			local.add(sprue);
			legend.push({ c: 0x0ea5e9, l: `Sprue Ø${p.sprue_diameter_mm || 6}` });
		}

		if (p.key_shape && p.key_shape !== 'none' && type === 'two_part') {
			const kr = Math.max(1, (+p.key_diameter_mm || 8) * 0.5);
			const keyMat = new THREE.MeshBasicMaterial({ color: KEY_COLOR, transparent: true, opacity: 0.9 });
			let pz = p.parting_mode === 'offset' ? pc.z + (+p.parting_offset_mm || 0) : pc.z;
			pz = clampN(pz, lb.min.z, lb.max.z);
			const roK = clr + wall * 0.5, d7 = roK * 0.707;
			const pts = [[lb.max.x + d7, lb.max.y + d7], [lb.min.x - d7, lb.min.y - d7], [lb.max.x + d7, lb.min.y - d7], [lb.min.x - d7, lb.max.y + d7], [pc.x, lb.max.y + roK], [pc.x, lb.min.y - roK]].slice(0, Math.max(2, Math.min(6, +p.key_count || 4)));
			for (const [x, y] of pts) {
				const s = new THREE.Mesh(new THREE.SphereGeometry(kr, 16, 12), keyMat);
				s.position.set(x, y, pz - gap);
				local.add(s);
			}
			legend.push({ c: KEY_COLOR, l: `${pts.length} registration keys Ø${p.key_diameter_mm || 8}` });
		}

		local.quaternion.copy(q);
		overlayGroup.add(local);
		scene.add(overlayGroup);
		legendPieces = legend;
	}

	function pieceMat(color, opacity = 0.16) {
		return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
	}
	function pieceEdges(geo, color, opacity = 0.75) {
		return new THREE.LineSegments(new THREE.EdgesGeometry(geo, 12), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
	}
	function addPiece(parent, geo, color, offset, opacity = 0.16) {
		const grp = new THREE.Group();
		grp.add(new THREE.Mesh(geo, pieceMat(color, opacity)));
		grp.add(pieceEdges(geo, color));
		if (offset && exploded) grp.position.copy(offset);
		parent.add(grp);
	}
	function clipPoly(poly, nx, ny, k) {
		const out = [];
		for (let i = 0; i < poly.length; i++) {
			const a = poly[i], b = poly[(i + 1) % poly.length];
			const da = a[0] * nx + a[1] * ny - k, db = b[0] * nx + b[1] * ny - k;
			if (da >= 0) out.push(a);
			if (da >= 0 !== db >= 0) {
				const t = da / (da - db);
				out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
			}
		}
		return out;
	}
	function extrudePoly(poly, z0, z1) {
		const shape = new THREE.Shape();
		shape.moveTo(poly[0][0], poly[0][1]);
		for (let i = 1; i < poly.length; i++) shape.lineTo(poly[i][0], poly[i][1]);
		shape.closePath();
		const geo = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false });
		geo.translate(0, 0, z0);
		return geo;
	}

	function toHex(c) {
		return c.toString(16).padStart(6, '0');
	}

	// ---- reactivity ----------------------------------------------------------
	let paramSig = $derived(JSON.stringify(params));
	$effect(() => {
		modelBuffer;
		fileName;
		if (ready) loadPart();
	});
	$effect(() => {
		paramSig;
		showOverlay;
		if (ready) rebuildOverlay();
	});
	$effect(() => {
		exploded;
		if (!ready) return;
		if (blockNow) rebuildOverlay();
		else applyExplode();
	});
	$effect(() => {
		showFill;
		applyFillVisibility();
	});
	$effect(() => {
		sectionCut;
		if (ready) applySection();
	});
	$effect(() => {
		if (partGroup) partGroup.visible = showPart;
	});
	$effect(() => {
		if (systemGroup) systemGroup.visible = showOverlay;
	});

	const NOTES = {
		box: 'Live layout preview. Cavity sweeps, undercut relief and optimised parting planes are computed on the server.',
		adaptive: 'Shape-following jacket built from a distance field. Split planes, flange keys, clamp holes, base keys and pour funnel are real geometry.',
		multipart: 'Jacket and silicone are both cut on every split plane; silicone pieces get round natches. Toggle “Silicone” to see them.',
		core: 'Vessels: the jacket stays open at the mouth and a drafted core with a T-bar drops in to hollow the cast. Bores (rings, tubes) are plugged instead. Toggle “Silicone + cast” to see the hollow cast.',
		slip: 'Open-top case for pouring the plaster mould — the gap is the plaster wall. Toggle “Plaster” to see the keyed plaster pieces; the spare forms the pour opening.',
		tray: 'One-piece open tray. The master nests in the base; silicone is poured over the top.',
		direct_open: 'Rigid mould you cast straight into. The base is open — flip it and pour.',
		direct_funnel: 'Closed rigid mould with a top funnel and risers at the high points.',
		skin: 'Printed core (master + base) and an outer shell; the gap between them forms the skin.',
		fixture: 'Holder block with a drop-in pocket swept straight up so the part lifts out, plus finger notches.',
		shell: 'Fitted clamshell case with mating flange and keys.'
	};
</script>

<div class="preview" bind:this={wrapEl}>
	<canvas bind:this={canvasEl}></canvas>

	<div class="pv-toolbar">
		<button type="button" class="pv-btn" onclick={fitView} title="Fit view">⤢ Fit</button>
		<button type="button" class="pv-btn {showOverlay ? 'on' : ''}" onclick={() => (showOverlay = !showOverlay)}>Mould</button>
		<button type="button" class="pv-btn {showPart ? 'on' : ''}" onclick={() => (showPart = !showPart)}>{blockNow ? 'Part' : 'Master'}</button>
		{#if hasFillNow}
			<button type="button" class="pv-btn {showFill ? 'on' : ''}" onclick={() => (showFill = !showFill)}>{fillLabel}</button>
		{/if}
		<button type="button" class="pv-btn {exploded ? 'on' : ''}" onclick={() => (exploded = !exploded)}>Exploded</button>
		<button type="button" class="pv-btn {sectionCut ? 'on' : ''}" onclick={() => (sectionCut = !sectionCut)} title="Cut the view in half to see inside">Section</button>
	</div>

	{#if computing}
		<div class="pv-computing"><span class="spin"></span> Building mould preview…</div>
	{/if}

	<div class="pv-legend">
		{#each legendPieces as lp}
			<span class="chip"><i style="background:#{toHex(lp.c)}"></i>{lp.l}</span>
		{/each}
	</div>

	{#if parseError}
		<p class="pv-note">{parseError}</p>
	{:else if workerError}
		<p class="pv-note warn">{workerError}</p>
	{:else if warnings.length}
		<p class="pv-note warn">{warnings.join(' ')}</p>
	{:else}
		<p class="pv-note">{NOTES[params.mould_system || 'box'] || NOTES.box}</p>
	{/if}
</div>

<style>
	.preview { position: relative; width: 100%; height: 100%; overflow: hidden; background: #eef2f7; }
	canvas { display: block; width: 100%; height: 100%; }
	.pv-toolbar { position: absolute; top: 12px; left: 12px; right: 190px; display: flex; flex-wrap: wrap; gap: 6px; }
	.pv-btn { font-family: inherit; font-size: 11.5px; font-weight: 600; color: #475569; background: rgba(255, 255, 255, 0.92); border: 1px solid #e2e8f0; border-radius: 999px; padding: 6px 12px; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
	.pv-btn:hover { border-color: #cbd5e1; }
	.pv-btn.on { color: #6d28d9; border-color: #ddd6fe; background: #f5f3ff; }
	.pv-computing { position: absolute; top: 12px; right: 12px; display: flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 600; color: #6d28d9; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 999px; padding: 6px 12px; }
	.spin { width: 11px; height: 11px; border: 2px solid #ddd6fe; border-top-color: #6d28d9; border-radius: 50%; display: inline-block; animation: spin 0.7s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.pv-legend { position: absolute; bottom: 46px; left: 12px; right: 12px; display: flex; flex-wrap: wrap; gap: 6px; pointer-events: none; }
	.chip { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 600; color: #475569; background: rgba(255, 255, 255, 0.9); border: 1px solid #e2e8f0; border-radius: 999px; padding: 3px 9px; }
	.chip i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
	.pv-note { position: absolute; bottom: 0; left: 0; right: 0; margin: 0; padding: 8px 12px; font-size: 11.5px; line-height: 1.45; color: #64748b; background: rgba(255, 255, 255, 0.92); border-top: 1px solid #e2e8f0; }
	.pv-note.warn { color: #92400e; background: #fffbeb; border-top-color: #fde68a; }
	@media (max-width: 720px) {
		.pv-toolbar { right: 12px; }
		.pv-computing { top: auto; bottom: 90px; }
	}
	@media (prefers-reduced-motion: reduce) {
		.spin { animation: none; }
	}
</style>