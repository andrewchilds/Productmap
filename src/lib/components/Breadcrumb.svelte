<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { ChevronRight, Home } from 'lucide-svelte';
	import type { Task } from '$lib/types';

	export let navigationPath: Task[];
	export let projectName: string;

	const dispatch = createEventDispatcher<{
		navigate: number;
	}>();

	function handleNavigate(index: number) {
		dispatch('navigate', index);
	}
</script>

<nav class="breadcrumb">
	<button class="breadcrumb-item" on:click={() => handleNavigate(-1)}>
		<Home size={14} />
		<span>{projectName}</span>
	</button>

	{#each navigationPath as task, index}
		<ChevronRight size={14} class="separator" />
		<button
			class="breadcrumb-item"
			class:current={index === navigationPath.length - 1}
			on:click={() => handleNavigate(index)}
		>
			{task.name}
		</button>
	{/each}
</nav>

<style>
	.breadcrumb {
		position: absolute;
		top: var(--spacing-md);
		left: var(--spacing-md);
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--breadcrumb-bg);
		border: 1px solid var(--breadcrumb-border);
		border-radius: var(--radius-md);
		backdrop-filter: blur(8px);
		z-index: 50;
	}

	.breadcrumb-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		font-size: var(--font-size-sm);
		color: var(--breadcrumb-text);
		transition: color var(--transition-fast);
	}

	.breadcrumb-item:hover {
		color: var(--breadcrumb-text-hover);
	}

	.breadcrumb-item.current {
		font-weight: var(--font-weight-medium);
		cursor: default;
	}

	.breadcrumb-item.current:hover {
		color: var(--breadcrumb-text);
	}

	:global(.separator) {
		color: var(--breadcrumb-separator);
		flex-shrink: 0;
	}
</style>
