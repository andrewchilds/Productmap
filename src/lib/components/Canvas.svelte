<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import type { Task } from "$lib/types";
	import TaskCard from "./TaskCard.svelte";
	import GhostCard from "./GhostCard.svelte";
	import { clearSelection } from "$lib/stores/selection";
	import { getCanvasContext } from "$lib/stores/canvas-context";
	import { getCanvasOffsetsContext, type CanvasOffsetsContext } from "$lib/stores/canvas-offsets";
	import { dragState } from "$lib/stores/drag-state";
	import { CARD_PROXIMITY_THRESHOLD, NEW_CARD_WIDTH, NEW_CARD_HEIGHT } from "$lib/constants";
	import {
		zoom,
		BASE_GRID_SIZE,
		calculateZoomOffset,
		ZOOM_WHEEL_SENSITIVITY,
		MIN_ZOOM,
		MAX_ZOOM
	} from "$lib/stores/zoom";

	export let tasks: Task[];
	export let parentTask: Task | null = null;
	export let embedded: boolean = false;
	export let canvasKey: string = "";
	export let zoomLevel: number = 1;

	const ctx = getCanvasContext();

	// Get the offsets context (created by +page.svelte for root, passed through context for embedded)
	const offsetsCtx: CanvasOffsetsContext | null = getCanvasOffsetsContext();

	// Get the store from context (if available)
	const offsetsStore = offsetsCtx?.store;

	let canvasEl: HTMLDivElement;
	let isPanning = false;
	let panStart = { x: 0, y: 0 };
	let mouseDownPos: { x: number; y: number } | null = null;
	let ghostPosition: { x: number; y: number } | null = null;
	let isShiftHeld = false;
	let zoomSaveTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Shift" && !isShiftHeld) {
			isShiftHeld = true;
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		if (e.key === "Shift") {
			isShiftHeld = false;
			ghostPosition = null;
		}
	}

	onMount(() => {
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
	});

	onDestroy(() => {
		window.removeEventListener("keydown", handleKeyDown);
		window.removeEventListener("keyup", handleKeyUp);
		if (zoomSaveTimeout) clearTimeout(zoomSaveTimeout);
	});

	// Warp-out detection: when dragging over empty canvas (not embedded)
	$: isWarpOutTarget = !embedded && $dragState.dropToRoot;

	// Load offsets when canvasKey changes (root canvas only)
	$: if (!embedded && canvasKey && offsetsCtx) {
		offsetsCtx.load(`productmap:canvas-offset:${canvasKey}`);
	}

	// Get offset from store - root canvas uses main offset, embedded uses embedded[taskId]
	$: offsetsData = offsetsStore ? $offsetsStore : null;
	$: offset = offsetsData
		? embedded && parentTask
			? (offsetsData.embedded[parentTask.id] ?? { x: 0, y: 0 })
			: offsetsData.offset
		: { x: 0, y: 0 };

	// Compute effective zoom for this canvas
	$: effectiveZoom = embedded ? zoomLevel : $zoom;

	// Compute grid size based on zoom level (for visual grid)
	$: gridSize = BASE_GRID_SIZE * effectiveZoom;

	// Compute scaled offset for background grid positioning
	$: scaledOffsetX = offset.x * effectiveZoom;
	$: scaledOffsetY = offset.y * effectiveZoom;

	// For snapping, always use the base grid size (logical coordinates)
	function snapToGrid(value: number): number {
		return Math.round(value / BASE_GRID_SIZE) * BASE_GRID_SIZE;
	}

	// Convert screen coordinates to logical coordinates
	function screenToLogical(value: number): number {
		return embedded ? value / zoomLevel : value / $zoom;
	}

	function handleWheel(e: WheelEvent) {
		// Only handle zoom on root canvas
		if (embedded) return;
		if (!canvasEl || !offsetsCtx) return;

		e.preventDefault();

		const oldZoom = $zoom;
		// Use deltaY directly scaled by sensitivity for smooth trackpad zoom
		let zoomDelta = -e.deltaY * ZOOM_WHEEL_SENSITIVITY * oldZoom;
		console.log(oldZoom, e.deltaY, ZOOM_WHEEL_SENSITIVITY, zoomDelta);

		const minDelta = 0.02;
		if (zoomDelta > 0 && zoomDelta < minDelta) {
			zoomDelta = minDelta;
		} else if (zoomDelta < 0 && zoomDelta > -minDelta) {
			zoomDelta = -minDelta;
		}
		const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round((oldZoom + zoomDelta) * 100) / 100));

		// If zoom didn't change (at min/max or too small delta), do nothing
		if (oldZoom === newZoom) return;

		const rect = canvasEl.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		const newOffset = calculateZoomOffset(oldZoom, newZoom, mouseX, mouseY, offset);

		zoom.set(newZoom);
		offsetsCtx.setOffset(newOffset);

		// Debounce save to avoid blocking during rapid wheel events
		if (zoomSaveTimeout) clearTimeout(zoomSaveTimeout);
		zoomSaveTimeout = setTimeout(() => {
			offsetsCtx.save();
			zoomSaveTimeout = null;
		}, 150);
	}

	function wouldOverlapAnyTask(x: number, y: number): boolean {
		const ghostLeft = x - CARD_PROXIMITY_THRESHOLD;
		const ghostRight = x + NEW_CARD_WIDTH + CARD_PROXIMITY_THRESHOLD;
		const ghostTop = y - CARD_PROXIMITY_THRESHOLD;
		const ghostBottom = y + NEW_CARD_HEIGHT + CARD_PROXIMITY_THRESHOLD;

		return tasks.some((task) => {
			const taskRight = task.x + task.width;
			const taskBottom = task.y + task.height;
			return ghostLeft < taskRight && ghostRight > task.x && ghostTop < taskBottom && ghostBottom > task.y;
		});
	}

	function handleMouseDown(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target === canvasEl || target.classList.contains("canvas-content")) {
			// Stop propagation for embedded canvas to prevent parent TaskCard drag
			if (embedded) {
				e.stopPropagation();
			}
			isPanning = true;
			// For panning, we work in screen coordinates but need to account for zoom on offset
			const currentZoom = embedded ? zoomLevel : $zoom;
			panStart = { x: e.clientX - offset.x * currentZoom, y: e.clientY - offset.y * currentZoom };
			mouseDownPos = { x: e.clientX, y: e.clientY };
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (isPanning) {
			// Convert screen delta to logical offset
			const newOffset = {
				x: screenToLogical(e.clientX - panStart.x),
				y: screenToLogical(e.clientY - panStart.y)
			};
			// Update the store
			if (offsetsCtx) {
				if (embedded && parentTask) {
					offsetsCtx.setEmbeddedOffset(parentTask.id, newOffset);
				} else {
					offsetsCtx.setOffset(newOffset);
				}
			}
		} else {
			const target = e.target as HTMLElement;
			const isOverCanvas = target === canvasEl || target.classList.contains("canvas-content");
			const isOverGhost = target.closest(".ghost-card") !== null;

			// Handle warp-out detection (root canvas only)
			if (!embedded && $dragState.task && isOverCanvas) {
				// Check if the dragged task is from a different parent (needs to warp out)
				const draggedParentId = $dragState.parentTaskId;
				const currentParentId = parentTask?.id ?? null;
				if (draggedParentId !== currentParentId) {
					// Only trigger warp-out if the mouse is actually outside the parent task's bounds
					// (not just inside its embedded canvas which bubbles events up)
					const parentTaskCard = draggedParentId ? document.querySelector(`[data-task-id="${draggedParentId}"]`) : null;
					const isOutsideParent = !parentTaskCard || !parentTaskCard.contains(e.target as Node);

					if (isOutsideParent) {
						dragState.setDropToRoot(true);
						dragState.setDropTarget(null);
					}
				}
			}

			if (isShiftHeld && (isOverCanvas || isOverGhost)) {
				const rect = canvasEl.getBoundingClientRect();
				// Convert screen coordinates to logical coordinates
				const mouseX = screenToLogical(e.clientX - rect.left) - offset.x;
				const mouseY = screenToLogical(e.clientY - rect.top) - offset.y;
				// Center the ghost card on the mouse (in logical coordinates)
				const x = snapToGrid(mouseX - NEW_CARD_WIDTH / 2);
				const y = snapToGrid(mouseY - NEW_CARD_HEIGHT / 2);
				// Hide ghost if it would overlap any existing task card or if dragging
				if (wouldOverlapAnyTask(x, y) || $dragState.task) {
					ghostPosition = null;
				} else {
					ghostPosition = { x, y };
				}
			} else {
				// Hide ghost when not holding shift or hovering over task cards
				ghostPosition = null;
			}
		}
	}

	function handleMouseUp(e: MouseEvent) {
		if (isPanning) {
			// Check if this was a click (no significant movement) vs a pan
			const didPan =
				mouseDownPos && (Math.abs(e.clientX - mouseDownPos.x) > 3 || Math.abs(e.clientY - mouseDownPos.y) > 3);

			if (didPan && offsetsCtx) {
				// Save the entire offsets data (any canvas can trigger save)
				offsetsCtx.save();
			} else if (!didPan) {
				// Click on canvas background without panning - clear selection
				clearSelection();
			}
		}
		isPanning = false;
		mouseDownPos = null;
	}

	function handleGhostClick() {
		if (ghostPosition) {
			ctx.onTaskCreate(parentTask, ghostPosition.x, ghostPosition.y);
			ghostPosition = null;
		}
	}

	function handleTaskUpdate(task: Task) {
		ctx.onTaskUpdate(task);
	}

	function handleDrillDown(task: Task) {
		ctx.onDrillDown(task);
	}

	function handleWarp(e: CustomEvent<{ task: Task; targetTask: Task; targetX: number; targetY: number }>) {
		ctx.onTaskWarp(e.detail.task, e.detail.targetTask, e.detail.targetX, e.detail.targetY);
	}

	function handleWarpOut(e: CustomEvent<{ task: Task; x: number; y: number }>) {
		ctx.onTaskWarpOut(e.detail.task, e.detail.x, e.detail.y);
	}

	function handleCanvasMouseLeave() {
		isPanning = false;
		mouseDownPos = null;
		ghostPosition = null;
		// Clear warp-out target when leaving canvas
		if (!embedded && $dragState.dropToRoot) {
			dragState.setDropToRoot(false);
		}
	}
