<script lang="ts">
	export let align: "left" | "right" = "left";
</script>

<div class="actions align-{align}">
	<slot></slot>
</div>

<style>
	.actions {
		display: inline-flex;
	}

	.actions.align-left {
		justify-content: flex-start;
	}

	.actions.align-right {
		justify-content: flex-end;
	}
</style>
