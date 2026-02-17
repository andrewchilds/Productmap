<script lang="ts">
	import { NEW_CARD_HEIGHT, NEW_CARD_WIDTH } from "$lib/constants";
	import { Plus } from "lucide-svelte";

	export let x: number;
	export let y: number;
	export let zoomLevel: number = 1;

	$: scaledX = x * zoomLevel;
	$: scaledY = y * zoomLevel;
	$: scaledWidth = NEW_CARD_WIDTH * zoomLevel;
	$: scaledHeight = NEW_CARD_HEIGHT * zoomLevel;
</script>

<button
	class="ghost-card"
	style="left: {scaledX}px; top: {scaledY}px; width: {scaledWidth}px; height: {scaledHeight}px;"
	on:click
>
	<Plus size={24} />
</button>

<style>
	.ghost-card {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--task-ghost-bg);
		border: 2px dashed var(--task-ghost-border);
		border-radius: var(--radius-md);
		color: var(--task-ghost-icon);
		cursor: pointer;
		transition:
			background var(--transition-fast),
			color var(--transition-fast);
	}

	.ghost-card:hover {
		background: var(--task-ghost-border);
		color: var(--task-bg);
	}
</style>