</script>

<div
	class="canvas"
	class:embedded
	class:panning={isPanning}
	class:create-mode={isShiftHeld}
	class:warp-out-target={isWarpOutTarget}
	bind:this={canvasEl}
	on:mousedown={handleMouseDown}
	on:mousemove={handleMouseMove}
	on:mouseup={handleMouseUp}
	on:mouseleave={handleCanvasMouseLeave}
	on:wheel={handleWheel}
	style="--offset-x: {scaledOffsetX}px; --offset-y: {scaledOffsetY}px; --grid-size: {gridSize}px;"
>
	<div class="canvas-content">
		{#each tasks as task (task.id)}
			<TaskCard
				{task}
				{offset}
				{parentTask}
				zoomLevel={embedded ? zoomLevel : $zoom}
				on:update={(e) => handleTaskUpdate(e.detail)}
				on:drillDown={() => handleDrillDown(task)}
				on:warp={handleWarp}
				on:warpOut={handleWarpOut}
			/>
		{/each}

		{#if ghostPosition}
			<GhostCard
				x={ghostPosition.x + offset.x}
				y={ghostPosition.y + offset.y}
				zoomLevel={embedded ? zoomLevel : $zoom}
				on:click={handleGhostClick}
			/>
		{/if}
	</div>

	{#if !embedded}
		<div class="hint">
			<kbd>Shift</kbd> + click to create a task
		</div>
	{/if}
</div>

<style>
	.canvas {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background-color: var(--canvas-bg);
		background-image:
			linear-gradient(var(--canvas-grid) 1px, transparent 1px),
			linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px);
		background-size: var(--grid-size) var(--grid-size);
		background-position: var(--offset-x) var(--offset-y);
		cursor: grab;
	}

	.canvas.panning {
		cursor: grabbing;
	}

	.canvas.create-mode {
		cursor: crosshair;
	}

	.canvas.embedded {
		position: relative;
		flex: 1;
		border-top: 1px solid var(--task-border);
	}

	.canvas.warp-out-target {
		background-color: color-mix(in srgb, var(--state-completed) 5%, var(--canvas-bg));
	}

	.canvas-content {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.hint {
		position: absolute;
		bottom: var(--spacing-md);
		left: var(--spacing-md);
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: var(--font-size-xs);
		color: var(--app-text-faint);
		background: var(--canvas-bg);
		border-radius: var(--radius-sm);
		pointer-events: none;
		user-select: none;
	}

	.hint kbd {
		display: inline-block;
		padding: 2px 6px;
		font-family: inherit;
		font-size: var(--font-size-xs);
		color: var(--app-text-muted);
		background: var(--button-secondary-bg);
		border: 1px solid var(--button-secondary-border);
		border-radius: var(--radius-sm);
	}
</style>
