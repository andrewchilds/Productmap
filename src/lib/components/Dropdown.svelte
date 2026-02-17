<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { scale } from "svelte/transition";

	type T = $$Generic;

	export let value: T;
	export let options: { value: T; label: string; icon?: typeof import("lucide-svelte").Sun; shortcut?: string }[];
	export let header: string = "";
	export let displayValue: string = "";
	export let align: "left" | "right" = "right";

	const dispatch = createEventDispatcher<{
		change: T;
	}>();

	let showDropdown = false;

	$: selectedOption = options.find((o) => o.value === value);

	function handleSelect(newValue: T) {
		value = newValue;
		showDropdown = false;
		dispatch("change", newValue);
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest(".dropdown-container")) {
			showDropdown = false;
		}
	}

	$: if (showDropdown) {
		document.addEventListener("click", handleClickOutside);
	} else {
		document.removeEventListener("click", handleClickOutside);
	}
</script>

<div class="dropdown-container">
	<button
		class="dropdown-trigger"
		on:click={() => (showDropdown = !showDropdown)}
		aria-label={header || "Select option"}
	>
		{#if selectedOption?.icon}
			<svelte:component this={selectedOption.icon} size={16} />
		{/if}
		<span class="trigger-label">{selectedOption?.label ?? displayValue}</span>
	</button>

	{#if showDropdown}
		<div class="dropdown" class:align-left={align === "left"} transition:scale={{ duration: 100, start: 0.95 }}>
			{#if header}
				<div class="dropdown-header">{header}</div>
			{/if}
			{#each options as option (option.value)}
				<button
					class="dropdown-item"
					class:selected={option.value === value}
					on:click={() => handleSelect(option.value)}
				>
					{#if option.icon}
						<svelte:component this={option.icon} size={14} />
					{/if}
					<span>{option.label}</span>
					{#if option.shortcut}
						<kbd class="shortcut">{option.shortcut}</kbd>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dropdown-container {
		position: relative;
	}

	.dropdown-trigger {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-width: 32px;
		height: 32px;
		padding: 0 var(--spacing-sm);
		border-radius: var(--radius-sm);
		color: var(--button-ghost-text);
		background: var(--button-ghost-bg);
		transition: background var(--transition-fast);
	}

	.dropdown-trigger:hover {
		background: var(--button-ghost-bg-hover);
	}

	.trigger-label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
	}

	.dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: var(--spacing-xs);
		min-width: 140px;
		background: var(--modal-bg);
		border: 1px solid var(--modal-border);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px var(--modal-shadow);
		z-index: 1000;
		overflow: hidden;
	}

	.dropdown.align-left {
		right: auto;
		left: 0;
	}

	.dropdown-header {
		padding: var(--spacing-sm) var(--spacing-sm2);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
		color: var(--app-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-sm2);
		font-size: var(--font-size-sm);
		color: var(--app-text);
		background: transparent;
		text-align: left;
		transition: background var(--transition-fast);
	}

	.shortcut {
		margin-left: auto;
		padding: 2px 6px;
		font-family: var(--font-mono, monospace);
		font-size: var(--font-size-xs);
		color: var(--app-text-muted);
		background: var(--button-secondary-bg);
		border: 1px solid var(--button-secondary-border);
		border-radius: var(--radius-sm);
	}

	.dropdown-item.selected .shortcut {
		color: var(--button-primary-text);
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.dropdown-item:hover {
		background: var(--button-ghost-bg-hover);
	}

	.dropdown-item.selected {
		background: var(--button-primary-bg);
		color: var(--button-primary-text);
	}
</style>
