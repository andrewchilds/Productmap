<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { HelpCircle, Layers, Square, CheckSquare, ChevronRight, Maximize2 } from "lucide-svelte";
	import type { Task, TaskColor } from "$lib/types";
	import { selectTask, selectedTask } from "$lib/stores/selection";
	import { EMBEDDED_CANVAS_MIN_WIDTH, EMBEDDED_CANVAS_MIN_HEIGHT } from "$lib/constants";
	import { BASE_GRID_SIZE, getSubCanvasZoom } from "$lib/stores/zoom";
	import { dragState } from "$lib/stores/drag-state";
	import { wouldCreateCycle } from "$lib/utils/task-helpers";
	import { getCanvasOffsetsContext } from "$lib/stores/canvas-offsets";
	import { hasRunningTerminal } from "$lib/stores/running-terminals";
	import Canvas from "./Canvas.svelte";
	import Tooltip from "./Tooltip.svelte";

	export let task: Task;
	export let offset: { x: number; y: number };
	export let parentTask: Task | null = null;
	export let zoomLevel: number = 1;

	const offsetsCtx = getCanvasOffsetsContext();

	// Computed scaled values for rendering
	$: scaledX = (task.x + offset.x) * zoomLevel;
	$: scaledY = (task.y + offset.y) * zoomLevel;
	$: scaledWidth = task.width * zoomLevel;
	$: scaledHeight = task.height * zoomLevel;

	const dispatch = createEventDispatcher<{
		update: Task;
		drillDown: void;
		warp: { task: Task; targetTask: Task; targetX: number; targetY: number };
		warpOut: { task: Task; x: number; y: number };
	}>();

	const MIN_WIDTH = 200;
	const MIN_HEIGHT = 40;

	let isDragging = false;
	let hasMoved = false;
	let isResizing = false;
	let resizeDirection: "right" | "bottom" | "corner" = "corner";
	let dragStart = { x: 0, y: 0 };
	let initialPos = { x: 0, y: 0 };
	let initialSize = { width: 0, height: 0 };

	$: openQuestions = (task.questions || []).filter((q) => q.state === "Open").length;
	$: progressPercent = task.progress ?? 0;

	$: headerBg = getHeaderBg(task.color);
	$: isSelected = $selectedTask?.id === task.id;
	$: hasSubtasks = task.subtasks && task.subtasks.length > 0;
	// Use absolute (screen) dimensions to determine if embedded canvas should show
	// This means as you zoom in, smaller cards will start to exceed the threshold
	$: absoluteWidth = task.width * zoomLevel;
	$: absoluteHeight = task.height * zoomLevel;
	$: isLargeEnough = absoluteWidth >= EMBEDDED_CANVAS_MIN_WIDTH && absoluteHeight >= EMBEDDED_CANVAS_MIN_HEIGHT;
	$: shouldShowEmbeddedCanvas = isLargeEnough;
	$: isTerminalRunning = hasRunningTerminal(task.id);
	$: showCardIcons = zoomLevel >= 0.6;
	$: isCompact = zoomLevel < 0.6;

	// Track previous state to detect when embedded canvas becomes visible
	let wasShowingEmbeddedCanvas = false;

	// Center subtasks when embedded canvas first becomes visible
	$: if (shouldShowEmbeddedCanvas && !wasShowingEmbeddedCanvas && task.subtasks && task.subtasks.length > 0) {
		centerSubtasksInEmbeddedCanvas();
	}
	$: wasShowingEmbeddedCanvas = shouldShowEmbeddedCanvas;

	function centerSubtasksInEmbeddedCanvas() {
		if (!offsetsCtx || !task.subtasks || task.subtasks.length === 0) return;

		// Calculate bounding box of all subtasks
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		for (const subtask of task.subtasks) {
			minX = Math.min(minX, subtask.x);
			minY = Math.min(minY, subtask.y);
			maxX = Math.max(maxX, subtask.x + subtask.width);
			maxY = Math.max(maxY, subtask.y + subtask.height);
		}

		// Calculate subtasks center
		const subtasksCenterX = (minX + maxX) / 2;
		const subtasksCenterY = (minY + maxY) / 2;

		// Estimate embedded canvas dimensions (task size minus header ~40px, body ~70px, footer ~32px)
		const canvasWidth = task.width - 2; // account for borders
		const canvasHeight = task.height - 142; // header + body + footer + borders

		// Calculate offset to center subtasks in the canvas
		const offsetX = canvasWidth / 2 - subtasksCenterX;
		const offsetY = canvasHeight / 2 - subtasksCenterY;

		offsetsCtx.setEmbeddedOffset(task.id, { x: offsetX, y: offsetY });
	}

	// Drop target detection
	$: isBeingDragged = $dragState.task?.id === task.id;
	$: isDropTarget = $dragState.dropTarget?.id === task.id;
	$: canBeDropTarget = $dragState.task && !wouldCreateCycle($dragState.task, task);

	function toggleState(e: MouseEvent) {
		e.stopPropagation();
		const wasCompleted = task.state === "Completed";
		task.state = wasCompleted ? "Unstarted" : "Completed";

		if (!wasCompleted) {
			task.completedAt = new Date().toISOString();
		} else {
			task.completedAt = undefined;
		}

		dispatch("update", task);
	}

	function getHeaderBg(color?: TaskColor): string {
		if (!color || color === "gray") return "transparent";
		const hueMap: Record<string, string> = {
			red: "var(--hue-red), 70%",
			orange: "var(--hue-orange), 70%",
			yellow: "var(--hue-yellow), 70%",
			lime: "var(--hue-lime), 60%",
			green: "var(--hue-green), 55%",
			teal: "var(--hue-teal), 55%",
			cyan: "var(--hue-cyan), 60%",
			blue: "var(--hue-blue), 70%",
			indigo: "var(--hue-indigo), 60%",
			purple: "var(--hue-purple), 60%",
			pink: "var(--hue-pink), 65%"
		};
		const hue = hueMap[color];
		return hue ? `hsla(${hue}, 50%, 0.15)` : "transparent";
	}

	// Snap to base grid size (logical coordinates)
	function snapToGrid(value: number): number {
		return Math.round(value / BASE_GRID_SIZE) * BASE_GRID_SIZE;
	}

	// Convert screen delta to logical delta
	function screenToLogical(value: number): number {
		return value / zoomLevel;
	}

	let cardEl: HTMLDivElement;

	function handleMouseDown(e: MouseEvent) {
		// Don't start drag if clicking inside THIS task's embedded canvas area
		const target = e.target as HTMLElement;
		const embeddedCanvas = cardEl?.querySelector(":scope > .canvas.embedded");
		if (embeddedCanvas && embeddedCanvas.contains(target)) return;

		e.stopPropagation();
		selectTask(task);

		isDragging = true;
		hasMoved = false;
		dragStart = { x: e.clientX, y: e.clientY };
		initialPos = { x: task.x, y: task.y };

		// Track drag state for warp detection
		dragState.startDrag(task, parentTask?.id ?? null);

		window.addEventListener("mousemove", handleDragMove);
		window.addEventListener("mouseup", handleDragEnd);
	}

	function handleDragMove(e: MouseEvent) {
		if (!isDragging) return;

		// Convert screen delta to logical delta
		const dx = screenToLogical(e.clientX - dragStart.x);
		const dy = screenToLogical(e.clientY - dragStart.y);

		task.x = snapToGrid(initialPos.x + dx);
		task.y = snapToGrid(initialPos.y + dy);

		// Track whether position has actually changed
		if (task.x !== initialPos.x || task.y !== initialPos.y) {
			hasMoved = true;
		}

		// Track mouse position for coordinate transformation on warp
		dragState.setMousePosition(e.clientX, e.clientY);
	}

	function handleDragEnd() {
		if (isDragging) {
			isDragging = false;

			const state = $dragState;
			if (state.dropTarget) {
				// Warp into another task - use position relative to target's embedded canvas
				// Default to (20, 20) if no position was calculated (e.g., no mousemove occurred)
				const targetPos = state.targetCanvasPosition ?? { x: 20, y: 20 };
				dispatch("warp", {
					task,
					targetTask: state.dropTarget,
					targetX: targetPos.x,
					targetY: targetPos.y
				});
			} else if (state.dropToRoot) {
				// Warp out to current canvas level
				dispatch("warpOut", {
					task,
					x: snapToGrid(task.x),
					y: snapToGrid(task.y)
				});
			} else {
				// Only dispatch update if position actually changed
				const positionChanged = task.x !== initialPos.x || task.y !== initialPos.y;
				if (positionChanged) {
					dispatch("update", task);
				}
			}

			dragState.endDrag();
		}
		window.removeEventListener("mousemove", handleDragMove);
		window.removeEventListener("mouseup", handleDragEnd);
	}

	function handleResizeMouseDown(e: MouseEvent, direction: "right" | "bottom" | "corner" = "corner") {
		e.stopPropagation();
		selectTask(task);

		isResizing = true;
		resizeDirection = direction;
		dragStart = { x: e.clientX, y: e.clientY };
		initialSize = { width: task.width, height: task.height };

		window.addEventListener("mousemove", handleResizeMove);
		window.addEventListener("mouseup", handleResizeEnd);
	}

	function handleResizeMove(e: MouseEvent) {
		if (!isResizing) return;

		// Convert screen delta to logical delta
		const dx = screenToLogical(e.clientX - dragStart.x);
		const dy = screenToLogical(e.clientY - dragStart.y);

		if (resizeDirection === "right" || resizeDirection === "corner") {
			task.width = Math.max(MIN_WIDTH, snapToGrid(initialSize.width + dx));
		}
		if (resizeDirection === "bottom" || resizeDirection === "corner") {
			task.height = Math.max(MIN_HEIGHT, snapToGrid(initialSize.height + dy));
		}
	}

	function handleResizeEnd() {
		if (isResizing) {
			isResizing = false;
			dispatch("update", task);
		}
		window.removeEventListener("mousemove", handleResizeMove);
		window.removeEventListener("mouseup", handleResizeEnd);
	}

	function handleExpandClick(e: MouseEvent) {
		e.stopPropagation();
		dispatch("drillDown");
	}

	function handleMouseEnter() {
		// Only set as drop target if something is being dragged and we're a valid target
		if ($dragState.task && canBeDropTarget && !isBeingDragged) {
			dragState.setDropTarget(task);
			dragState.setDropToRoot(false);
		}
	}

	function handleMouseLeave() {
		// Clear this task as drop target if it was set
		if ($dragState.dropTarget?.id === task.id) {
			dragState.setDropTarget(null);
		}
	}

	function handleTargetMouseMove(e: MouseEvent) {
		// When this task is a drop target, calculate position relative to embedded canvas
		if (!isDropTarget || !cardEl) return;

		// Get the embedded canvas offset (pan position)
		const embeddedOffset = offsetsCtx?.getEmbeddedOffset(task.id) ?? { x: 0, y: 0 };

		// Find the embedded canvas element
		const embeddedCanvas = cardEl.querySelector(":scope > .canvas.embedded") as HTMLElement;
		if (embeddedCanvas) {
			// Calculate position relative to the embedded canvas
			const canvasRect = embeddedCanvas.getBoundingClientRect();
			const relX = e.clientX - canvasRect.left - embeddedOffset.x;
			const relY = e.clientY - canvasRect.top - embeddedOffset.y;
			dragState.setTargetCanvasPosition(snapToGrid(relX), snapToGrid(relY));
		} else {
			// No embedded canvas visible - use a default position near the top-left
			// accounting for the embedded canvas offset
			dragState.setTargetCanvasPosition(snapToGrid(20 - embeddedOffset.x), snapToGrid(20 - embeddedOffset.y));
		}
	}
