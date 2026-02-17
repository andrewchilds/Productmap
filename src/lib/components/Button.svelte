<script lang="ts">
	export let variant: "primary" | "secondary" | "ghost" = "primary";
	export let size: "sm" | "md" | "lg" = "md";
	export let disabled: boolean = false;
	export let type: "button" | "submit" = "button";
</script>

<button class="btn btn-{variant} size-{size}" {type} {disabled} on:click>
	<slot />
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-xs);
		border: none;
		border-radius: var(--radius-sm);
		font-weight: var(--font-weight-medium);
		cursor: pointer;
		user-select: none;
		transition:
			background-color 180ms,
			filter 180ms,
			box-shadow 180ms,
			transform 180ms;
		text-decoration: none;
	}

	.btn:active {
		transform: scale(0.95);
	}

	.size-sm {
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: var(--font-size-xs);
	}

	.size-md {
		padding: var(--spacing-sm) var(--spacing-md);
		font-size: var(--font-size-xs);
	}

	.size-lg {
		padding: var(--spacing-sm2) var(--spacing-lg);
		font-size: var(--font-size-md);
	}

	.btn-primary {
		background: var(--button-primary-bg);
		color: var(--button-primary-text);
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--button-primary-bg-hover);
	}

	.btn-secondary {
		background: var(--button-secondary-bg);
		color: var(--button-secondary-text);
		border: 1px solid var(--button-secondary-border);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--button-secondary-bg-hover);
	}

	.btn-ghost {
		background: var(--button-ghost-bg);
		color: var(--button-ghost-text);
	}

	.btn-ghost:hover:not(:disabled) {
		background: var(--button-ghost-bg-hover);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
