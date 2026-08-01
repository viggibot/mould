<script>
	// ==========================================================================
	// MouldPreview — live 3D preview of the mould.
	//   • Block: fast bounding-box layout (rectangular mould).
	//   • Silicone: an ACCURATE offset shell computed in a Web Worker (coarse
	//     signed-distance field + surface nets — the server pipeline in
	//     miniature). This follows the real part with no normal-inflation
	//     spikes, takes ~1s, and never blocks the UI.
	// Requires: npm i three
	// ==========================================================================
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import { STLLoader } from 'three/addons/loaders/STLLoader.js';
	import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';

	let { modelBuffer = null, fileName = '', params = {} } = $props();

	let canvasEl, wrapEl;
	let renderer, scene, camera, controls, raf, ro;
	let partGroup = null;
	let partPositions = null; // Float32Array triangle soup (world) for the worker
	let bbox = null;

	let worker = null;
	let workerUrl = null;
	let reqId = 0;
	let mouldGroup = null; // worker-built silicone mould meshes
	let pending = null; // debounce timer
	let lastSig = ''; // signature of geometry-affecting params

	let ready = $state(false);
	let parseError = $state('');
	let computing = $state(false);
	let showOverlay = $state(true);
	let showPart = $state(true);
	let exploded = $state(true);
	let legendPieces = $state([]);

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

	// ---- worker (blob) -------------------------------------------------------
	const WORKER_SRC = '// ==========================================================================\n// MouldStudio preview worker — builds an ACCURATE mould-shell preview from the\n// part mesh using a coarse signed-distance field + surface nets (the same\n// approach as the server, in miniature). Runs off the main thread so the UI\n// stays responsive; ~1s for a typical part at res 84.\n//\n// Pipeline: surface-voxelize the part -> flood-fill inside/outside -> exact\n// Euclidean distance transform (Felzenszwalb) -> signed field -> compose the\n// mould SDF (offset shell + base plate + open top + nesting pocket) exactly\n// like the backend -> surface-nets mesh. Also emits the silicone envelope.\n//\n// The offset (gap ~12mm) smooths away fine detail, so the output is a clean\n// blob following the part — no spikes, unlike normal-inflation.\n// ==========================================================================\n\n// ---- exact 1D squared-distance transform (lower envelope of parabolas) ----\nfunction edt1d(f, d, n, stride, base) {\n	const v = new Int32Array(n);\n	const z = new Float64Array(n + 1);\n	let k = 0;\n	v[0] = 0;\n	z[0] = -Infinity;\n	z[1] = Infinity;\n	for (let q = 1; q < n; q++) {\n		let s;\n		while (true) {\n			const vk = v[k];\n			s = (f[base + q * stride] + q * q - (f[base + vk * stride] + vk * vk)) / (2 * q - 2 * vk);\n			if (s <= z[k]) k--;\n			else break;\n		}\n		k++;\n		v[k] = q;\n		z[k] = s;\n		z[k + 1] = Infinity;\n	}\n	k = 0;\n	for (let q = 0; q < n; q++) {\n		while (z[k + 1] < q) k++;\n		const vk = v[k];\n		d[q] = (q - vk) * (q - vk) + f[base + vk * stride];\n	}\n}\n\nfunction distanceTransform(field, nx, ny, nz) {\n	// field holds 0 at feature voxels, INF elsewhere; returns sqrt EDT in place\n	const INF = 1e20;\n	const tmp = new Float64Array(Math.max(nx, ny, nz));\n	// X\n	for (let k = 0; k < nz; k++)\n		for (let j = 0; j < ny; j++) {\n			const base = (k * ny + j) * nx;\n			edt1d(field, tmp, nx, 1, base);\n			for (let i = 0; i < nx; i++) field[base + i] = tmp[i];\n		}\n	// Y\n	for (let k = 0; k < nz; k++)\n		for (let i = 0; i < nx; i++) {\n			const base = k * ny * nx + i;\n			edt1d(field, tmp, ny, nx, base);\n			for (let j = 0; j < ny; j++) field[base + j * nx] = tmp[j];\n		}\n	// Z\n	for (let j = 0; j < ny; j++)\n		for (let i = 0; i < nx; i++) {\n			const base = j * nx + i;\n			edt1d(field, tmp, nz, ny * nx, base);\n			for (let k = 0; k < nz; k++) field[base + k * ny * nx] = tmp[k];\n		}\n	for (let n = 0; n < field.length; n++) field[n] = Math.sqrt(field[n]);\n	return field;\n}\n\n// ---- naive but robust surface nets ----------------------------------------\nconst SN_CUBE = [\n	[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],\n	[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]\n];\nconst SN_EDGES = [\n	[0, 1], [2, 3], [4, 5], [6, 7],\n	[0, 2], [1, 3], [4, 6], [5, 7],\n	[0, 4], [1, 5], [2, 6], [3, 7]\n];\n\nfunction surfaceNets(sdf, nx, ny, nz, h, lo) {\n	const nxy = nx * ny;\n	const vidx = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);\n	const verts = [];\n	const cidx = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;\n	const val = (i, j, k) => sdf[(k * ny + j) * nx + i];\n	// place one vertex per crossing cell\n	for (let k = 0; k < nz - 1; k++)\n		for (let j = 0; j < ny - 1; j++)\n			for (let i = 0; i < nx - 1; i++) {\n				let mask = 0;\n				const cv = [];\n				for (let c = 0; c < 8; c++) {\n					const v = val(i + SN_CUBE[c][0], j + SN_CUBE[c][1], k + SN_CUBE[c][2]);\n					cv.push(v);\n					if (v < 0) mask |= 1 << c;\n				}\n				if (mask === 0 || mask === 255) continue;\n				let px = 0, py = 0, pz = 0, n = 0;\n				for (const [a, b] of SN_EDGES) {\n					const va = cv[a], vb = cv[b];\n					if ((va < 0) === (vb < 0)) continue;\n					const t = va / (va - vb);\n					px += SN_CUBE[a][0] + t * (SN_CUBE[b][0] - SN_CUBE[a][0]);\n					py += SN_CUBE[a][1] + t * (SN_CUBE[b][1] - SN_CUBE[a][1]);\n					pz += SN_CUBE[a][2] + t * (SN_CUBE[b][2] - SN_CUBE[a][2]);\n					n++;\n				}\n				if (n === 0) continue;\n				vidx[cidx(i, j, k)] = verts.length / 3;\n				verts.push(lo[0] + (i + px / n) * h, lo[1] + (j + py / n) * h, lo[2] + (k + pz / n) * h);\n			}\n	// stitch quads across each sign-changing grid edge (3 principal dirs)\n	const tris = [];\n	const quad = (a, b, c, d, flip) => {\n		if (a < 0 || b < 0 || c < 0 || d < 0) return;\n		if (!flip) { tris.push(a, b, c, a, c, d); }\n		else { tris.push(a, c, b, a, d, c); }\n	};\n	for (let k = 1; k < nz - 1; k++)\n		for (let j = 1; j < ny - 1; j++)\n			for (let i = 1; i < nx - 1; i++) {\n				const s0 = val(i, j, k) < 0;\n				// +X edge\n				if (s0 !== val(i + 1, j, k) < 0) {\n					quad(vidx[cidx(i, j - 1, k - 1)], vidx[cidx(i, j, k - 1)], vidx[cidx(i, j, k)], vidx[cidx(i, j - 1, k)], s0);\n				}\n				// +Y edge\n				if (s0 !== val(i, j + 1, k) < 0) {\n					quad(vidx[cidx(i - 1, j, k - 1)], vidx[cidx(i - 1, j, k)], vidx[cidx(i, j, k)], vidx[cidx(i, j, k - 1)], s0);\n				}\n				// +Z edge\n				if (s0 !== val(i, j, k + 1) < 0) {\n					quad(vidx[cidx(i - 1, j - 1, k)], vidx[cidx(i, j - 1, k)], vidx[cidx(i, j, k)], vidx[cidx(i - 1, j, k)], s0);\n				}\n			}\n	// build non-indexed positions for three.js (with computed normals later)\n	const out = new Float32Array(tris.length * 3);\n	for (let t = 0; t < tris.length; t++) {\n		out[t * 3] = verts[tris[t] * 3];\n		out[t * 3 + 1] = verts[tris[t] * 3 + 1];\n		out[t * 3 + 2] = verts[tris[t] * 3 + 2];\n	}\n	return out;\n}\n\n// ---- main build ------------------------------------------------------------\nfunction buildMould(positions, P, res) {\n	// AABB of the part\n	let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;\n	for (let i = 0; i < positions.length; i += 3) {\n		const x = positions[i], y = positions[i + 1], z = positions[i + 2];\n		if (x < mnx) mnx = x; if (y < mny) mny = y; if (z < mnz) mnz = z;\n		if (x > mxx) mxx = x; if (y > mxy) mxy = y; if (z > mxz) mxz = z;\n	}\n	const gap = P.gap, wall = P.wall, flange = P.flange;\n	const partH = mxz - mnz;\n	const embed = Math.min(Math.max(partH * 0.08, 3), 12);\n	const baseTop = mnz + embed;\n	const baseTh = Math.max(wall * 1.6, 4);\n	const baseBot = mnz - baseTh;\n	const openZ = mxz + Math.min(Math.max(gap * 1.5, 10), 45);\n	const pad = gap + wall + Math.max(flange, 10) + 2;\n	const lo = [mnx - pad, mny - pad, baseBot - 2];\n	const hi = [mxx + pad, mxy + pad, openZ + 3];\n\n	// grid resolution (cap total voxels for speed)\n	const maxdim = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);\n	let h = maxdim / Math.max(24, res);\n	let nx, ny, nz;\n	const dims = () => {\n		nx = Math.ceil((hi[0] - lo[0]) / h) + 3;\n		ny = Math.ceil((hi[1] - lo[1]) / h) + 3;\n		nz = Math.ceil((hi[2] - lo[2]) / h) + 3;\n	};\n	dims();\n	const CAP = 3_000_000;\n	while (nx * ny * nz > CAP) { h *= 1.12; dims(); }\n	const nxy = nx * ny, n = nx * ny * nz;\n\n	// ---- surface voxelization (barycentric sampling seals the shell) --------\n	const occ = new Uint8Array(n);\n	const mark = (x, y, z) => {\n		const i = Math.round((x - lo[0]) / h);\n		const j = Math.round((y - lo[1]) / h);\n		const k = Math.round((z - lo[2]) / h);\n		if (i >= 0 && i < nx && j >= 0 && j < ny && k >= 0 && k < nz) occ[(k * ny + j) * nx + i] = 1;\n	};\n	for (let t = 0; t < positions.length; t += 9) {\n		const ax = positions[t], ay = positions[t + 1], az = positions[t + 2];\n		const bx = positions[t + 3], by = positions[t + 4], bz = positions[t + 5];\n		const cx = positions[t + 6], cy = positions[t + 7], cz = positions[t + 8];\n		const e1 = Math.hypot(bx - ax, by - ay, bz - az);\n		const e2 = Math.hypot(cx - ax, cy - ay, cz - az);\n		const e3 = Math.hypot(cx - bx, cy - by, cz - bz);\n		// sample at <=0.5*voxel spacing so every crossed voxel is marked (seals\n		// the shell for the flood fill — sparse sampling leaks and makes noise)\n		const N = Math.min(64, Math.max(1, Math.ceil(Math.max(e1, e2, e3) / (0.5 * h))));\n		const inv = 1 / N;\n		for (let u = 0; u <= N; u++)\n			for (let vv = 0; vv <= N - u; vv++) {\n				const s = u * inv, tt = vv * inv;\n				mark(ax + (bx - ax) * s + (cx - ax) * tt, ay + (by - ay) * s + (cy - ay) * tt, az + (bz - az) * s + (cz - az) * tt);\n			}\n	}\n\n	// ---- flood fill outside from the grid boundary --------------------------\n	const outside = new Uint8Array(n);\n	const stack = [];\n	const push = (idx) => { if (!outside[idx] && !occ[idx]) { outside[idx] = 1; stack.push(idx); } };\n	for (let k = 0; k < nz; k++)\n		for (let j = 0; j < ny; j++)\n			for (let i = 0; i < nx; i++)\n				if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1)\n					push((k * ny + j) * nx + i);\n	while (stack.length) {\n		const idx = stack.pop();\n		const i = idx % nx, j = ((idx / nx) | 0) % ny, k = (idx / nxy) | 0;\n		if (i > 0) push(idx - 1);\n		if (i < nx - 1) push(idx + 1);\n		if (j > 0) push(idx - nx);\n		if (j < ny - 1) push(idx + nx);\n		if (k > 0) push(idx - nxy);\n		if (k < nz - 1) push(idx + nxy);\n	}\n\n	// ---- signed distance ----------------------------------------------------\n	const INF = 1e20;\n	const df = new Float64Array(n);\n	for (let idx = 0; idx < n; idx++) df[idx] = occ[idx] ? 0 : INF;\n	distanceTransform(df, nx, ny, nz);\n	const sdf = new Float32Array(n);\n	for (let idx = 0; idx < n; idx++) {\n		const d = df[idx] * h;\n		// occ = surface (~0); reachable from boundary = outside (+); else inside (-)\n		sdf[idx] = occ[idx] ? 0 : outside[idx] ? d : -d;\n	}\n\n	// ---- compose the mould + envelope fields (matches the backend) ----------\n	const bx0 = mnx - (gap + wall + flange), bx1 = mxx + (gap + wall + flange);\n	const by0 = mny - (gap + wall + flange), by1 = mxy + (gap + wall + flange);\n	const boxSD = (x, y, z, x0, y0, z0, x1, y1, z1) => {\n		const dx = Math.max(x0 - x, x - x1), dy = Math.max(y0 - y, y - y1), dz = Math.max(z0 - z, z - z1);\n		const ox = Math.max(dx, 0), oy = Math.max(dy, 0), oz = Math.max(dz, 0);\n		return Math.hypot(ox, oy, oz) + Math.min(Math.max(dx, Math.max(dy, dz)), 0);\n	};\n	// XY silhouette (min SDF down the Z column) — for the open pour collar\n	const sil2 = new Float32Array(nx * ny).fill(1e20);\n	for (let k = 0; k < nz; k++)\n		for (let j = 0; j < ny; j++) {\n			const row = (k * ny + j) * nx;\n			const r2 = j * nx;\n			for (let i = 0; i < nx; i++) {\n				const v = sdf[row + i];\n				if (v < sil2[r2 + i]) sil2[r2 + i] = v;\n			}\n		}\n\n	const mould = new Float32Array(n);\n	for (let k = 0; k < nz; k++) {\n		const z = lo[2] + k * h;\n		for (let j = 0; j < ny; j++) {\n			const y = lo[1] + j * h;\n			for (let i = 0; i < nx; i++) {\n				const x = lo[0] + i * h;\n				const s = sdf[(k * ny + j) * nx + i];\n				const sd2 = sil2[j * nx + i];\n				// jacket wall hugging the part, CAPPED at the part top (no dome)\n				let shell = Math.max(Math.max(s - (gap + wall), gap - s), z - mxz);\n				// open-centred pour collar above the part (silhouette tube)\n				const collarWall = Math.max(sd2 - (gap + wall), gap - sd2);\n				const collar = Math.max(collarWall, (mxz - wall) - z);\n				let m = Math.min(shell, collar);\n				// base plate\n				const base = boxSD(x, y, z, bx0, by0, baseBot, bx1, by1, baseTop);\n				m = Math.min(m, base);\n				// open top at the pour line\n				m = Math.max(m, z - openZ);\n				// master nesting pocket (carve part below base top)\n				const pocket = Math.max(s - 0.3, z - baseTop);\n				m = Math.max(m, -pocket);\n				mould[(k * ny + j) * nx + i] = m;\n			}\n		}\n	}\n\n	const mouldPos = surfaceNets(mould, nx, ny, nz, h, lo);\n	const envPos = new Float32Array(0);\n	return {\n		mould: mouldPos,\n		envelope: envPos,\n		meta: { baseTop, baseBot, openZ, partTop: mxz, partBot: mnz, nx, ny, nz, h, voxels: n, triCount: mouldPos.length / 9 }\n	};\n}\n\nself.onmessage = function (ev) {\n	var d = ev.data;\n	try {\n		var r = buildMould(d.positions, d.params, d.res || 84);\n		self.postMessage({ id: d.id, ok: true, mould: r.mould, envelope: r.envelope, meta: r.meta }, [r.mould.buffer, r.envelope.buffer]);\n	} catch (err) {\n		self.postMessage({ id: d.id, ok: false, error: String((err && err.message) || err) });\n	}\n};\n';

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
		scene.add(new THREE.AmbientLight(0xffffff, 0.68));
		const key = new THREE.DirectionalLight(0xffffff, 0.85);
		key.position.set(120, -160, 220);
		scene.add(key);
		const fill = new THREE.DirectionalLight(0xffffff, 0.32);
		fill.position.set(-140, 120, -60);
		scene.add(fill);

		try {
			const blob = new Blob([WORKER_SRC], { type: 'application/javascript' });
			workerUrl = URL.createObjectURL(blob);
			worker = new Worker(workerUrl);
			worker.onmessage = onWorkerMessage;
		} catch (e) {
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
		if (workerUrl) URL.revokeObjectURL(workerUrl);
		disposeGroup(partGroup);
		disposeGroup(mouldGroup);
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
		if (!ready || !modelBuffer) {
			disposeGroup(partGroup);
			disposeGroup(mouldGroup);
			partGroup = null;
			partPositions = null;
			bbox = null;
			rebuildOverlay();
			return;
		}
		disposeGroup(partGroup);
		disposeGroup(mouldGroup);
		partGroup = null;
		mouldGroup = null;
		partPositions = null;
		bbox = null;
		parseError = '';
		lastSig = '';
		const lower = (fileName || '').toLowerCase();
		try {
			const mat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.1, roughness: 0.75 });
			if (lower.endsWith('.stl')) {
				const geo = new STLLoader().parse(modelBuffer);
				geo.computeVertexNormals();
				partGroup = new THREE.Group();
				partGroup.add(new THREE.Mesh(geo, mat));
			} else if (lower.endsWith('.3mf')) {
				const grp = new ThreeMFLoader().parse(modelBuffer);
				grp.traverse((o) => { if (o.isMesh) o.material = mat; });
				partGroup = grp;
			} else {
				parseError = 'STEP preview is processed on the server — the layout overlay below still reflects your settings.';
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

	// merge part meshes into a world-space triangle soup (Float32Array)
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
				arr[n * 3] = v.x; arr[n * 3 + 1] = v.y; arr[n * 3 + 2] = v.z;
			}
			chunks.push(arr);
			total += arr.length;
		});
		if (!chunks.length) return null;
		if (chunks.length === 1) return chunks[0];
		const out = new Float32Array(total);
		let off = 0;
		for (const c of chunks) { out.set(c, off); off += c.length; }
		return out;
	}

	function fitView() {
		if (!bbox) return;
		const c = bbox.getCenter(new THREE.Vector3());
		const size = bbox.getSize(new THREE.Vector3()).length();
		controls.target.copy(c);
		const dir = new THREE.Vector3(1.0, -1.15, 0.85).normalize();
		camera.position.copy(c.clone().add(dir.multiplyScalar(size * 2.1)));
		camera.near = size / 100;
		camera.far = size * 30;
		camera.updateProjectionMatrix();
	}

	// ---- palette + block helpers --------------------------------------------
	const PIECE_COLORS = { a: 0x3b82f6, b: 0x14b8a6, c: 0x8b5cf6, d: 0x06b6d4, top: 0xec4899, bot: 0x22c55e };
	const SILICONE_COLOR = 0xf59e0b;
	const FRAME_COLOR = 0x3b82f6;
	const KEY_COLOR = 0xd4a017;
	const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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
			if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
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

	// ==========================================================================
	//  Silicone: ask the worker for the accurate mould, render when it returns
	// ==========================================================================
	function siliconeSignature() {
		const p = params;
		return [fileName, p.silicone_gap_mm, p.box_wall_mm, p.base_flange_mm, p.parting_axis, p.parting_mode, p.parting_offset_mm].join('|');
	}

	function requestSiliconeMould() {
		if (!worker || !partPositions) return;
		const sig = siliconeSignature();
		if (sig === lastSig && mouldGroup) return; // already up to date
		lastSig = sig;
		if (pending) clearTimeout(pending);
		computing = true;
		pending = setTimeout(() => {
			const copy = partPositions.slice(); // keep ours; transfer the copy
			const id = ++reqId;
			worker.postMessage(
				{
					id,
					positions: copy,
					res: partPositions.length > 3_000_000 ? 74 : 88,
					params: { gap: +params.silicone_gap_mm || 12, wall: +params.box_wall_mm || 3, flange: +params.base_flange_mm || 8 }
				},
				[copy.buffer]
			);
		}, 250);
	}

	function onWorkerMessage(ev) {
		const d = ev.data;
		if (d.id !== reqId) return; // stale
		computing = false;
		if (!d.ok) { console.warn('Preview worker error:', d.error); return; }
		buildMouldGroup(d);
	}

	function buildMouldGroup(d) {
		disposeGroup(mouldGroup);
		mouldGroup = new THREE.Group();

		const p = params;
		const sa = p.parting_axis === 'x' ? 0 : p.parting_axis === 'y' ? 1 : 2;
		const twoPart = p.mould_type !== 'one_part';
		const off = p.parting_mode === 'offset' ? +p.parting_offset_mm || 0 : 0;
		// split position along the split axis (X/Y at part centre, Z at part mid)
		const cx = (bbox.min.x + bbox.max.x) / 2, cy = (bbox.min.y + bbox.max.y) / 2;
		const cz = (d.meta.partBot + d.meta.partTop) / 2;
		const splitPos = sa === 0 ? cx + off : sa === 1 ? cy + off : cz + off;
		const sz = bbox.getSize(new THREE.Vector3());
		const gexp = exploded ? Math.max(6, 0.1 * Math.max(sz.x, sz.y, sz.z)) : 0;
		const nAxis = axisVec(p.parting_axis);
		const zDown = new THREE.Vector3(0, 0, -1);

		// mould geometry from the worker (world space, base-down)
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(d.mould, 3));
		geo.computeVertexNormals();

		// Clean, OPAQUE-ish halves with real depth writing — no stacked
		// translucent double-sided fog (that read as "noise"). A slight
		// transparency lets the master show through when exploded.
		const shellMat = (planes) =>
			new THREE.MeshStandardMaterial({
				color: FRAME_COLOR,
				metalness: 0.0,
				roughness: 0.62,
				transparent: true,
				opacity: 0.88,
				depthWrite: true,
				side: THREE.DoubleSide,
				clippingPlanes: planes,
				clipShadows: false
			});
		const edgeMat = new THREE.LineBasicMaterial({ color: 0x1e3a8a, transparent: true, opacity: 0.25 });

		if (twoPart) {
			const planeA = new THREE.Plane(nAxis.clone(), -(splitPos + gexp));
			const planeB = new THREE.Plane(nAxis.clone().negate(), splitPos - gexp);
			const a = new THREE.Mesh(geo, shellMat([planeA]));
			a.position.copy(nAxis.clone().multiplyScalar(gexp));
			mouldGroup.add(a);
			const b = new THREE.Mesh(geo, shellMat([planeB]));
			b.position.copy(nAxis.clone().multiplyScalar(-gexp));
			mouldGroup.add(b);
		} else {
			mouldGroup.add(new THREE.Mesh(geo, shellMat([])));
		}
		// crisp silhouette so the shape reads clearly
		try {
			const eg = new THREE.EdgesGeometry(geo, 30);
			mouldGroup.add(new THREE.LineSegments(eg, edgeMat));
		} catch (e) {}

		scene.add(mouldGroup);
		mouldGroup.visible = showOverlay;

		// legend
		const axisName = sa === 0 ? 'X' : sa === 1 ? 'Y' : 'Z';
		const legend = [
			{ c: FRAME_COLOR, l: `Rigid mould · follows part · wall ${params.box_wall_mm || 3}mm` },
			{ c: FRAME_COLOR, l: twoPart ? (sa < 2 ? `Vertical clamshell · splits on ${axisName}` : 'Horizontal lid · splits on Z') : 'One-part tray · open top' },
			{ c: SILICONE_COLOR, l: `Silicone gap ${params.silicone_gap_mm || 12}mm (pour region)` }
		];
		if ((+params.base_flange_mm || 0) >= 8) legend.push({ c: FRAME_COLOR, l: 'Base plate + corner bolt holes' });
		if (twoPart && params.key_shape && params.key_shape !== 'none') legend.push({ c: KEY_COLOR, l: 'Mating-flange keys (server)' });
		legendPieces = legend;
	}

	// ==========================================================================
	//  Overlay rebuild (block bbox layout + trigger silicone worker)
	// ==========================================================================
	let overlayGroup = null;
	function rebuildOverlay() {
		if (!ready) return;
		disposeGroup(overlayGroup);
		overlayGroup = new THREE.Group();
		const legend = [];
		const p = params || {};
		const type = p.mould_type || 'two_part';
		const radial = type === 'four_part' || type === 'six_part';
		const style = p.mould_style || 'block';
		const isSil = style === 'silicone_box' && !radial;

		if (!bbox || !showOverlay) {
			if (mouldGroup) mouldGroup.visible = showOverlay && isSil;
			scene.add(overlayGroup);
			legendPieces = isSil && mouldGroup ? legendPieces : legend;
			return;
		}

		if (isSil) {
			// the accurate mould comes from the worker; clear stale block overlay
			scene.add(overlayGroup);
			if (mouldGroup) mouldGroup.visible = true;
			requestSiliconeMould();
			return;
		}

		// ---------- BLOCK / RADIAL (fast bbox layout) ----------
		if (mouldGroup) { disposeGroup(mouldGroup); mouldGroup = null; }
		const axis = p.parting_axis || 'z';
		const q = axisQuat(axis);
		const inv = q.clone().invert();
		const corners = [];
		for (const x of [bbox.min.x, bbox.max.x])
			for (const y of [bbox.min.y, bbox.max.y])
				for (const z of [bbox.min.z, bbox.max.z])
					corners.push(new THREE.Vector3(x, y, z).applyQuaternion(inv));
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
			const names = ['+X wedge', '+Y wedge', '\u2212X wedge', '\u2212Y wedge'];
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

		// sprue (block only)
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
			legend.push({ c: 0x0ea5e9, l: `Sprue \u00d8${p.sprue_diameter_mm || 6}` });
		}

		// keys (block)
		if (p.key_shape && p.key_shape !== 'none' && type !== 'one_part') {
			const kr = Math.max(1, (+p.key_diameter_mm || 8) * 0.5);
			const keyMat = new THREE.MeshBasicMaterial({ color: KEY_COLOR, transparent: true, opacity: 0.9 });
			const addKey = (x, y, z, dz = 0) => {
				const s = new THREE.Mesh(new THREE.SphereGeometry(kr, 16, 12), keyMat);
				s.position.set(x, y, z + dz);
				local.add(s);
			};
			let count = 0;
			if (type === 'two_part') {
				let pz = p.parting_mode === 'offset' ? pc.z + (+p.parting_offset_mm || 0) : pc.z;
				pz = clampN(pz, lb.min.z, lb.max.z);
				const roK = clr + wall * 0.5, d7 = roK * 0.707;
				const pts = [[lb.max.x + d7, lb.max.y + d7], [lb.min.x - d7, lb.min.y - d7], [lb.max.x + d7, lb.min.y - d7], [lb.min.x - d7, lb.max.y + d7]].slice(0, Math.max(2, Math.min(6, +p.key_count || 4)));
				for (const [x, y] of pts) { addKey(x, y, pz, -gap); count++; }
			}
			if (count) legend.push({ c: KEY_COLOR, l: `${count} registration keys \u00d8${p.key_diameter_mm || 8}` });
		}

		local.quaternion.copy(q);
		overlayGroup.add(local);
		scene.add(overlayGroup);
		legendPieces = legend;
	}

	function toHex(c) { return c.toString(16).padStart(6, '0'); }

	// ---- reactivity ----------------------------------------------------------
	$effect(() => { modelBuffer; fileName; if (ready) loadPart(); });
	$effect(() => {
		params.mould_type; params.mould_style; params.parting_axis; params.parting_mode; params.parting_offset_mm;
		params.wall_thickness_mm; params.cavity_clearance_mm; params.silicone_gap_mm; params.box_wall_mm;
		params.base_flange_mm; params.flange_thickness_mm; params.flange_reach_mm; params.master_seat; params.master_clearance_mm;
		params.gate_type; params.sprue_type; params.sprue_diameter_mm; params.sprue_offset_x_mm; params.sprue_offset_y_mm;
		params.key_shape; params.key_count; params.key_diameter_mm;
		showOverlay; exploded;
		if (ready) rebuildOverlay();
	});
	$effect(() => { if (partGroup) partGroup.visible = showPart; });
	$effect(() => { if (mouldGroup) mouldGroup.visible = showOverlay; });

	function toggleExploded() { exploded = !exploded; if (mouldGroup && (params.mould_style === 'silicone_box')) { lastSig = ''; rebuildOverlay(); } }

	let isSilNow = $derived(params.mould_style === 'silicone_box' && params.mould_type !== 'four_part' && params.mould_type !== 'six_part');