</script>

{#if isResizing}
	<div class="dimensions-indicator" style="left: {scaledX}px; top: {scaledY - 24}px;">
		{task.width}x{task.height}
	</div>
{/if}
<div
	class="task-card"
	class:dragging={isDragging && hasMoved}
	class:resizing-right={isResizing && resizeDirection === "right"}
	class:resizing-bottom={isResizing && resizeDirection === "bottom"}
	class:resizing-corner={isResizing && resizeDirection === "corner"}
	class:selected={isSelected}
	class:drop-target={isDropTarget}
	class:being-dragged={isBeingDragged}
	class:compact={isCompact}
	data-task-id={task.id}
	style="
		left: {scaledX}px;
		top: {scaledY}px;
		width: {scaledWidth}px;
		height: {scaledHeight}px;
	"
	bind:this={cardEl}
	on:mousedown={handleMouseDown}
	on:mouseenter={handleMouseEnter}
	on:mouseleave={handleMouseLeave}
	on:mousemove={handleTargetMouseMove}
>
	<div class="task-header" style="background: {headerBg}">
		{#if showCardIcons}
			<Tooltip text={task.state === "Completed" ? "Mark as unstarted" : "Mark as completed"} position="bottom">
				<button
					class="state-checkbox"
					class:completed={task.state === "Completed"}
					class:in-progress={task.state === "In Progress"}
					on:mousedown|stopPropagation
					on:click={toggleState}
				>
					{#if task.state === "Completed"}
						<CheckSquare size={16} />
					{:else}
						<Square size={16} />
					{/if}
				</button>
			</Tooltip>
		{/if}

		<h3 class="task-name truncate">{task.name}</h3>

		{#if showCardIcons}
			<Tooltip text="Expand task" position="bottom">
				<button class="expand-button" on:mousedown|stopPropagation on:click={handleExpandClick}>
					<Maximize2 size={14} />
				</button>
			</Tooltip>
		{/if}
	</div>

	<div class="task-body">
		<p class="task-description" class:empty={!task.description}>
			{task.description || ""}
		</p>
	</div>

	{#if shouldShowEmbeddedCanvas}
		<Canvas tasks={task.subtasks} parentTask={task} embedded={true} zoomLevel={getSubCanvasZoom(zoomLevel)} />
	{/if}

	<div class="task-footer">
		{#if $isTerminalRunning}
			<span class="badge badge-terminal">
				<ChevronRight size={12} />
				<span class="terminal-pulse"></span>
			</span>
		{/if}

		{#if progressPercent > 0}
			<div class="progress-bar">
				<div class="progress-fill" style="width: {progressPercent}%"></div>
			</div>
			<span class="badge">{progressPercent}%</span>
		{/if}

		{#if hasSubtasks}
			<span class="badge badge-subtasks">
				<Layers size={12} />
				{task.subtasks.length}
			</span>
		{/if}

		{#if openQuestions > 0}
			<span class="badge badge-questions">
				<HelpCircle size={12} />
				{openQuestions}
			</span>
		{/if}
	</div>

	{#if showCardIcons}
		<div class="resize-handle resize-right" on:mousedown={(e) => handleResizeMouseDown(e, "right")}></div>
		<div class="resize-handle resize-bottom" on:mousedown={(e) => handleResizeMouseDown(e, "bottom")}></div>
		<div class="resize-handle resize-corner" on:mousedown={(e) => handleResizeMouseDown(e, "corner")}></div>
	{/if}
</div>

<style>
	.task-card {
		position: absolute;
		display: flex;
		flex-direction: column;
		background: var(--task-bg);
		border: 1px solid var(--task-border);
		border-radius: var(--radius-md);
		box-shadow: 0 2px 8px var(--task-shadow);
		cursor: pointer;
		user-select: none;
		overflow: hidden;
	}

	.task-card.dragging {
		cursor: pointer;
		opacity: 0.9;
	}

	.task-card.resizing-right {
		cursor: ew-resize;
	}

	.task-card.resizing-bottom {
		cursor: ns-resize;
	}

	.task-card.resizing-corner {
		cursor: se-resize;
	}

	.task-card.selected {
		box-shadow: 0 0 0 2px var(--button-primary-bg);
	}

	.task-card.drop-target {
		box-shadow: 0 0 0 3px var(--state-completed);
		background: color-mix(in srgb, var(--state-completed) 10%, var(--task-bg));
	}

	.task-card.being-dragged {
		z-index: 100;
		pointer-events: none;
	}

	.task-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: 11px var(--spacing-sm2);
		border-bottom: 1px solid var(--task-border);
	}

	.state-checkbox {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--state-unstarted);
		cursor: pointer;
		transition: color var(--transition-fast);
	}

	.state-checkbox:hover {
		color: var(--state-completed);
	}

	.state-checkbox.completed {
		color: var(--state-completed);
	}

	.state-checkbox.completed:hover {
		color: var(--state-unstarted);
	}

	.state-checkbox.in-progress {
		color: var(--state-in-progress);
	}

	.state-checkbox.in-progress:hover {
		color: var(--state-completed);
	}

	:global(.task-card[data-task-id]) .state-checkbox :global(svg) {
		display: block;
	}

	.expand-button {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		padding: 4px;
		color: var(--task-text-muted);
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition:
			color var(--transition-fast),
			background var(--transition-fast);
	}

	.expand-button:hover {
		color: var(--task-text);
		background: var(--badge-bg);
	}

	:global(.task-card[data-task-id]) .expand-button :global(svg) {
		display: block;
	}

	.task-name {
		flex: 1;
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--task-text);
	}

	.task-body {
		overflow: hidden;
	}

	.task-card:not(:has(.canvas.embedded)) .task-body {
		flex: 1;
		max-height: none;
	}

	.task-description {
		padding: var(--spacing-sm2) var(--spacing-md);
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--task-text-muted);
		line-height: 1.35;
		overflow: hidden;
	}

	.task-card:not(:has(.canvas.embedded)) .task-description {
		display: block;
	}

	.task-description.empty {
		display: none;
	}

	.task-footer {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		border-top: 1px solid var(--task-border);
		min-height: 32px;
	}

	.badge {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: 2px var(--spacing-xs);
		font-size: var(--font-size-xs);
		color: var(--badge-text);
		background: var(--badge-bg);
		border-radius: var(--radius-sm);
	}

	.badge-subtasks {
		color: var(--task-text-muted);
	}

	.badge-questions {
		color: var(--question-open-border);
		background: var(--question-open-bg);
	}

	.badge-terminal {
		color: var(--badge-terminal-text);
		background: var(--badge-terminal-bg);
		position: relative;
		padding-right: var(--spacing-sm2);
	}

	.terminal-pulse {
		position: absolute;
		top: 50%;
		right: 7px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--badge-terminal-text);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.8;
			transform: translateY(-50%) scale(1);
		}
		50% {
			opacity: 0.4;
			transform: translateY(-50%) scale(0.95);
		}
	}

	.progress-bar {
		flex: 1;
		height: 4px;
		background: var(--badge-bg);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--state-completed);
		transition: width var(--transition-normal);
	}

	.dimensions-indicator {
		position: absolute;
		padding: 2px 6px;
		font-size: var(--font-size-xs);
		font-family: ui-monospace, monospace;
		color: var(--task-text-muted);
		background: var(--task-bg);
		border: 1px solid var(--task-border);
		border-radius: var(--radius-sm);
		white-space: nowrap;
		pointer-events: none;
		z-index: 101;
	}

	.resize-handle {
		position: absolute;
	}

	.resize-right {
		right: 0;
		top: 0;
		width: 8px;
		height: calc(100% - 16px);
		cursor: ew-resize;
	}

	.resize-bottom {
		bottom: 0;
		left: 0;
		width: calc(100% - 16px);
		height: 8px;
		cursor: ns-resize;
	}

	.resize-corner {
		right: 0;
		bottom: 0;
		width: 16px;
		height: 16px;
		cursor: se-resize;
	}

	.resize-corner::after {
		content: "";
		position: absolute;
		right: 4px;
		bottom: 4px;
		width: 8px;
		height: 8px;
		border-right: 2px solid var(--task-resize-handle);
		border-bottom: 2px solid var(--task-resize-handle);
	}

	/* Compact mode for zoom < 50% */
	.task-card.compact .task-header {
		padding: var(--spacing-xs) var(--spacing-sm);
	}

	.task-card.compact .task-name {
		font-size: var(--font-size-xs);
	}

	.task-card.compact .task-description {
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: var(--font-size-xs);
	}

	.task-card.compact .task-footer {
		padding: var(--spacing-xs) var(--spacing-sm);
		min-height: 24px;
	}

	.task-card.compact .badge {
		font-size: 9px;
		padding: 1px var(--spacing-xs);
	}
</style>
