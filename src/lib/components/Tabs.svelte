<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let tabs: { id: string; label: string }[] = [];
	export let activeTab: string = tabs[0]?.id ?? "";
	export let indicators: Record<string, "active" | "inactive"> = {};

	const dispatch = createEventDispatcher<{
		change: string;
	}>();

	function selectTab(id: string) {
		activeTab = id;
		dispatch("change", id);
	}
</script>

<div class="tabs">
	{#each tabs as tab (tab.id)}
		<button
			class="tab"
			class:active={activeTab === tab.id}
			on:click={() => selectTab(tab.id)}
		>
			{#if indicators[tab.id]}
				<span
					class="indicator"
					class:indicator-active={indicators[tab.id] === "active"}
					class:indicator-inactive={indicators[tab.id] === "inactive"}
				></span>
			{/if}
			{tab.label}
		</button>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--shelf-border);
		padding: 0 var(--spacing-md);
	}

	.tab {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm) var(--spacing-md);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--app-text-muted);
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: all var(--transition-fast);
	}

	.indicator {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.indicator-active {
		background: var(--state-completed);
	}

	.indicator-inactive {
		background: var(--app-text-faint);
	}

	.tab:hover {
		color: var(--app-text);
	}

	.tab.active {
		color: var(--app-text);
		border-bottom-color: var(--button-primary-bg);
	}
</style>