</script>

<div class="preview" bind:this={wrapEl}>
	<canvas bind:this={canvasEl}></canvas>

	<div class="pv-toolbar">
		<button type="button" class="pv-btn" onclick={fitView} title="Fit view">⤢ Fit</button>
		<button type="button" class="pv-btn {showOverlay ? 'on' : ''}" onclick={() => (showOverlay = !showOverlay)}>Mould</button>
		<button type="button" class="pv-btn {showPart ? 'on' : ''}" onclick={() => (showPart = !showPart)}>{isSilNow ? 'Master' : 'Part'}</button>
		<button type="button" class="pv-btn {exploded ? 'on' : ''}" onclick={toggleExploded}>Exploded</button>
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
	{:else}
		<p class="pv-note">
			{#if isSilNow}Accurate offset-shell preview (computed with a distance field, like the server). Exact flange, keys and pour collar are on the server.{:else}Live layout preview from your settings. Cavity sweeps, undercut relief and optimised planes are computed on the server.{/if}
		</p>
	{/if}
</div>

<style>
	.preview { position: relative; width: 100%; height: 100%; overflow: hidden; background: radial-gradient(ellipse at 30% 20%, #f8fafc 0%, #eef2f7 100%); }
	canvas { display: block; width: 100%; height: 100%; }
	.pv-toolbar { position: absolute; top: 12px; left: 12px; display: flex; gap: 6px; }
	.pv-btn { font-family: inherit; font-size: 11.5px; font-weight: 600; color: #475569; background: rgba(255,255,255,0.9); border: 1px solid #e2e8f0; border-radius: 999px; padding: 6px 12px; cursor: pointer; backdrop-filter: blur(4px); transition: border-color .15s, color .15s; }
	.pv-btn:hover { border-color: #cbd5e1; }
	.pv-btn.on { color: #6d28d9; border-color: #ddd6fe; background: #f5f3ff; }
	.pv-computing { position: absolute; top: 12px; right: 12px; display: flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 600; color: #6d28d9; background: rgba(245,243,255,0.92); border: 1px solid #ddd6fe; border-radius: 999px; padding: 6px 12px; backdrop-filter: blur(4px); }
	.spin { width: 11px; height: 11px; border: 2px solid #ddd6fe; border-top-color: #6d28d9; border-radius: 50%; display: inline-block; animation: spin 0.7s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.pv-legend { position: absolute; bottom: 42px; left: 12px; right: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
	.chip { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 600; color: #475569; background: rgba(255,255,255,0.85); border: 1px solid #e2e8f0; border-radius: 999px; padding: 3px 9px; }
	.chip i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
	.pv-note { position: absolute; bottom: 0; left: 0; right: 0; margin: 0; padding: 8px 12px; font-size: 11.5px; color: #64748b; background: rgba(255,255,255,0.82); border-top: 1px solid #eef2f7; backdrop-filter: blur(4px); }
</style>