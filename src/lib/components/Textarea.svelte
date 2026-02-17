<script lang="ts">
	import { createEventDispatcher, afterUpdate } from "svelte";

	export let value: string = "";
	export let placeholder: string = "";
	export let autoResize: boolean = false;
	export let rows: number = 2;

	let textarea: HTMLTextAreaElement;
	const dispatch = createEventDispatcher();

	function resize() {
		if (!autoResize || !textarea) return;
		textarea.style.height = "auto";
		textarea.style.height = textarea.scrollHeight + "px";
	}

	afterUpdate(() => {
		resize();
	});

	function handleInput(e: Event) {
		value = (e.target as HTMLTextAreaElement).value;
		resize();
		dispatch("input", e);
	}
</script>

<textarea
	bind:this={textarea}
	{value}
	{placeholder}
	{rows}
	on:input={handleInput}
	on:blur
	on:focus
	on:keydown
	{...$$restProps}
></textarea>

<style>
	textarea {
		width: 100%;
		padding: var(--spacing-sm);
		font-size: var(--font-size-sm);
		font-family: inherit;
		background: var(--input-bg);
		border: 1px solid var(--input-border);
		border-radius: var(--radius-sm);
		color: var(--input-text);
		resize: vertical;
	}

	textarea:focus {
		outline: none;
		border-color: var(--input-border-focus);
	}
</style>
