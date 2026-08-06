<script>
	// ==========================================================================
	// StlEditorViewport — renders the working STL, the active reference plane
	// (with U/V/N axes + grid), the 2D sketch drawn on that plane, and a live
	// extrude / cut / text preview. Click-to-draw raycasts onto the plane and
	// reports (u,v) points back via onSketchPoint. Requires: three.
	// ==========================================================================
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import { STLLoader } from 'three/addons/loaders/STLLoader.js';

	let {
		modelBuffer = null,
		fileName = 'model.stl',
		plane = null, // { origin:[3], u:[3], v:[3], n:[3], name }
		sketch = [], // committed contours: [[ [u,v], ... ], ...]
		currentContour = [], // in-progress points [[u,v], ...]
		sketchMode = false,
		preview = null, // { kind:'extrude'|'text', ... }
		onSketchPoint = () => {},
		onBBox = () => {}
	} = $props();

	let canvasEl, wrapEl;
	let renderer, scene, camera, controls, raf, ro;
	let partGroup = null,
		planeGroup = null,
		sketchGroup = null,
		previewGroup = null;
	let bbox = null,
		firstFit = true;
	let ready = $state(false);
	let parseError = $state('');

	// ---- vector helpers on plane frame --------------------------------------
	function basis() {
		if (!plane) return null;
		return {
			O: new THREE.Vector3(...plane.origin),
			U: new THREE.Vector3(...plane.u),
			V: new THREE.Vector3(...plane.v),
			N: new THREE.Vector3(...plane.n)
		};
	}
	function uvToWorld(b, u, v) {
		return b.O.clone().addScaledVector(b.U, u).addScaledVector(b.V, v);
	}
	function basisMatrix(b, wOffset = 0) {
		const m = new THREE.Matrix4().makeBasis(b.U, b.V, b.N);
		m.setPosition(b.O.clone().addScaledVector(b.N, wOffset));
		return m;
	}

	// ---- lifecycle ----------------------------------------------------------
	onMount(() => {
		renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(40, 1, 0.1, 12000);
		camera.position.set(160, -180, 140);
		camera.up.set(0, 0, 1);
		controls = new OrbitControls(camera, canvasEl);
		controls.enableDamping = true;
		controls.dampingFactor = 0.08;
		scene.add(new THREE.AmbientLight(0xffffff, 0.7));
		const k = new THREE.DirectionalLight(0xffffff, 0.85);
		k.position.set(120, -160, 220);
		scene.add(k);
		const f = new THREE.DirectionalLight(0xffffff, 0.3);
		f.position.set(-140, 120, -60);
		scene.add(f);

		const resize = () => {
			if (!wrapEl) return;
			const w = wrapEl.clientWidth;
			const h = wrapEl.clientHeight || Math.max(300, Math.round(w * 0.62));
			renderer.setSize(w, h, false);
			camera.aspect = w / Math.max(1, h);
			camera.updateProjectionMatrix();
		};
		ro = new ResizeObserver(resize);
		ro.observe(wrapEl);
		resize();

		canvasEl.addEventListener('pointerdown', onPointerDown);
		canvasEl.addEventListener('pointerup', onPointerUp);

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
		canvasEl && canvasEl.removeEventListener('pointerdown', onPointerDown);
		canvasEl && canvasEl.removeEventListener('pointerup', onPointerUp);
		[partGroup, planeGroup, sketchGroup, previewGroup].forEach(disposeGroup);
		renderer && renderer.dispose();
	});

	function disposeGroup(g) {
		if (!g) return;
		g.traverse((o) => {
			if (o.geometry) o.geometry.dispose();
			if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
			if (o.material && o.material.map) o.material.map.dispose();
		});
		scene && scene.remove(g);
	}

	// ---- part loading -------------------------------------------------------
	function loadPart() {
		disposeGroup(partGroup);
		partGroup = null;
		parseError = '';
		if (!modelBuffer) {
			bbox = null;
			return;
		}
		try {
			const geo = new STLLoader().parse(modelBuffer);
			geo.computeVertexNormals();
			const mat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.1, roughness: 0.75, side: THREE.DoubleSide });
			partGroup = new THREE.Group();
			partGroup.add(new THREE.Mesh(geo, mat));
			scene.add(partGroup);
			bbox = new THREE.Box3().setFromObject(partGroup);
			onBBox([bbox.min.x, bbox.min.y, bbox.min.z], [bbox.max.x, bbox.max.y, bbox.max.z]);
			if (firstFit) {
				fitView();
				firstFit = false;
			}
		} catch (e) {
			parseError = 'Could not parse this STL. The editor accepts binary/ASCII STL only.';
		}
	}

	// ---- overlays -----------------------------------------------------------
	function rebuildOverlays() {
		disposeGroup(planeGroup);
		disposeGroup(sketchGroup);
		disposeGroup(previewGroup);
		planeGroup = sketchGroup = previewGroup = null;
		if (!plane) return;
		const b = basis();
		const span = bbox ? bbox.getSize(new THREE.Vector3()).length() * 0.6 : 60;

		// -- plane quad + grid + axes --
		planeGroup = new THREE.Group();
		const M = basisMatrix(b, 0);
		const quad = new THREE.Mesh(
			new THREE.PlaneGeometry(span * 2, span * 2),
			new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false })
		);
		quad.applyMatrix4(M);
		planeGroup.add(quad);
		// grid lines in (u,v)
		const step = span / 5;
		const gpts = [];
		for (let s = -5; s <= 5; s++) {
			const t = s * step;
			gpts.push(uvToWorld(b, t, -span), uvToWorld(b, t, span));
			gpts.push(uvToWorld(b, -span, t), uvToWorld(b, span, t));
		}
		const gg = new THREE.BufferGeometry().setFromPoints(gpts);
		planeGroup.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.4 })));
		// U (red) / V (green) / N (blue) arrows
		const al = span * 0.5;
		planeGroup.add(new THREE.ArrowHelper(b.U, b.O, al, 0xef4444, al * 0.12, al * 0.07));
		planeGroup.add(new THREE.ArrowHelper(b.V, b.O, al, 0x22c55e, al * 0.12, al * 0.07));
		planeGroup.add(new THREE.ArrowHelper(b.N, b.O, al * 0.8, 0x3b82f6, al * 0.12, al * 0.07));
		scene.add(planeGroup);

		// -- committed + current sketch --
		sketchGroup = new THREE.Group();
		const drawContour = (pts, color, loop, dots) => {
			if (pts.length < 1) return;
			const wp = pts.map((p) => uvToWorld(b, p[0], p[1]));
			if (wp.length >= 2) {
				const geo = new THREE.BufferGeometry().setFromPoints(loop ? [...wp, wp[0]] : wp);
				sketchGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })));
			}
			if (dots) {
				const dg = new THREE.SphereGeometry(span * 0.012, 10, 8);
				const dm = new THREE.MeshBasicMaterial({ color });
				wp.forEach((p) => {
					const s = new THREE.Mesh(dg, dm);
					s.position.copy(p);
					sketchGroup.add(s);
				});
			}
		};
		(sketch || []).forEach((c) => drawContour(c, 0x2563eb, true, false));
		drawContour(currentContour || [], 0xf59e0b, false, true);
		scene.add(sketchGroup);

		// -- live feature preview --
		if (preview) buildPreview(b);
	}

	function slabRange(kind, op, depth) {
		const reverse = op === 'extrude_cut' ? true : op === 'text_engrave';
		const ec = preview.end_condition || 'blind';
		let lo, hi;
		if (ec === 'symmetric') {
			lo = -depth / 2;
			hi = depth / 2;
		} else if (ec === 'through_all' && bbox) {
			const b = basis();
			let mn = Infinity,
				mx = -Infinity;
			for (const x of [bbox.min.x, bbox.max.x])
				for (const y of [bbox.min.y, bbox.max.y])
					for (const z of [bbox.min.z, bbox.max.z]) {
						const w = new THREE.Vector3(x, y, z).sub(b.O).dot(b.N);
						mn = Math.min(mn, w);
						mx = Math.max(mx, w);
					}
			lo = mn;
			hi = mx;
		} else {
			lo = reverse ? -depth : 0;
			hi = reverse ? 0 : depth;
		}
		return [lo, hi];
	}

	function buildPreview(b) {
		previewGroup = new THREE.Group();
		if (preview.kind === 'extrude' && preview.sketch && preview.sketch.length) {
			const outer = preview.sketch[0];
			if (outer.length >= 3) {
				const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p[0], p[1])));
				for (let i = 1; i < preview.sketch.length; i++) {
					const h = preview.sketch[i];
					if (h.length >= 3) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1]))));
				}
				const [lo, hi] = slabRange('extrude', preview.operation, Math.max(0.1, preview.depth));
				const geo = new THREE.ExtrudeGeometry(shape, { depth: hi - lo, bevelEnabled: false });
				geo.translate(0, 0, lo);
				geo.applyMatrix4(basisMatrix(b, 0));
				const cut = preview.operation === 'extrude_cut';
				const mat = new THREE.MeshStandardMaterial({
					color: cut ? 0xef4444 : 0x22c55e,
					transparent: true,
					opacity: 0.4,
					roughness: 0.6,
					side: THREE.DoubleSide,
					depthWrite: false
				});
				previewGroup.add(new THREE.Mesh(geo, mat));
				try {
					previewGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: cut ? 0xb91c1c : 0x15803d })));
				} catch (e) {}
			}
		} else if (preview.kind === 'text' && preview.text) {
			// approximate text placement as a textured quad on the plane
			const ppm = 24;
			const fpx = Math.max(4, preview.size * ppm);
			const cnv = document.createElement('canvas');
			const ctx = cnv.getContext('2d');
			ctx.font = `700 ${fpx}px system-ui, sans-serif`;
			const lines = preview.text.split('\n');
			const wpx = Math.max(1, ...lines.map((l) => ctx.measureText(l).width));
			const lh = fpx * (preview.line_spacing_factor || 1.25);
			cnv.width = Math.ceil(wpx + fpx * 0.4);
			cnv.height = Math.ceil(lh * lines.length + fpx * 0.4);
			ctx.font = `700 ${fpx}px system-ui, sans-serif`;
			ctx.fillStyle = 'rgba(0,0,0,0)';
			ctx.fillRect(0, 0, cnv.width, cnv.height);
			ctx.fillStyle = preview.operation === 'text_engrave' ? '#b91c1c' : '#15803d';
			ctx.textBaseline = 'top';
			lines.forEach((l, i) => ctx.fillText(l, fpx * 0.2, fpx * 0.2 + i * lh));
			const tex = new THREE.CanvasTexture(cnv);
			tex.anisotropy = 4;
			const wMM = cnv.width / ppm,
				hMM = cnv.height / ppm;
			const geo = new THREE.PlaneGeometry(wMM, hMM);
			// anchor: text_pos is the baseline-left; nudge quad to its centre
			const cu = preview.pos[0] + (preview.align === 'center' ? 0 : preview.align === 'right' ? -wMM / 2 : wMM / 2);
			const cv = preview.pos[1] - hMM / 2;
			geo.translate(cu, cv, preview.operation === 'text_engrave' ? -0.2 : 0.2);
			geo.applyMatrix4(basisMatrix(b, 0));
			previewGroup.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false })));
		}
		scene.add(previewGroup);
	}

	// ---- click-to-draw ------------------------------------------------------
	const ray = new THREE.Raycaster();
	let down = null;
	function onPointerDown(e) {
		down = { x: e.clientX, y: e.clientY, t: Date.now() };
	}
	function onPointerUp(e) {
		if (!down) return;
		const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
		const dt = Date.now() - down.t;
		down = null;
		if (!sketchMode || !plane || moved > 6 || dt > 600 || e.button !== 0) return;
		const rect = canvasEl.getBoundingClientRect();
		const ndc = { x: ((e.clientX - rect.left) / rect.width) * 2 - 1, y: -((e.clientY - rect.top) / rect.height) * 2 + 1 };
		ray.setFromCamera(ndc, camera);
		const b = basis();
		const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(b.N, b.O);
		const hit = ray.ray.intersectPlane(pl, new THREE.Vector3());
		if (!hit) return;
		const rel = hit.sub(b.O);
		onSketchPoint([+rel.dot(b.U).toFixed(4), +rel.dot(b.V).toFixed(4)]);
	}

	// ---- exposed controls ---------------------------------------------------
	export function fitView() {
		if (!bbox) return;
		const c = bbox.getCenter(new THREE.Vector3());
		const size = bbox.getSize(new THREE.Vector3()).length() || 100;
		controls.target.copy(c);
		const dir = new THREE.Vector3(1.0, -1.15, 0.85).normalize();
		camera.up.set(0, 0, 1);
		camera.position.copy(c.clone().add(dir.multiplyScalar(size * 2.1)));
		camera.near = size / 100;
		camera.far = size * 40;
		camera.updateProjectionMatrix();
	}
	export function lookAtPlane() {
		if (!plane || !bbox) return;
		const b = basis();
		const size = bbox.getSize(new THREE.Vector3()).length() || 100;
		controls.target.copy(b.O);
		camera.up.copy(b.V);
		camera.position.copy(b.O.clone().addScaledVector(b.N, size * 1.8));
		camera.near = size / 100;
		camera.far = size * 40;
		camera.updateProjectionMatrix();
	}

	// ---- reactivity ---------------------------------------------------------
	$effect(() => {
		modelBuffer;
		if (ready) loadPart();
	});
	$effect(() => {
		plane;
		sketch;
		currentContour;
		preview;
		sketchMode;
		if (ready) rebuildOverlays();
	});
	$effect(() => {
		if (controls) controls.enableRotate = !sketchMode;
	});
</script>

<div class="vp" bind:this={wrapEl} class:draw={sketchMode}>
	<canvas bind:this={canvasEl}></canvas>
	{#if sketchMode && plane}
		<div class="vp-hint">Click on the plane to add sketch points · double-add to place · use “Close contour” when done</div>
	{:else if sketchMode && !plane}
		<div class="vp-hint warn">Pick a reference plane first (Planes tab)</div>
	{/if}
	{#if parseError}<div class="vp-hint warn">{parseError}</div>{/if}
</div>

<style>
	.vp {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: radial-gradient(ellipse at 30% 20%, #f8fafc 0%, #eef2f7 100%);
	}
	.vp.draw canvas {
		cursor: crosshair;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.vp-hint {
		position: absolute;
		bottom: 12px;
		left: 12px;
		right: 12px;
		font-size: 11.5px;
		font-weight: 600;
		color: #475569;
		background: rgba(255, 255, 255, 0.9);
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 7px 12px;
		backdrop-filter: blur(4px);
	}
	.vp-hint.warn {
		color: #92400e;
		background: #fffbeb;
		border-color: #fde68a;
	}
</style>