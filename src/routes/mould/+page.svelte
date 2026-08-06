<script>
	// ==========================================================================
	// STUDIO SHELL — one entry point that hosts BOTH tools:
	//   • Mould generator  (MouldStudio.svelte)  — unchanged logic
	//   • STL editor        (StlEditor.svelte)
	//
	// The shell owns the single shared model (file + ArrayBuffer). Uploading in
	// either tool fills it; the STL editor's "Send to Mould generator →" hands
	// its edited result back here and flips the mode — so there is no
	// re-uploading between editing a part and moulding it.
	//
	// Both tool components stay MOUNTED (their params / sketch / undo survive a
	// mode switch), but each tool mounts its heavy 3D viewport only while it is
	// the ACTIVE mode. That guarantees the viewport re-initialises and repaints
	// when you switch back — fixing the "blank when returning to the mould tab"
	// issue — and means only one WebGL context runs at a time.
	//
	// The inactive pane is hidden with an inline `display:none` (not a CSS
	// class) so it never depends on scoped-style handling.
	// ==========================================================================
	import MouldStudio from '$lib/components/MouldStudio.svelte';
	import StlEditor from '$lib/components/StlEditor.svelte';

	let mode = $state('mould'); // 'mould' | 'edit'
	let file = $state(null); // shared File
	let buffer = $state(null); // shared ArrayBuffer

	function setShared(f, b) {
		file = f;
		buffer = b;
	}
	function switchMode(m) {
		mode = m;
	}
</script>

<div class="pane" style:display={mode === 'mould' ? 'contents' : 'none'}>
	<MouldStudio
		{file}
		modelBuffer={buffer}
		active={mode === 'mould'}
		onShared={setShared}
		onSwitch={switchMode} />
</div>

<div class="pane" style:display={mode === 'edit' ? 'contents' : 'none'}>
	<StlEditor
		sharedFile={file}
		sharedBuffer={buffer}
		active={mode === 'edit'}
		onShared={setShared}
		onSwitch={switchMode} />
</div>