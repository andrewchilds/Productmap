<script lang="ts">
	import { onDestroy } from "svelte";

	export let text: string;
	export let position: "top" | "bottom" | "left" | "right" = "top";
	export let delay: number = 300;

	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let wrapperEl: HTMLSpanElement;
	let tooltipEl: HTMLSpanElement | null = null;
	let tooltipStyle = "";

	const OFFSET = 4;

	function updatePosition() {
		if (!wrapperEl || !tooltipEl) return;

		const rect = wrapperEl.getBoundingClientRect();
		const tooltipRect = tooltipEl.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let top = 0;
		let left = 0;

		switch (position) {
			case "top":
				top = rect.top - tooltipRect.height - OFFSET;
				left = rect.left + rect.width / 2 - tooltipRect.width / 2;
				break;
			case "bottom":
				top = rect.bottom + OFFSET;
				left = rect.left + rect.width / 2 - tooltipRect.width / 2;
				break;
			case "left":
				top = rect.top + rect.height / 2 - tooltipRect.height / 2;
				left = rect.left - tooltipRect.width - OFFSET;
				break;
			case "right":
				top = rect.top + rect.height / 2 - tooltipRect.height / 2;
				left = rect.right + OFFSET;
				break;
		}

		// Clamp to viewport bounds
		if (left < OFFSET) {
			left = OFFSET;
		} else if (left + tooltipRect.width > viewportWidth - OFFSET) {
			left = viewportWidth - tooltipRect.width - OFFSET;
		}

		if (top < OFFSET) {
			top = OFFSET;
		} else if (top + tooltipRect.height > viewportHeight - OFFSET) {
			top = viewportHeight - tooltipRect.height - OFFSET;
		}

		tooltipStyle = `top: ${top}px; left: ${left}px;`;
	}

	function createTooltip() {
		if (tooltipEl) return;

		tooltipEl = document.createElement("span");
		tooltipEl.className = "tooltip-portal";
		tooltipEl.setAttribute("role", "tooltip");
		tooltipEl.textContent = text;
		document.body.appendChild(tooltipEl);

		// Position after adding to DOM so we can measure it
		requestAnimationFrame(updatePosition);
	}

	function removeTooltip() {
		if (tooltipEl) {
			tooltipEl.remove();
			tooltipEl = null;
		}
	}

	function handleMouseEnter() {
		timeoutId = setTimeout(() => {
			createTooltip();
		}, delay);
	}

	function handleMouseLeave() {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
		removeTooltip();
	}

	$: if (tooltipEl) {
		tooltipEl.textContent = text;
		tooltipEl.style.cssText = tooltipStyle;
	}

	onDestroy(() => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		removeTooltip();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class="tooltip-wrapper" bind:this={wrapperEl} on:mouseenter={handleMouseEnter} on:mouseleave={handleMouseLeave}>
	<slot />
</span>

<style>
	.tooltip-wrapper {
		display: inline-flex;
	}

	:global(.tooltip-portal) {
		position: fixed;
		z-index: 10000;
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		white-space: nowrap;
		color: var(--tooltip-text);
		background: var(--tooltip-bg);
		border-radius: var(--radius-sm);
		box-shadow: 0 2px 8px var(--tooltip-shadow);
		pointer-events: none;
	}
</style>
