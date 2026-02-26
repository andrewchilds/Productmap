<script lang="ts">
	type Hue = "red" | "orange" | "yellow" | "lime" | "green" | "teal" | "cyan" | "blue" | "indigo" | "purple" | "pink";
	export let hue: Hue | undefined = undefined;
</script>

<span
	class="badge"
	class:colored={hue !== undefined}
	style={hue !== undefined ? `--badge-hue: var(--hue-${hue})` : ""}
>
	<slot />
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 var(--spacing-xs);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		border-radius: var(--radius-sm);
		background: var(--badge-bg);
		color: var(--badge-text);
	}

	.badge.colored {
		background: hsla(var(--badge-hue), 60%, 50%, 0.2);
		color: hsl(var(--badge-hue), 60%, 50%);
	}
</style>
