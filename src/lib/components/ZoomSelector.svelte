<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { zoom, formatZoomLabel } from "$lib/stores/zoom";
	import Dropdown from "./Dropdown.svelte";

	const dispatch = createEventDispatcher<{
		change: number;
	}>();

	const options = [
		{ value: 0.1, label: formatZoomLabel(0.1) },
		{ value: 0.25, label: formatZoomLabel(0.25) },
		{ value: 0.5, label: formatZoomLabel(0.5) },
		{ value: 0.75, label: formatZoomLabel(0.75) },
		{ value: 1, label: formatZoomLabel(1), shortcut: "0" },
		{ value: 1.25, label: formatZoomLabel(1.25) },
		{ value: 1.5, label: formatZoomLabel(1.5) },
		{ value: 2, label: formatZoomLabel(2) },
		{ value: 3, label: formatZoomLabel(3) },
		{ value: 4, label: formatZoomLabel(4) }
	];

	function handleChange(e: CustomEvent<number>) {
		dispatch("change", e.detail);
	}
</script>

<Dropdown {options} value={$zoom} displayValue={formatZoomLabel($zoom)} header="Zoom" on:change={handleChange} />
