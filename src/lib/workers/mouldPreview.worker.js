// ==========================================================================
// mouldPreview.worker.js — Akritio mould-system preview engine
// Location: src/lib/workers/mouldPreview.worker.js
//
// Builds EVERY mould system in the browser from the part mesh, off the main
// thread, with the same signed-distance-field approach as the server:
//
//   surface-voxelise the part -> flood-fill inside/outside -> exact Euclidean
//   distance transform -> signed field -> master edits (foundation, top trim,
//   slip spare) -> compose the mould system SDF -> split into pieces along the
//   user's split planes (closed, capped solids) -> keys / clamp holes ->
//   surface-nets meshes + volumes.
//
// Systems (params.system):
//   adaptive      shape-following rigid jacket for silicone, split 1 plane
//   multipart     same jacket split along 2-3 planes
//   core          jacket + inner core (plugs a bore, or hollows a vessel)
//   slip          plaster-mould jacket for slip casting, spare + top trim
//   tray          one-piece open tray (flat-backed parts), pour over top
//   direct_open   rigid printed mould you cast straight into, open base
//   direct_funnel rigid printed mould, closed, top funnel + risers
//   skin          printed core (master + base) + outer shell for latex skins
//   fixture       holder block with a drop-in pocket and finger notches
//   shell         fitted protective clamshell case
//
// No imports — plain worker script. Message in:
//   { id, positions: Float32Array (triangle soup, world), params: P, res }
// Message out:
//   { id, ok, pieces:[{key, role, label, positions, dir, vol}], fill, markers, stats }
// ==========================================================================

const INF = 1e20;
const CAP = 1_900_000; // voxel budget per preview

const FAMILY = {
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

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Exact 1D squared distance transform (Felzenszwalb lower envelope)
// ---------------------------------------------------------------------------
function edt1d(f, out, n, stride, base, v, zz) {
	let k = 0;
	v[0] = 0;
	zz[0] = -INF;
	zz[1] = INF;
	for (let q = 1; q < n; q++) {
		const fq = f[base + q * stride] + q * q;
		let s;
		for (;;) {
			const vk = v[k];
			s = (fq - (f[base + vk * stride] + vk * vk)) / (2 * (q - vk));
			if (s <= zz[k]) k--;
			else break;
		}
		k++;
		v[k] = q;
		zz[k] = s;
		zz[k + 1] = INF;
	}
	k = 0;
	for (let q = 0; q < n; q++) {
		while (zz[k + 1] < q) k++;
		const vk = v[k];
		out[q] = (q - vk) * (q - vk) + f[base + vk * stride];
	}
}

function edt3d(field, nx, ny, nz) {
	const m = Math.max(nx, ny, nz);
	const tmp = new Float64Array(m);
	const v = new Int32Array(m);
	const zz = new Float64Array(m + 1);
	const nxy = nx * ny;
	for (let k = 0; k < nz; k++)
		for (let j = 0; j < ny; j++) {
			const b = k * nxy + j * nx;
			edt1d(field, tmp, nx, 1, b, v, zz);
			for (let i = 0; i < nx; i++) field[b + i] = tmp[i];
		}
	for (let k = 0; k < nz; k++)
		for (let i = 0; i < nx; i++) {
			const b = k * nxy + i;
			edt1d(field, tmp, ny, nx, b, v, zz);
			for (let j = 0; j < ny; j++) field[b + j * nx] = tmp[j];
		}
	for (let j = 0; j < ny; j++)
		for (let i = 0; i < nx; i++) {
			const b = j * nx + i;
			edt1d(field, tmp, nz, nxy, b, v, zz);
			for (let k = 0; k < nz; k++) field[b + k * nxy] = tmp[k];
		}
	for (let t = 0; t < field.length; t++) field[t] = Math.sqrt(field[t]);
}

// per-slice (XY only) distance transform — used for lateral wall erosion
function edt2dSlices(field, nx, ny, nz) {
	const m = Math.max(nx, ny);
	const tmp = new Float64Array(m);
	const v = new Int32Array(m);
	const zz = new Float64Array(m + 1);
	const nxy = nx * ny;
	for (let k = 0; k < nz; k++) {
		for (let j = 0; j < ny; j++) {
			const b = k * nxy + j * nx;
			edt1d(field, tmp, nx, 1, b, v, zz);
			for (let i = 0; i < nx; i++) field[b + i] = tmp[i];
		}
		for (let i = 0; i < nx; i++) {
			const b = k * nxy + i;
			edt1d(field, tmp, ny, nx, b, v, zz);
			for (let j = 0; j < ny; j++) field[b + j * nx] = tmp[j];
		}
	}
	for (let t = 0; t < field.length; t++) field[t] = Math.sqrt(field[t]);
}

// ---------------------------------------------------------------------------
// Surface nets (one vertex per sign-changing cell, quads across edges)
// ---------------------------------------------------------------------------
const SN_CUBE = [
	[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
	[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]
];
const SN_EDGES = [
	[0, 1], [2, 3], [4, 5], [6, 7],
	[0, 2], [1, 3], [4, 6], [5, 7],
	[0, 4], [1, 5], [2, 6], [3, 7]
];

function surfaceNets(sdf, nx, ny, nz, h, lo) {
	const cnx = nx - 1, cny = ny - 1;
	const vidx = new Int32Array(cnx * cny * (nz - 1)).fill(-1);
	const verts = [];
	const cidx = (i, j, k) => (k * cny + j) * cnx + i;
	const val = (i, j, k) => sdf[(k * ny + j) * nx + i];
	const cv = new Float64Array(8);
	for (let k = 0; k < nz - 1; k++)
		for (let j = 0; j < ny - 1; j++)
			for (let i = 0; i < nx - 1; i++) {
				let mask = 0;
				for (let c = 0; c < 8; c++) {
					const v = val(i + SN_CUBE[c][0], j + SN_CUBE[c][1], k + SN_CUBE[c][2]);
					cv[c] = v;
					if (v < 0) mask |= 1 << c;
				}
				if (mask === 0 || mask === 255) continue;
				let px = 0, py = 0, pz = 0, cnt = 0;
				for (let e = 0; e < 12; e++) {
					const a = SN_EDGES[e][0], b = SN_EDGES[e][1];
					const va = cv[a], vb = cv[b];
					if ((va < 0) === (vb < 0)) continue;
					const t = va / (va - vb);
					px += SN_CUBE[a][0] + t * (SN_CUBE[b][0] - SN_CUBE[a][0]);
					py += SN_CUBE[a][1] + t * (SN_CUBE[b][1] - SN_CUBE[a][1]);
					pz += SN_CUBE[a][2] + t * (SN_CUBE[b][2] - SN_CUBE[a][2]);
					cnt++;
				}
				if (!cnt) continue;
				vidx[cidx(i, j, k)] = verts.length / 3;
				verts.push(lo[0] + (i + px / cnt) * h, lo[1] + (j + py / cnt) * h, lo[2] + (k + pz / cnt) * h);
			}
	const tris = [];
	const quad = (a, b, c, d, flip) => {
		if (a < 0 || b < 0 || c < 0 || d < 0) return;
		if (!flip) tris.push(a, b, c, a, c, d);
		else tris.push(a, c, b, a, d, c);
	};
	for (let k = 1; k < nz - 1; k++)
		for (let j = 1; j < ny - 1; j++)
			for (let i = 1; i < nx - 1; i++) {
				const s0 = val(i, j, k) < 0;
				if (s0 !== val(i + 1, j, k) < 0)
					quad(vidx[cidx(i, j - 1, k - 1)], vidx[cidx(i, j, k - 1)], vidx[cidx(i, j, k)], vidx[cidx(i, j - 1, k)], s0);
				if (s0 !== val(i, j + 1, k) < 0)
					quad(vidx[cidx(i - 1, j, k - 1)], vidx[cidx(i - 1, j, k)], vidx[cidx(i, j, k)], vidx[cidx(i, j, k - 1)], s0);
				if (s0 !== val(i, j, k + 1) < 0)
					quad(vidx[cidx(i - 1, j - 1, k)], vidx[cidx(i, j - 1, k)], vidx[cidx(i, j, k)], vidx[cidx(i - 1, j, k)], s0);
			}
	const out = new Float32Array(tris.length * 3);
	for (let t = 0; t < tris.length; t++) {
		out[t * 3] = verts[tris[t] * 3];
		out[t * 3 + 1] = verts[tris[t] * 3 + 1];
		out[t * 3 + 2] = verts[tris[t] * 3 + 2];
	}
	return out;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function boxSD(x, y, z, x0, y0, z0, x1, y1, z1) {
	const dx = Math.max(x0 - x, x - x1), dy = Math.max(y0 - y, y - y1), dz = Math.max(z0 - z, z - z1);
	return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dy, dz), 0);
}
function boxSD2(x, y, x0, y0, x1, y1) {
	const dx = Math.max(x0 - x, x - x1), dy = Math.max(y0 - y, y - y1);
	return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
}

// farthest-point sampling — evenly spread keys / bolts / pins
function fps(cands, count, minSep) {
	if (!cands.length || count <= 0) return [];
	let pts = cands;
	if (pts.length > 5000) {
		const step = pts.length / 5000;
		pts = Array.from({ length: 5000 }, (_, i) => cands[Math.floor(i * step)]);
	}
	let best = 0, bv = INF;
	for (let i = 0; i < pts.length; i++) {
		const p = pts[i];
		const v = p[0] + p[1] * 0.37 + p[2] * 0.11;
		if (v < bv) { bv = v; best = i; }
	}
	const chosen = [pts[best]];
	const dmin = new Float64Array(pts.length).fill(INF);
	while (chosen.length < count) {
		const c = chosen[chosen.length - 1];
		let far = -1, fv = -1;
		for (let i = 0; i < pts.length; i++) {
			const p = pts[i];
			const d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
			if (d < dmin[i]) dmin[i] = d;
			if (dmin[i] > fv) { fv = dmin[i]; far = i; }
		}
		if (far < 0 || fv < minSep) break;
		chosen.push(pts[far]);
	}
	return chosen;
}

// separable [1 2 1]/4 blur along each axis, in place
function smooth3(f, nx, ny, nz) {
	const nxy = nx * ny;
	const m = Math.max(nx, ny, nz);
	const row = new Float32Array(m);
	const pass = (count, stride, base) => {
		for (let q = 0; q < count; q++) row[q] = f[base + q * stride];
		for (let q = 1; q < count - 1; q++) f[base + q * stride] = (row[q - 1] + 2 * row[q] + row[q + 1]) * 0.25;
	};
	for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) pass(nx, 1, k * nxy + j * nx);
	for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) pass(ny, nx, k * nxy + i);
	for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pass(nz, nxy, j * nx + i);
}

