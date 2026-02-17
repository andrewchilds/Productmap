<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import type { TaskColor } from "$lib/types";
	import Tooltip from "./Tooltip.svelte";

	export let value: TaskColor = "gray";

	const dispatch = createEventDispatcher<{
		change: TaskColor;
	}>();

	let isOpen = false;

	const colors: { value: TaskColor; hue: string }[] = [
		{ value: "gray", hue: "0, 0%" },
		{ value: "red", hue: "var(--hue-red), 70%" },
		{ value: "orange", hue: "var(--hue-orange), 70%" },
		{ value: "yellow", hue: "var(--hue-yellow), 70%" },
		{ value: "lime", hue: "var(--hue-lime), 60%" },
		{ value: "green", hue: "var(--hue-green), 55%" },
		{ value: "teal", hue: "var(--hue-teal), 55%" },
		{ value: "cyan", hue: "var(--hue-cyan), 60%" },
		{ value: "blue", hue: "var(--hue-blue), 70%" },
		{ value: "indigo", hue: "var(--hue-indigo), 60%" },
		{ value: "purple", hue: "var(--hue-purple), 60%" },
		{ value: "pink", hue: "var(--hue-pink), 65%" }
	];

	$: selectedColor = colors.find((c) => c.value === value) || colors[0];

	function selectColor(color: TaskColor) {
		value = color;
		isOpen = false;
		dispatch("change", color);
	}

	function handleToggle() {
		isOpen = !isOpen;
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest(".color-picker")) {
			isOpen = false;
		}
	}

	function getSwatchStyle(hue: string): string {
		return `background: hsl(${hue}, 50%)`;
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="color-picker">
		<button class="color-trigger" on:click|stopPropagation={handleToggle}>
		<span class="swatch" style={getSwatchStyle(selectedColor.hue)}></span>
		<span class="label">{selectedColor.value}</span>
	</button>

	{#if isOpen}
		<div class="dropdown">
			<div class="swatches">
				{#each colors as color (color.value)}
					<Tooltip text={color.value} position="top" delay={200}>
						<button
							class="swatch-option"
							class:selected={color.value === value}
							style={getSwatchStyle(color.hue)}
							on:click|stopPropagation={() => selectColor(color.value)}
							aria-label={color.value}
						></button>
					</Tooltip>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.color-picker {
		position: relative;
	}

	.color-trigger {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-width: 32px;
		height: 32px;
		padding: 0 var(--spacing-sm);
		border-radius: var(--radius-sm);
		color: var(--button-ghost-text);
		background: var(--button-ghost-bg);
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.color-trigger:hover {
		background: var(--button-ghost-bg-hover);
	}

	.swatch {
		width: 16px;
		height: 16px;
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}

	.label {
		text-transform: capitalize;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
	}

	.dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		width: 200px;
		margin-top: var(--spacing-xs);
		padding: var(--spacing-sm);
		background: var(--input-bg);
		border: 1px solid var(--input-border);
		border-radius: var(--radius-sm);
		box-shadow: 0 4px 12px var(--task-shadow);
		z-index: 10;
	}

	.swatches {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--spacing-xs);
	}

	.swatch-option {
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--radius-sm);
		cursor: pointer;
		border: 2px solid transparent;
		transition: all var(--transition-fast);
	}

	.swatch-option:hover {
		transform: scale(1.1);
	}

	.swatch-option.selected {
		border-color: var(--app-text);
	}
</style>