// ---------------------------------------------------------------------------
// Voxelise + signed distance
// ---------------------------------------------------------------------------
function voxelSDF(positions, lo, h, nx, ny, nz, warnings) {
	const nxy = nx * ny, n = nxy * nz;
	const occ = new Uint8Array(n);
	const inv = 1 / h;
	for (let t = 0; t < positions.length; t += 9) {
		const ax = positions[t], ay = positions[t + 1], az = positions[t + 2];
		const bx = positions[t + 3], by = positions[t + 4], bz = positions[t + 5];
		const cx = positions[t + 6], cy = positions[t + 7], cz = positions[t + 8];
		const e = Math.max(Math.hypot(bx - ax, by - ay, bz - az), Math.hypot(cx - ax, cy - ay, cz - az), Math.hypot(cx - bx, cy - by, cz - bz));
		const N = Math.min(96, Math.max(1, Math.ceil(e / (0.5 * h))));
		const iN = 1 / N;
		for (let u = 0; u <= N; u++)
			for (let w = 0; w <= N - u; w++) {
				const s = u * iN, tt = w * iN;
				const i = Math.round((ax + (bx - ax) * s + (cx - ax) * tt - lo[0]) * inv);
				const j = Math.round((ay + (by - ay) * s + (cy - ay) * tt - lo[1]) * inv);
				const k = Math.round((az + (bz - az) * s + (cz - az) * tt - lo[2]) * inv);
				if (i >= 0 && i < nx && j >= 0 && j < ny && k >= 0 && k < nz) occ[k * nxy + j * nx + i] = 1;
			}
	}
	// flood the outside from the grid boundary
	const outside = new Uint8Array(n);
	const stack = new Int32Array(n);
	let sp = 0;
	const push = (id) => {
		if (!outside[id] && !occ[id]) { outside[id] = 1; stack[sp++] = id; }
	};
	for (let k = 0; k < nz; k++)
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++)
				if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) push(k * nxy + j * nx + i);
	while (sp) {
		const id = stack[--sp];
		const i = id % nx, j = ((id / nx) | 0) % ny, k = (id / nxy) | 0;
		if (i > 0) push(id - 1);
		if (i < nx - 1) push(id + 1);
		if (j > 0) push(id - nx);
		if (j < ny - 1) push(id + nx);
		if (k > 0) push(id - nxy);
		if (k < nz - 1) push(id + nxy);
	}
	let inside = 0, occCount = 0;
	for (let id = 0; id < n; id++) {
		if (occ[id]) occCount++;
		else if (!outside[id]) inside++;
	}
	const shellOnly = inside < Math.max(8, occCount * 0.002);
	if (shellOnly)
		warnings.push('The mesh is not watertight — the preview treats its surface as a thin solid. Keep "Repair mesh" on for generation.');

	const df = new Float64Array(n);
	for (let id = 0; id < n; id++) df[id] = occ[id] ? 0 : INF;
	edt3d(df, nx, ny, nz);
	const s = new Float32Array(n);
	for (let id = 0; id < n; id++) {
		const d = df[id] * h;
		if (occ[id]) s[id] = shellOnly ? -0.5 * h : -0.25 * h;
		else s[id] = outside[id] ? d : -d;
	}
	return s;
}

// ---------------------------------------------------------------------------
// Core pull-handle (post + hub + rim + 3 spokes)
// ---------------------------------------------------------------------------
function makeHandle(hcx, hcy, span, postBot, bodyTop, W, gridTop, h) {
	const postR = clamp(span * 0.14, 3, 8);
	const hubR = Math.max(postR * 1.4, 4.5);
	const wheelR = clamp(span * 0.55, 12, 42);
	const rimT = Math.max(W * 1.1, 3);
	const spokeW = Math.max(W * 0.9, 2.5);
	const wheelZ = Math.min(bodyTop + W * 2 + rimT + 4, gridTop - rimT - h * 2);
	return (x, y, z) => {
		const dx = x - hcx, dy = y - hcy;
		const rxy = Math.hypot(dx, dy);
		let c = Math.max(rxy - postR, postBot - z, z - wheelZ);
		const inplane = Math.abs(z - wheelZ) - rimT;
		c = Math.min(c, Math.max(rxy - hubR, inplane));
		const q = rxy - wheelR;
		c = Math.min(c, Math.sqrt(q * q + (z - wheelZ) * (z - wheelZ)) - rimT);
		for (let si = 0; si < 3; si++) {
			const a = si * ((2 * Math.PI) / 3);
			const along = dx * Math.cos(a) + dy * Math.sin(a);
			const perp = -dx * Math.sin(a) + dy * Math.cos(a);
			const alc = Math.max(0, Math.min(along, wheelR));
			c = Math.min(c, Math.max(Math.hypot(along - alc, perp) - spokeW, inplane));
		}
		return c;
	};
}

// ---------------------------------------------------------------------------
// MAIN BUILD
// ---------------------------------------------------------------------------
function build(positions, P, res) {
	const warnings = [];
	const sys = P.system;
	const fam = FAMILY[sys];
	if (!fam) throw new Error('Unknown mould system "' + sys + '"');

	// ---- part AABB --------------------------------------------------------
	let mnx = INF, mny = INF, mnz = INF, mxx = -INF, mxy = -INF, mxz = -INF;
	for (let i = 0; i < positions.length; i += 3) {
		const x = positions[i], y = positions[i + 1], z = positions[i + 2];
		if (x < mnx) mnx = x; if (y < mny) mny = y; if (z < mnz) mnz = z;
		if (x > mxx) mxx = x; if (y > mxy) mxy = y; if (z > mxz) mxz = z;
	}
	if (!isFinite(mnx)) throw new Error('Empty mesh');

	// ---- per-system envelope gap + wall ----------------------------------
	const isDirect = fam === 'direct_open' || fam === 'direct_funnel';
	const g =
		sys === 'slip' ? P.plaster
		: isDirect ? P.cavity_clr
		: fam === 'skin' ? P.skin
		: fam === 'shell' ? P.shell_clr
		: fam === 'fixture' ? P.fixture_clr
		: P.gap;
	const W = isDirect ? P.direct_wall : fam === 'shell' ? P.shell_wall : P.box_wall;
	const ft = P.flange_t, reach = P.flange_reach, fb = P.base_flange;
	// slip casting pours plaster into an open-top case — no funnel
	let needsFunnel = (fam === 'silicone' && sys !== 'slip') || fam === 'skin' || fam === 'direct_funnel';
	const funnelH = clamp(g * 0.8, 8, 20);
	const spareH = sys === 'slip' && P.spare_d > 0 ? P.spare_h : 0;
	const baseTh = Math.max(W * 1.6, 4);
	const found = P.foundation > 0 ? P.foundation : 0;

	// ---- grid -------------------------------------------------------------
	const padXY = Math.max(g + W + Math.max(fb, reach) + 4, fam === 'fixture' ? P.fixture_margin + 4 : 0, 6);
	const padLo = baseTh + found + (fam === 'fixture' ? P.fixture_base : 0) + 6;
	const padHi = g + W + (needsFunnel ? funnelH : 0) + spareH + (sys === 'core' ? 40 : 0) + 6;
	const lo = [mnx - padXY, mny - padXY, mnz - padLo];
	const hi = [mxx + padXY, mxy + padXY, mxz + padHi];
	const maxdim = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
	let h = maxdim / Math.max(32, res);
	let nx, ny, nz;
	const dims = () => {
		nx = Math.ceil((hi[0] - lo[0]) / h) + 3;
		ny = Math.ceil((hi[1] - lo[1]) / h) + 3;
		nz = Math.ceil((hi[2] - lo[2]) / h) + 3;
	};
	dims();
	while (nx * ny * nz > CAP) { h *= 1.07; dims(); }
	const nxy = nx * ny, n = nxy * nz;
	const h3 = h * h * h;
	const X = (i) => lo[0] + i * h;
	const Y = (j) => lo[1] + j * h;
	const Z = (k) => lo[2] + k * h;
	const gridTop = Z(nz - 1);

	// ---- part SDF ---------------------------------------------------------
	const s = voxelSDF(positions, lo, h, nx, ny, nz, warnings);
	smooth3(s, nx, ny, nz); // take the voxel staircase out of the offsets

	// ---- master edits: foundation, top trim, slip spare -------------------
	const sm = s.slice();
	let masterAdd = false;
	if (found > 0) {
		const band = Math.max(2 * h, 1.5);
		const silB = new Float32Array(nxy).fill(INF);
		for (let k = 0; k < nz; k++) {
			const z = Z(k);
			if (z < mnz - h || z > mnz + band) continue;
			for (let c = 0; c < nxy; c++) { const v = s[k * nxy + c]; if (v < silB[c]) silB[c] = v; }
		}
		for (let k = 0; k < nz; k++) {
			const z = Z(k);
			if (z > mnz + band + h) break;
			const zf = Math.max(z - (mnz + band * 0.5), mnz - found - z);
			for (let c = 0; c < nxy; c++) {
				const f = Math.max(silB[c], zf);
				const id = k * nxy + c;
				if (f < sm[id]) sm[id] = f;
			}
		}
		masterAdd = true;
	}
	if ((sys === 'slip' || sys === 'core') && P.trim > 0) {
		const zc = mxz - P.trim;
		for (let k = 0; k < nz; k++) {
			const dz = Z(k) - zc;
			if (dz <= -h) continue;
			for (let c = 0; c < nxy; c++) { const id = k * nxy + c; if (dz > sm[id]) sm[id] = dz; }
		}
	}
	if (spareH > 0) {
		let kTop = -1;
		for (let k = nz - 1; k >= 0 && kTop < 0; k--)
			for (let c = 0; c < nxy; c++) if (sm[k * nxy + c] < 0) { kTop = k; break; }
		if (kTop > 0) {
			let sx = 0, sy = 0, sc = 0;
			for (let k = Math.max(0, kTop - 1); k <= kTop; k++)
				for (let c = 0; c < nxy; c++)
					if (sm[k * nxy + c] < 0) { sx += X(c % nx); sy += Y((c / nx) | 0); sc++; }
			const cx = sx / sc, cy = sy / sc;
			const z0 = Z(kTop) - 2 * h, z1 = Z(kTop) + spareH;
			const r0 = P.spare_d / 2, r1 = r0 * 1.35;
			for (let k = 0; k < nz; k++) {
				const z = Z(k);
				if (z < z0 - h || z > z1 + h) continue;
				const r = r0 + (r1 - r0) * clamp((z - z0) / (z1 - z0), 0, 1);
				for (let j = 0; j < ny; j++)
					for (let i = 0; i < nx; i++) {
						const f = Math.max(Math.hypot(X(i) - cx, Y(j) - cy) - r, z0 - z, z - z1);
						const id = k * nxy + j * nx + i;
						if (f < sm[id]) sm[id] = f;
					}
			}
			masterAdd = true;
		}
	}

	// ---- master bounds, silhouette, column tops ---------------------------
	let bMnx = INF, bMny = INF, bMnz = INF, bMxx = -INF, bMxy = -INF, bMxz = -INF;
	let yAtMinX = 0, yAtMaxX = 0;
	const topK = new Int32Array(nxy).fill(-1);
	const sil2 = new Float32Array(nxy).fill(INF);
	for (let k = 0; k < nz; k++) {
		const z = Z(k);
		for (let j = 0; j < ny; j++) {
			const y = Y(j);
			for (let i = 0; i < nx; i++) {
				const c = j * nx + i;
				const v = sm[k * nxy + c];
				if (v < sil2[c]) sil2[c] = v;
				if (v < 0) {
					topK[c] = k;
					const x = X(i);
					if (x < bMnx) { bMnx = x; yAtMinX = y; }
					if (x > bMxx) { bMxx = x; yAtMaxX = y; }
					if (y < bMny) bMny = y; if (y > bMxy) bMxy = y;
					if (z < bMnz) bMnz = z; if (z > bMxz) bMxz = z;
				}
			}
		}
	}
	if (bMnz === INF) throw new Error('No solid found inside the model — is the mesh watertight?');
	const H = Math.max(bMxz - bMnz, h);

	// top point (pour funnel sits here)
	let maxK = -1;
	for (let c = 0; c < nxy; c++) if (topK[c] > maxK) maxK = topK[c];
	let tsx = 0, tsy = 0, tsc = 0;
	for (let c = 0; c < nxy; c++)
		if (topK[c] >= maxK - 1) { tsx += X(c % nx); tsy += Y((c / nx) | 0); tsc++; }
	const tx = tsx / tsc, ty = tsy / tsc, tz = Z(maxK);

	// ---- inner cavity: bore to plug, or vessel to hollow? -----------------
	// Decided BEFORE the jacket is built: a hollow vessel needs its mouth open
	// (jacket top flush with the rim, no funnel) so the cast can be poured in
	// and the core dropped through it.
	let coreMode = '';
	const hole = sys === 'core' ? new Uint8Array(n) : null;
	let hx0 = INF, hy0 = INF, hz0 = INF, hx1 = -INF, hy1 = -INF, hz1 = -INF;
	if (sys === 'core') {
		let holeCount = 0;
		if (P.core_mode !== 'hollow') {
			const reached = new Uint8Array(nxy);
			const st = new Int32Array(nxy);
			for (let k = 0; k < nz; k++) {
				const base = k * nxy;
				reached.fill(0);
				let top = 0;
				const seed = (c) => { if (!reached[c] && sm[base + c] >= 0) { reached[c] = 1; st[top++] = c; } };
				for (let i = 0; i < nx; i++) { seed(i); seed((ny - 1) * nx + i); }
				for (let j = 0; j < ny; j++) { seed(j * nx); seed(j * nx + nx - 1); }
				while (top) {
					const c = st[--top];
					const i = c % nx, j = (c / nx) | 0;
					if (i > 0) seed(c - 1);
					if (i < nx - 1) seed(c + 1);
					if (j > 0) seed(c - nx);
					if (j < ny - 1) seed(c + nx);
				}
				for (let c = 0; c < nxy; c++)
					if (!reached[c] && sm[base + c] >= 0) {
						hole[base + c] = 1;
						holeCount++;
						const x = X(c % nx), y = Y((c / nx) | 0), z = Z(k);
						if (x < hx0) hx0 = x; if (y < hy0) hy0 = y; if (z < hz0) hz0 = z;
						if (x > hx1) hx1 = x; if (y > hy1) hy1 = y; if (z > hz1) hz1 = z;
					}
			}
		}
		if (holeCount > 20) coreMode = 'plug';
		else if (P.core_mode !== 'plug') coreMode = 'hollow';
		if (coreMode === 'hollow') needsFunnel = false;
	}

	// ---- base + open heights ---------------------------------------------
	const hasBase = fam === 'silicone' || fam === 'tray';
	const embed = hasBase && P.master_seat ? clamp(H * 0.06, 2, 8) : 0;
	const baseTop = fam === 'skin' ? bMnz : bMnz + embed;
	const baseBot = bMnz - baseTh;
	let openZ = INF;
	if (needsFunnel) openZ = bMxz + g + W + funnelH;
	else if (sys === 'slip' || coreMode === 'hollow') openZ = bMxz; // flush with the spare / vessel mouth
	else if (fam === 'tray') openZ = bMxz + g;

	// ---- pour funnel + risers --------------------------------------------
	const rf = Math.max(1.5, P.pour_d / 2);
	const rt = Math.max(rf, P.pour_top_d / 2);
	const fz0 = tz - clamp(g * 0.5, 1, 4);
	const fz1 = openZ + h;
	const fzm = fz0 + (fz1 - fz0) * 0.5;
	const rv = Math.max(0.8, P.riser_d / 2);
	const risers = [];
	if (needsFunnel && P.risers > 0) {
		const R = 3;
		const cand = [];
		for (let j = R; j < ny - R; j++)
			for (let i = R; i < nx - R; i++) {
				const c = j * nx + i;
				const tk = topK[c];
				if (tk < 0) continue;
				const zt = Z(tk);
				if (zt < bMnz + H * 0.3) continue;
				let isMax = true;
				for (let dj = -R; dj <= R && isMax; dj++)
					for (let di = -R; di <= R; di++)
						if (topK[c + dj * nx + di] > tk) { isMax = false; break; }
				if (isMax) cand.push([X(i), Y(j), zt]);
			}
		cand.sort((a, b) => b[2] - a[2]);
		const sep = Math.max(12, 6 * h);
		for (const p of cand) {
			if (risers.length >= P.risers) break;
			if (Math.hypot(p[0] - tx, p[1] - ty) < rf * 2 + 6) continue;
			if (risers.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < sep)) continue;
			risers.push(p);
		}
	}

	// ---- split planes -----------------------------------------------------
	const planes = (Array.isArray(P.planes) ? P.planes : []).slice(0, 3).map((pl) => {
		const L = Math.hypot(pl.n[0], pl.n[1], pl.n[2]) || 1;
		return { nx: pl.n[0] / L, ny: pl.n[1] / L, nz: pl.n[2] / L, d: pl.d };
	});
	const np = planes.length;
	const dpOf = (p, x, y, z) => planes[p].nx * x + planes[p].ny * y + planes[p].nz * z - planes[p].d;

	const keyShape = P.key_shape || 'dome';
	const Kc = keyShape === 'none' ? 0 : Math.max(0, Math.round(P.key_count || 0));
	const rk = clamp(Math.min(P.key_d / 2, ft - 0.8, reach * 0.5 - 0.5), 1.2, 12);
	const kclr = P.key_clr;
	const ringT = W + reach * 0.5;
	const tol = 0.6 * h;
	const zKeyLo =
		(fam === 'silicone' ? baseTop
		: fam === 'tray' ? baseTop
		: fam === 'skin' ? baseTop + ft
		: fam === 'direct_open' ? bMnz + ft
		: -INF) + rk + 1;
	const zKeyHi = (openZ === INF ? INF : Math.min(openZ, bMxz + g + W)) - rk - 1;

	// ---- base plate -------------------------------------------------------
	const rect = P.base_style === 'rect';
	const baseReach = g + W + fb;
	const rx0 = bMnx - baseReach, rx1 = bMxx + baseReach, ry0 = bMny - baseReach, ry1 = bMxy + baseReach;
	const baseAt = (x, y, z, c) =>
		rect ? boxSD(x, y, z, rx0, ry0, baseBot, rx1, ry1, baseTop) : Math.max(sil2[c] - baseReach, baseBot - z, z - baseTop);
	const mclr = P.master_clr;
	const sw = clamp(g * 0.25, 0.8, 2.5);

	// ---- fixture helpers --------------------------------------------------
	let pocketUp = null;
	const fzc = bMnz + clamp(P.fixture_depth / 100, 0.1, 0.9) * H;
	const fBot = bMnz - P.fixture_base;
	const mg = P.fixture_margin;
	const notchR = clamp(H * 0.15, 6, 14);
	if (fam === 'fixture') {
		pocketUp = new Float32Array(n);
		for (let c = 0; c < nxy; c++) {
			let m = INF;
			for (let k = 0; k < nz; k++) {
				const id = k * nxy + c;
				const v = sm[id] - g;
				if (v < m) m = v;
				pocketUp[id] = m;
			}
		}
	}

	// =======================================================================
	// COMPOSE the mould field M, fill F (silicone / plaster / cast), skin core
	// =======================================================================
	const M = new Float32Array(n);
	const F = fam === 'fixture' || fam === 'shell' ? null : new Float32Array(n);
	const CORE = fam === 'skin' ? new Float32Array(n) : null;
	const cands = planes.map(() => []);
	const skinCands = [];

	for (let k = 0; k < nz; k++) {
		const z = Z(k);
		for (let j = 0; j < ny; j++) {
			const y = Y(j);
			for (let i = 0; i < nx; i++) {
				const x = X(i);
				const c = j * nx + i;
				const id = k * nxy + c;
				const v = sm[id];
				let inner = INF, m = INF, f = INF;

				if (fam !== 'tray' && fam !== 'fixture') {
					inner = v - g;
					if (needsFunnel && z > fz0 - h) {
						const r = z < fzm ? rf : rf + ((rt - rf) * (z - fzm)) / (fz1 - fzm);
						const fu = Math.max(Math.hypot(x - tx, y - ty) - r, fz0 - z, z - fz1);
						if (fu < inner) inner = fu;
						for (let q = 0; q < risers.length; q++) {
							const R = risers[q];
							if (z < R[2] - 2) continue;
							const rr = Math.max(Math.hypot(x - R[0], y - R[1]) - rv, R[2] - 1 - z, z - fz1);
							if (rr < inner) inner = rr;
						}
					}
				}

				if (fam === 'silicone') {
					m = Math.max(inner - W, -inner, z - openZ, baseTop - z);
					for (let p = 0; p < np; p++) {
						const fl = Math.max(Math.abs(dpOf(p, x, y, z)) - ft, inner - W - reach, -inner, z - openZ, baseTop - z);
						if (fl < m) m = fl;
					}
					const b = baseAt(x, y, z, c);
					if (b < m) m = b;
					if (P.master_seal) {
						const se = Math.max(mclr - v, v - sw, baseTop - z, z - (baseTop + sw));
						if (se < m) m = se;
					}
					if (P.master_seat) {
						const pk = Math.max(v - mclr, z - baseTop);
						if (-pk > m) m = -pk;
					}
					f = Math.max(inner, -v, baseTop - z, z - openZ);
				} else if (fam === 'tray') {
					const env = rect ? boxSD2(x, y, bMnx - g, bMny - g, bMxx + g, bMxy + g) : sil2[c] - g;
					inner = env;
					m = Math.max(env - W, -env, baseBot - z, z - openZ);
					for (let p = 0; p < np; p++) {
						const fl = Math.max(Math.abs(dpOf(p, x, y, z)) - ft, env - W - reach, -env, baseBot - z, z - openZ);
						if (fl < m) m = fl;
					}
					const b = baseAt(x, y, z, c);
					if (b < m) m = b;
					if (P.master_seal) {
						const se = Math.max(mclr - v, v - sw, baseTop - z, z - (baseTop + sw));
						if (se < m) m = se;
					}
					if (P.master_seat) {
						const pk = Math.max(v - mclr, z - baseTop);
						if (-pk > m) m = -pk;
					}
					f = Math.max(env, -v, baseTop - z, z - openZ);
				} else if (fam === 'direct_open') {
					m = Math.max(inner - W, -inner, bMnz - z);
					const wing = Math.max(inner - W - reach, -inner, bMnz - z, z - (bMnz + ft));
					if (wing < m) m = wing;
					for (let p = 0; p < np; p++) {
						const fl = Math.max(Math.abs(dpOf(p, x, y, z)) - ft, inner - W - reach, -inner, bMnz - z);
						if (fl < m) m = fl;
					}
					f = Math.max(inner, bMnz - z);
				} else if (fam === 'direct_funnel') {
					m = Math.max(inner - W, -inner, z - openZ);
					const foot = Math.max(sil2[c] - (g + W + fb * 0.5), bMnz - g - W - z, z - (bMnz + ft * 0.5));
					if (foot < m) m = foot;
					for (let p = 0; p < np; p++) {
						const fl = Math.max(Math.abs(dpOf(p, x, y, z)) - ft, inner - W - reach, -inner, z - openZ);
						if (fl < m) m = fl;
					}
					if (-inner > m) m = -inner;
					f = Math.max(inner, z - openZ);
				} else if (fam === 'skin') {
					m = Math.max(inner - W, -inner, z - openZ, baseTop - z);
					const sk = Math.max(inner - W - reach, -inner, baseTop - z, z - (baseTop + ft));
					if (sk < m) m = sk;
					for (let p = 0; p < np; p++) {
						const fl = Math.max(Math.abs(dpOf(p, x, y, z)) - ft, inner - W - reach, -inner, z - openZ, baseTop - z);
						if (fl < m) m = fl;
					}
					CORE[id] = Math.min(v, Math.max(sil2[c] - (g + W + reach), baseBot - z, z - baseTop));
					f = Math.max(inner, -v, baseTop - z, z - openZ);
					if (Math.abs(z - baseTop) < tol && Math.abs(inner - ringT) < tol) skinCands.push([x, y, baseTop]);
				} else if (fam === 'fixture') {
					const body = rect
						? boxSD(x, y, z, bMnx - mg, bMny - mg, fBot, bMxx + mg, bMxy + mg, fzc)
						: Math.max(sil2[c] - mg, fBot - z, z - fzc);
					m = Math.max(body, -pocketUp[id]);
					if (z > fzc - (fzc - bMnz) * 0.75) {
						const n1 = Math.hypot(x - bMnx, y - yAtMinX) - notchR;
						const n2 = Math.hypot(x - bMxx, y - yAtMaxX) - notchR;
						const nn = Math.min(n1, n2);
						if (-nn > m) m = -nn;
					}
				} else if (fam === 'shell') {
					m = Math.max(inner - W, -inner);
					for (let p = 0; p < np; p++) {
						const fl = Math.max(Math.abs(dpOf(p, x, y, z)) - ft, inner - W - reach, -inner);
						if (fl < m) m = fl;
					}
				}

				M[id] = m;
				if (F) F[id] = f;

				// key / clamp candidates: mid-line of each mating flange
				if (np && inner !== INF && z > zKeyLo && z < zKeyHi && Math.abs(inner - ringT) < tol) {
					for (let p = 0; p < np; p++) {
						if (Math.abs(dpOf(p, x, y, z)) >= tol) continue;
						let ok = true;
						for (let q = 0; q < np; q++)
							if (q !== p && Math.abs(dpOf(q, x, y, z)) < rk + ft + 1) { ok = false; break; }
						if (ok) cands[p].push([x, y, z]);
					}
				}
			}
		}
	}

	// ---- base plate bolt holes -------------------------------------------
	const bolts2D = [];
	if (hasBase && P.base_bolts && fb >= 5) {
		const rb = Math.max(1, P.bolt_d / 2);
		if (rect) {
			const ins = fb * 0.5;
			bolts2D.push([rx0 + ins, ry0 + ins], [rx1 - ins, ry0 + ins], [rx1 - ins, ry1 - ins], [rx0 + ins, ry1 - ins]);
		} else {
			const cx = (bMnx + bMxx) / 2, cy = (bMny + bMxy) / 2;
			const target = g + W + fb * 0.5;
			for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
				for (let r = 0; r < maxdim; r += h * 0.5) {
					const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
					const i = Math.round((x - lo[0]) / h), j = Math.round((y - lo[1]) / h);
					if (i < 0 || j < 0 || i >= nx || j >= ny) break;
					if (sil2[j * nx + i] >= target) { bolts2D.push([x, y]); break; }
				}
			}
		}
		for (let k = 0; k < nz; k++) {
			const z = Z(k);
			if (z > baseTop + h) break;
			for (let j = 0; j < ny; j++)
				for (let i = 0; i < nx; i++) {
					const id = k * nxy + j * nx + i;
					for (const b of bolts2D) {
						const hole = Math.hypot(X(i) - b[0], Y(j) - b[1]) - rb;
						if (-hole > M[id]) M[id] = -hole;
					}
				}
		}
	}

	// ---- smart base keys (pockets in the base, silicone fills them) -------
	let baseKeys = [];
	if (hasBase && P.base_keys > 0 && F) {
		const kb = clamp(Math.round((baseTop - lo[2]) / h) + 1, 0, nz - 1);
		const bc = [];
		for (let c = 0; c < nxy; c++) {
			const id = kb * nxy + c;
			const v = sm[id];
			if (F[id] < 0 && v > g * 0.35 && v < g * 0.65) bc.push([X(c % nx), Y((c / nx) | 0), baseTop]);
		}
		const rbk = clamp(Math.min(P.base_key_d / 2, g * 0.35), 1, 8);
		baseKeys = fps(bc, P.base_keys, rbk * 4);
		for (let k = 0; k < nz; k++) {
			const z = Z(k);
			if (z < baseTop - rbk - h || z > baseTop + h) continue;
			for (let j = 0; j < ny; j++)
				for (let i = 0; i < nx; i++) {
					const id = k * nxy + j * nx + i;
					for (const b of baseKeys) {
						const d = Math.hypot(X(i) - b[0], Y(j) - b[1], z - b[2]) - rbk;
						if (-d > M[id]) M[id] = -d;
						if (d < F[id]) F[id] = d; // silicone flows into the pocket
					}
				}
		}
	}

	// ---- skin registration pins (boss on core base, socket in shell) -----
	let skinPins = [];
	if (fam === 'skin') {
		skinPins = fps(skinCands, 4, 10);
		const ph = ft * 0.7;
		for (let k = 0; k < nz; k++) {
			const z = Z(k);
			if (z < baseTop - h || z > baseTop + ph + kclr + h) continue;
			for (let j = 0; j < ny; j++)
				for (let i = 0; i < nx; i++) {
					const id = k * nxy + j * nx + i;
					for (const p of skinPins) {
						const r = Math.hypot(X(i) - p[0], Y(j) - p[1]);
						const boss = Math.max(r - rk, baseTop - 0.1 - z, z - (baseTop + ph));
						if (boss < CORE[id]) CORE[id] = boss;
						const sock = Math.max(r - (rk + kclr), baseTop - 0.1 - z, z - (baseTop + ph + kclr));
						if (-sock > M[id]) M[id] = -sock;
					}
				}
		}
	}

	// ---- keys + clamp holes per split plane ------------------------------
	const keySets = planes.map((pl, p) => {
		const nb = P.clamp_holes ? Math.max(2, Math.ceil(Kc / 2)) : 0;
		const chosen = fps(cands[p], Kc + nb, Math.max(rk * 3, 6));
		return { keys: chosen.slice(0, Kc), bolts: chosen.slice(Kc) };
	});
	const rClamp = Math.max(1, P.clamp_d / 2);
	const hk = rk * 1.2;

	// ---- pieces -----------------------------------------------------------
	const pieces = [];
	const kerf = np ? 0.08 : 0;
	const nCells = 1 << np;
	const roleLabel = {
		silicone: 'Jacket',
		tray: 'Tray',
		direct_open: 'Mould',
		direct_funnel: 'Mould',
		skin: 'Outer shell',
		fixture: 'Fixture',
		shell: 'Case'
	}[fam];
	for (let mask = 0; mask < nCells; mask++) {
		const sg = planes.map((_, p) => ((mask >> p) & 1 ? 1 : -1));
		let fld = M;
		let cnt = 0;
		if (np) {
			fld = new Float32Array(n);
			for (let k = 0; k < nz; k++) {
				const z = Z(k);
				for (let j = 0; j < ny; j++) {
					const y = Y(j);
					for (let i = 0; i < nx; i++) {
						const x = X(i);
						const id = k * nxy + j * nx + i;
						let v = M[id];
						for (let p = 0; p < np; p++) {
							const hs = -sg[p] * dpOf(p, x, y, z) + kerf;
							if (hs > v) v = hs;
						}
						for (let p = 0; p < np; p++) {
							const pl = planes[p];
							const ks = keySets[p];
							for (let q = 0; q < ks.keys.length; q++) {
								const kp = ks.keys[q];
								const qx = x - kp[0], qy = y - kp[1], qz = z - kp[2];
								if (qx > 14 || qx < -14 || qy > 14 || qy < -14 || qz > 14 || qz < -14) continue;
								const qn = qx * pl.nx + qy * pl.ny + qz * pl.nz;
								const r2 = qx * qx + qy * qy + qz * qz;
								if (sg[p] > 0) {
									let boss;
									if (keyShape === 'cone') {
										const a = -qn, rad = Math.sqrt(Math.max(0, r2 - qn * qn));
										boss = Math.max(rad - rk * Math.max(0, 1 - a / hk), -a, a - hk);
									} else boss = Math.max(Math.sqrt(r2) - rk, qn);
									if (boss < v) v = boss;
								} else {
									let sock;
									if (keyShape === 'cone') {
										const a = -qn, rad = Math.sqrt(Math.max(0, r2 - qn * qn));
										sock = Math.max(rad - (rk + kclr) * Math.max(0, 1 - a / (hk + kclr)), -a - 0.1, a - hk - kclr);
									} else sock = Math.sqrt(r2) - (rk + kclr);
									if (-sock > v) v = -sock;
								}
							}
							for (let q = 0; q < ks.bolts.length; q++) {
								const bp = ks.bolts[q];
								const qx = x - bp[0], qy = y - bp[1], qz = z - bp[2];
								if (qx > 20 || qx < -20 || qy > 20 || qy < -20 || qz > 20 || qz < -20) continue;
								const qn = qx * pl.nx + qy * pl.ny + qz * pl.nz;
								const rad = Math.sqrt(Math.max(0, qx * qx + qy * qy + qz * qz - qn * qn));
								const hole = Math.max(rad - rClamp, Math.abs(qn) - ft - 1);
								if (-hole > v) v = -hole;
							}
						}
						fld[id] = v;
						if (v < 0) cnt++;
					}
				}
			}
		} else {
			for (let id = 0; id < n; id++) if (M[id] < 0) cnt++;
		}
		if (cnt < 30) continue;
		let dx = 0, dy = 0, dz = 0;
		for (let p = 0; p < np; p++) { dx += sg[p] * planes[p].nx; dy += sg[p] * planes[p].ny; dz += sg[p] * planes[p].nz; }
		const dl = Math.hypot(dx, dy, dz);
		let dir = dl > 1e-6 ? [dx / dl, dy / dl, dz / dl] : [0, 0, 0];
		if (!np && fam === 'skin') dir = [0, 0, 1];
		pieces.push({
			key: 'p' + mask,
			role: 'mould',
			label: np ? roleLabel + ' ' + String.fromCharCode(65 + pieces.length) : roleLabel,
			positions: surfaceNets(fld, nx, ny, nz, h, lo),
			dir,
			vol: (cnt * h3) / 1000
		});
	}

	// ---- skin core --------------------------------------------------------
	if (CORE) {
		let cnt = 0;
		for (let id = 0; id < n; id++) if (CORE[id] < 0) cnt++;
		pieces.push({ key: 'core', role: 'core', label: 'Printed core (master + base)', positions: surfaceNets(CORE, nx, ny, nz, h, lo), dir: [0, 0, 0], vol: (cnt * h3) / 1000 });
	}

	// ---- inner core (vases, planters, rings, tubes) -----------------------
	let coreInsideVol = 0;
	let castField = null;
	if (sys === 'core') {
		const core = new Float32Array(n).fill(INF);
		if (coreMode === 'plug') {
			// plug the bore, leaving the silicone gap on the bore wall
			const hcx = (hx0 + hx1) / 2, hcy = (hy0 + hy1) / 2;
			const handle = makeHandle(hcx, hcy, Math.min(hx1 - hx0, hy1 - hy0), hz1 - h, hz1, W, gridTop, h);
			for (let k = 0; k < nz; k++) {
				const z = Z(k);
				for (let j = 0; j < ny; j++) {
					const y = Y(j);
					for (let i = 0; i < nx; i++) {
						const id = k * nxy + j * nx + i;
						let c = Math.max(g - sm[id], hole[id] ? -1 : 1, Math.max(hz0 - z, z - hz1));
						c = Math.min(c, handle(X(i), y, z));
						core[id] = c;
					}
				}
			}
		} else if (coreMode === 'hollow') {
			// Hollow vessel: shape-adapted core = the master eroded sideways by
			// the cast wall, drafted so it narrows with depth, and clipped by a
			// top-down running max so it always pulls straight out of the mouth.
			const cw = P.cast_wall;
			const tanD = Math.tan((clamp(P.core_draft, 0, 10) * Math.PI) / 180);
			const d2 = new Float64Array(n);
			for (let id = 0; id < n; id++) d2[id] = sm[id] < 0 ? INF : 0;
			edt2dSlices(d2, nx, ny, nz);
			const bandK = Math.ceil((cw * 1.5) / h) + 1;
			const zFloor = bMnz + cw;
			let csx = 0, csy = 0, csc = 0;
			for (let c = 0; c < nxy; c++) {
				const tk = topK[c];
				if (tk < 0 || tk < maxK - bandK) continue;
				let run = -INF;
				for (let k = tk; k >= 0; k--) {
					const id = k * nxy + c;
					const draft = tanD * Math.max(0, tz - Z(k));
					const e = sm[id] < 0 ? cw + draft - d2[id] * h : cw + Math.max(0, sm[id]);
					if (e > run) run = e;
					const val = Math.max(run, zFloor - Z(k));
					core[id] = val;
					if (val < 0 && k === tk) { csx += X(c % nx); csy += Y((c / nx) | 0); csc++; }
				}
			}
			if (csc > 0) {
				// T-bar handle resting across the rim (bridges the silicone and
				// jacket), with a raised grip hub and pin holes at the ends.
				const hcx = csx / csc, hcy = csy / csc;
				let bdx = 1, bdy = 0;
				if (planes.length) {
					const L = Math.hypot(planes[0].nx, planes[0].ny);
					if (L > 0.3) { bdx = planes[0].nx / L; bdy = planes[0].ny / L; }
				}
				let reachTop = 0;
				for (let c = 0; c < nxy; c++)
					if (topK[c] >= maxK - bandK) {
						const a = Math.abs((X(c % nx) - hcx) * bdx + (Y((c / nx) | 0) - hcy) * bdy);
						if (a > reachTop) reachTop = a;
					}
				const halfLen = reachTop + g + W + 4;
				const barW = Math.max(8, W * 2.5);
				const barT = Math.max(4, W * 1.3);
				const hubR = Math.max(6, barW * 0.7);
				const pinR = 1.8;
				const zb = tz;
				for (let k = 0; k < nz; k++) {
					const z = Z(k);
					if (z < zb - h || z > zb + barT + 6) continue;
					for (let j = 0; j < ny; j++)
						for (let i = 0; i < nx; i++) {
							const dx = X(i) - hcx, dy = Y(j) - hcy;
							const along = dx * bdx + dy * bdy;
							const perp = -dx * bdy + dy * bdx;
							let v = Math.max(Math.abs(along) - halfLen, Math.abs(perp) - barW / 2, zb - z, z - (zb + barT));
							const pin = Math.hypot(Math.abs(along) - (halfLen - 5), perp) - pinR;
							if (-pin > v) v = -pin;
							const hub = Math.max(Math.hypot(dx, dy) - hubR, zb - z, z - (zb + barT + 4));
							if (hub < v) v = hub;
							const id = k * nxy + j * nx + i;
							if (v < core[id]) core[id] = v;
						}
				}
				// the hollow cast you get: master minus core
				castField = new Float32Array(n);
				for (let id = 0; id < n; id++) castField[id] = Math.max(sm[id], -core[id]);
			} else {
				warnings.push('No top opening wide enough for a pull-out core. Trim the top of the master (Master tab) or switch the core to "Plug a bore".');
			}
		} else {
			warnings.push('No bore found to plug. Switch the core to "Auto" or "Hollow vessel".');
		}
		let cnt = 0;
		for (let id = 0; id < n; id++)
			if (core[id] < 0) { cnt++; if (s[id] < 0) coreInsideVol++; }
		coreInsideVol = (coreInsideVol * h3) / 1000;
		if (cnt > 30) {
			pieces.push({
				key: 'core',
				role: 'core',
				label: coreMode === 'plug' ? 'Inner core · plugs the bore' : 'Inner core · T-bar rests on the rim',
				positions: surfaceNets(core, nx, ny, nz, h, lo),
				dir: [0, 0, 1],
				vol: (cnt * h3) / 1000
			});
		} else if (!warnings.length) {
			warnings.push('No internal void or top opening found — the jacket is built without a core.');
		}
	}

	// ---- master additions (foundation / slip spare) -----------------------
	if (masterAdd) {
		const add = new Float32Array(n);
		let cnt = 0;
		for (let id = 0; id < n; id++) { const v = Math.max(sm[id], -s[id]); add[id] = v; if (v < 0) cnt++; }
		if (cnt > 20)
			pieces.push({ key: 'madd', role: 'master_add', label: sys === 'slip' ? 'Master spare / foundation' : 'Master foundation', positions: surfaceNets(add, nx, ny, nz, h, lo), dir: [0, 0, 0], vol: (cnt * h3) / 1000 });
	}

	// ---- air-trap detection (pour-from-top systems) -----------------------
	const markers = [];
	if (F && (fam === 'silicone' || fam === 'tray' || fam === 'skin') && P.air_detect) {
		const kb = clamp(Math.ceil((baseTop - lo[2]) / h) + 1, 1, nz - 1);
		const ceil = new Int32Array(nxy).fill(-1);
		for (let c = 0; c < nxy; c++)
			for (let k = kb + 1; k < nz; k++) {
				const id = k * nxy + c;
				if (sm[id] < 0 && F[id - nxy] < 0) { ceil[c] = k; break; }
			}
		// Spill analysis: air under a ceiling rises along it and escapes where
		// the ceiling ends. Priority-flood the inverted ceiling height from the
		// open columns; a cell is trapped when its ceiling sits more than
		// `tolK` voxels above the lowest spill height on any escape path.
		const H2 = new Float64Array(nxy);
		for (let c = 0; c < nxy; c++) H2[c] = ceil[c] >= 0 ? -ceil[c] : -INF;
		const level = new Float64Array(nxy).fill(INF);
		const heapI = new Int32Array(nxy * 4 + 16);
		const heapV = new Float64Array(nxy * 4 + 16);
		let hs = 0;
		const hpush = (c, v) => {
			let i = hs++;
			heapI[i] = c; heapV[i] = v;
			while (i > 0) {
				const p = (i - 1) >> 1;
				if (heapV[p] <= heapV[i]) break;
				const ti = heapI[p], tv = heapV[p];
				heapI[p] = heapI[i]; heapV[p] = heapV[i]; heapI[i] = ti; heapV[i] = tv;
				i = p;
			}
		};
		const hpop = () => {
			const c = heapI[0];
			hs--;
			heapI[0] = heapI[hs]; heapV[0] = heapV[hs];
			let i = 0;
			for (;;) {
				const l = i * 2 + 1, r = l + 1;
				let m = i;
				if (l < hs && heapV[l] < heapV[m]) m = l;
				if (r < hs && heapV[r] < heapV[m]) m = r;
				if (m === i) break;
				const ti = heapI[m], tv = heapV[m];
				heapI[m] = heapI[i]; heapV[m] = heapV[i]; heapI[i] = ti; heapV[i] = tv;
				i = m;
			}
			return c;
		};
		// Seeds: columns with no ceiling. Air under a neighbouring ceiling at
		// height k escapes into such a column only if the column is open
		// (not master) at that height — a solid neck or wall blocks it.
		for (let c = 0; c < nxy; c++) if (ceil[c] < 0) level[c] = -INF;
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++) {
				const c = j * nx + i;
				if (ceil[c] < 0) continue;
				let open = i === 0 || j === 0 || i === nx - 1 || j === ny - 1;
				for (let dj = -1; dj <= 1 && !open; dj++)
					for (let di = -1; di <= 1; di++) {
						if (!di && !dj) continue;
						const nc = c + dj * nx + di;
						if (ceil[nc] < 0 && sm[ceil[c] * nxy + nc] >= 0) { open = true; break; }
					}
				if (open) { level[c] = H2[c]; hpush(c, H2[c]); }
			}
		while (hs) {
			const c = hpop();
			const i = c % nx, j = (c / nx) | 0;
			for (let dj = -1; dj <= 1; dj++)
				for (let di = -1; di <= 1; di++) {
					if (!di && !dj) continue;
					const ii = i + di, jj = j + dj;
					if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
					const nc = jj * nx + ii;
					if (level[nc] !== INF || ceil[nc] < 0) continue;
					const lv = Math.max(H2[nc], level[c]);
					level[nc] = lv;
					hpush(nc, lv);
				}
		}
		const tolK = 1.5;
		const trapped = new Uint8Array(nxy);
		const depthA = new Float64Array(nxy);
		for (let c = 0; c < nxy; c++) {
			if (ceil[c] < 0) continue;
			// never reached = fully walled-in pocket: all of it is trapped air
			const depth = level[c] === INF ? INF : level[c] - H2[c];
			if (depth > tolK) { trapped[c] = 1; depthA[c] = depth; }
		}
		// one pocket = one connected trapped region; up to 3 spaced markers each
		const seen = new Uint8Array(nxy);
		const q2 = new Int32Array(nxy);
		const sep = Math.max(25, 8 * h);
		for (let c0 = 0; c0 < nxy && markers.length < 12; c0++) {
			if (!trapped[c0] || seen[c0]) continue;
			let qh = 0, qt = 0;
			q2[qt++] = c0; seen[c0] = 1;
			const region = [];
			while (qh < qt) {
				const c = q2[qh++];
				region.push(c);
				const i = c % nx, j = (c / nx) | 0;
				for (let dj = -1; dj <= 1; dj++)
					for (let di = -1; di <= 1; di++) {
						const ii = i + di, jj = j + dj;
						if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
						const nc = jj * nx + ii;
						if (trapped[nc] && !seen[nc]) { seen[nc] = 1; q2[qt++] = nc; }
					}
			}
			if (region.length < 2) continue;
			// start from the cell nearest the region centroid among the deepest
			let sx = 0, sy = 0;
			for (const c of region) { sx += X(c % nx); sy += Y((c / nx) | 0); }
			sx /= region.length; sy /= region.length;
			const pts = region.map((c) => [X(c % nx), Y((c / nx) | 0), Z(ceil[c]), depthA[c]]);
			pts.sort((a, b) => (b[3] - a[3]) || (Math.hypot(a[0] - sx, a[1] - sy) - Math.hypot(b[0] - sx, b[1] - sy)));
			let added = 0;
			for (const p of pts) {
				if (added >= 3 || markers.length >= 12) break;
				if (markers.some((m) => Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]) < sep)) continue;
				markers.push([p[0], p[1], p[2]]);
				added++;
			}
		}
		if (markers.length && P.air_pillars) {
			const rp = Math.max(0.8, P.pillar_d / 2);
			const pil = new Float32Array(n);
			let cnt = 0;
			for (let k = 0; k < nz; k++) {
				const z = Z(k);
				for (let j = 0; j < ny; j++)
					for (let i = 0; i < nx; i++) {
						let v = INF;
						for (const p of markers) {
							const d = Math.max(Math.hypot(X(i) - p[0], Y(j) - p[1]) - rp, baseTop - z, z - (p[2] + h));
							if (d < v) v = d;
						}
						const id = k * nxy + j * nx + i;
						pil[id] = v;
						if (v < 0) cnt++;
					}
			}
			if (cnt > 10)
				pieces.push({ key: 'pillars', role: 'pillars', label: 'Air-trap support pillars', positions: surfaceNets(pil, nx, ny, nz, h, lo), dir: [0, 0, 0], vol: (cnt * h3) / 1000 });
		}
	}

	// ---- stats ------------------------------------------------------------
	let masterCnt = 0, fillCnt = 0;
	let ox0 = INF, oy0 = INF, oz0 = INF, ox1 = -INF, oy1 = -INF, oz1 = -INF;
	for (let k = 0; k < nz; k++)
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++) {
				const id = k * nxy + j * nx + i;
				if (s[id] < 0) masterCnt++;
				if (F && F[id] < 0) fillCnt++;
				if (M[id] < 0) {
					const x = X(i), y = Y(j), z = Z(k);
					if (x < ox0) ox0 = x; if (y < oy0) oy0 = y; if (z < oz0) oz0 = z;
					if (x > ox1) ox1 = x; if (y > oy1) oy1 = y; if (z > oz1) oz1 = z;
				}
			}
	// invariants (reported for QA): mould inside the master, poured material
	// escaping sideways through the mould below the pour line
	let overlapCnt = 0, leakCnt = 0;
	const leakTop = openZ === INF ? INF : openZ - 1.5 * h;
	for (let k = 1; k < nz - 1; k++)
		for (let j = 1; j < ny - 1; j++)
			for (let i = 1; i < nx - 1; i++) {
				const id = k * nxy + j * nx + i;
				if (M[id] < -0.5 * h && s[id] < -0.5 * h) overlapCnt++;
				if (!F || F[id] >= 0 || Z(k) > leakTop) continue;
				if (fam === 'direct_open' && Z(k) < bMnz + 1.5 * h) continue; // open base by design
				for (const o of [1, -1, nx, -nx, nxy, -nxy]) {
					const q = id + o;
					// shared zero boundaries count as sealed; the socket fit
					// clearance (< master clearance) is an intended gap
					if (F[q] > 0 && M[q] > 0 && sm[q] > mclr + 0.05 && !(CORE && CORE[q] <= 0)) { leakCnt++; break; }
				}
			}
	const masterVol = (masterCnt * h3) / 1000;
	const fillVol = (fillCnt * h3) / 1000;
	const printed = pieces.filter((p) => p.role === 'mould' || p.role === 'core' || p.role === 'pillars' || p.role === 'master_add').reduce((a, p) => a + p.vol, 0);

	// ---- fill layers (toggled with the Silicone / Plaster / Cast button) --
	// Multi-part silicone: the silicone itself is cut on the same planes, so
	// the preview shows the separate keyed silicone pieces.
	const fillKind = sys === 'slip' ? 'plaster' : isDirect ? 'cast' : fam === 'skin' ? 'skin' : 'silicone';
	const fills = [];
	if (F) {
		if ((sys === 'multipart' || sys === 'slip') && np) {
			// natches: round keys on each parting face of the poured material
			const rN = clamp(g * 0.22, 1.5, 6);
			const natches = planes.map((pl, p) => {
				const nc = [];
				for (let k = 0; k < nz; k++) {
					const z = Z(k);
					if (z < baseTop + rN + 1 || z > (openZ === INF ? bMxz : openZ) - rN - 1) continue;
					for (let j = 0; j < ny; j++)
						for (let i = 0; i < nx; i++) {
							const id = k * nxy + j * nx + i;
							if (F[id] >= 0 || Math.abs(sm[id] - g * 0.5) >= tol) continue;
							const x = X(i), y = Y(j);
							if (Math.abs(dpOf(p, x, y, z)) >= tol) continue;
							let ok = true;
							for (let q = 0; q < np; q++) if (q !== p && Math.abs(dpOf(q, x, y, z)) < rN + 2) { ok = false; break; }
							if (ok) nc.push([x, y, z]);
						}
				}
				return fps(nc, 4, rN * 4);
			});
			for (let mask = 0; mask < nCells; mask++) {
				const sg = planes.map((_, p) => ((mask >> p) & 1 ? 1 : -1));
				const ff = new Float32Array(n);
				let cnt = 0;
				for (let k = 0; k < nz; k++) {
					const z = Z(k);
					for (let j = 0; j < ny; j++) {
						const y = Y(j);
						for (let i = 0; i < nx; i++) {
							const id = k * nxy + j * nx + i;
							let v = F[id];
							for (let p = 0; p < np; p++) {
								const hs = -sg[p] * dpOf(p, X(i), y, z) + 0.15;
								if (hs > v) v = hs;
							}
							for (let p = 0; p < np; p++) {
								const pl = planes[p];
								for (const kp of natches[p]) {
									const qx = X(i) - kp[0], qy = y - kp[1], qz = z - kp[2];
									if (qx > 8 || qx < -8 || qy > 8 || qy < -8 || qz > 8 || qz < -8) continue;
									const r = Math.hypot(qx, qy, qz);
									const qn = qx * pl.nx + qy * pl.ny + qz * pl.nz;
									if (sg[p] > 0) { const b = Math.max(r - rN, qn); if (b < v) v = b; }
									else if (rN + 0.2 - r > v) v = rN + 0.2 - r;
								}
							}
							ff[id] = v;
							if (v < 0) cnt++;
						}
					}
				}
				if (cnt < 30) continue;
				let dx = 0, dy = 0, dz = 0;
				for (let p = 0; p < np; p++) { dx += sg[p] * planes[p].nx; dy += sg[p] * planes[p].ny; dz += sg[p] * planes[p].nz; }
				const dl = Math.hypot(dx, dy, dz) || 1;
				fills.push({ kind: fillKind, label: (sys === 'slip' ? 'Plaster piece ' : 'Silicone piece ') + String.fromCharCode(65 + fills.length), positions: surfaceNets(ff, nx, ny, nz, h, lo), dir: [dx / dl, dy / dl, dz / dl], vol: (cnt * h3) / 1000 });
			}
		} else {
			fills.push({ kind: fillKind, label: fillKind, positions: surfaceNets(F, nx, ny, nz, h, lo), dir: [0, 0, 0], vol: fillVol });
		}
	}
	if (castField) {
		let cnt = 0;
		for (let id = 0; id < n; id++) if (castField[id] < 0) cnt++;
		fills.push({ kind: 'cast', label: 'Hollow cast', positions: surfaceNets(castField, nx, ny, nz, h, lo), dir: [0, 0, 0], vol: (cnt * h3) / 1000 });
	}

	return {
		pieces,
		fills,
		markers,
		stats: {
			system: sys,
			family: fam,
			master_cm3: masterVol,
			fill_cm3: fillVol,
			cast_cm3: sys === 'core' && coreMode === 'hollow' ? Math.max(0, masterVol - coreInsideVol) : isDirect ? fillVol : masterVol,
			printed_cm3: printed,
			pieces: pieces.filter((p) => p.role === 'mould').length,
			has_core: pieces.some((p) => p.role === 'core'),
			core_mode: coreMode,
			air_traps: markers.length,
			box_mm: ox0 < INF ? [ox1 - ox0, oy1 - oy0, oz1 - oz0] : [0, 0, 0],
			voxel_mm: h,
			grid: [nx, ny, nz],
			base_keys: baseKeys.length,
			keys: keySets.reduce((a, k) => a + k.keys.length, 0),
			clamps: keySets.reduce((a, k) => a + k.bolts.length, 0) + bolts2D.length,
			risers: risers.length,
			overlap_cm3: (overlapCnt * h3) / 1000,
			leak_cells: leakCnt,
			warnings
		}
	};
}

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
	self.onmessage = function (ev) {
		const d = ev.data;
		try {
			const r = build(d.positions, d.params, d.res || 96);
			const transfer = [];
			for (const p of r.pieces) transfer.push(p.positions.buffer);
			for (const f of r.fills) transfer.push(f.positions.buffer);
			self.postMessage({ id: d.id, ok: true, pieces: r.pieces, fills: r.fills, markers: r.markers, stats: r.stats }, transfer);
		} catch (err) {
			self.postMessage({ id: d.id, ok: false, error: String((err && err.message) || err) });
		}
	};
}