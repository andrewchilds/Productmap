<script lang="ts">
	import { createEventDispatcher, onMount } from "svelte";
	import {
		X,
		Trash2,
		Check,
		Square,
		MoreHorizontal,
		ChevronRight,
		RefreshCw,
		Copy,
		Circle,
		CircleDot,
		CheckCircle,
		Plus
	} from "lucide-svelte";
	import type { Task, TaskState, TaskColor } from "$lib/types";
	import Button from "./Button.svelte";
	import ColorPicker from "./ColorPicker.svelte";
	import Dropdown from "./Dropdown.svelte";
	import Terminal from "./Terminal.svelte";
	import Tabs from "./Tabs.svelte";
	import Tooltip from "./Tooltip.svelte";
	import { shelfWidth } from "$lib/stores/shelf";
	import { markTerminalStopped, hasRunningTerminal } from "$lib/stores/running-terminals";
	import { Marked } from "marked";
	import { markedHighlight } from "marked-highlight";
	import hljs from "highlight.js";
	import "highlight.js/styles/github-dark.css";
	import Actions from "./Actions.svelte";
	import Textarea from "./Textarea.svelte";

	const marked = new Marked(
		markedHighlight({
			langPrefix: "hljs language-",
			highlight(code, lang) {
				const language = hljs.getLanguage(lang) ? lang : "plaintext";
				return hljs.highlight(code, { language }).value;
			}
		})
	);

	export let task: Task;
	export let ancestors: Task[] = [];
	export let projectPath: string;

	$: type TabId = "details" | "plan" | "terminal";
	const tabs: { id: TabId; label: string }[] = [
		{ id: "details", label: "Details" },
		{ id: "plan", label: "Plan" },
		{ id: "terminal", label: "Terminal" }
	];

	type PlanViewMode = "edit" | "preview" | "split";
	let planViewMode: PlanViewMode = "edit";
	let planEditorEl: HTMLTextAreaElement | null = null;
	let planPreviewEl: HTMLElement | null = null;
	let isSyncingScroll = false;

	// Derived store that tracks whether this task has a running terminal
	$: isTerminalRunning = hasRunningTerminal(task.id);

	// Reactive indicators for tabs - shows terminal running status
	$: tabIndicators = {
		terminal: $isTerminalRunning ? ("active" as const) : ("inactive" as const)
	};

	let activeTab: TabId = "details";
	let isDraggingResize = false;
	let shelfElement: HTMLElement;
	let showActionsMenu = false;
	let terminalStatus: "running" | "exited" = "exited";

	// Terminal ID is derived from task ID
	$: terminalId = `term-${task.id}`;

	function onTaskChange(task: Task) {
		shelfWidth.load();
		loadSession();
	}

	$: onTaskChange(task);

	async function loadSession() {
		const data = await window.electronAPI.loadSession(task.id);
		if (data.activeTab && ["details", "plan", "terminal"].includes(data.activeTab)) {
			activeTab = data.activeTab as TabId;
		}
	}

	async function saveActiveTab(tab: TabId) {
		await window.electronAPI.saveSession(task.id, { activeTab: tab });
	}

	async function handleTabChange(e: CustomEvent<string>) {
		activeTab = e.detail as TabId;
		saveActiveTab(activeTab);
	}

	async function killTerminal() {
		await window.electronAPI.killTerminal(terminalId);
		terminalStatus = "exited";
		markTerminalStopped(task.id);
	}

	let terminalKey = 0;

	async function resetTerminal() {
		// Fully clean up terminal (kills PTY and removes buffer)
		await window.electronAPI.cleanupTerminal(terminalId);
		markTerminalStopped(task.id);

		// Delete the session record from disk (but preserve activeTab)
		const currentTab = activeTab;
		await window.electronAPI.deleteSession(task.id);
		await window.electronAPI.saveSession(task.id, { activeTab: currentTab });

		// Increment key to force Terminal component to remount (which will start fresh)
		terminalKey++;
	}

	function handleTerminalExit() {
		terminalStatus = "exited";
	}

	function handleTerminalReady(e: CustomEvent<{ status: "running" | "exited" }>) {
		terminalStatus = e.detail.status;
	}

	function handleResizeMouseDown(e: MouseEvent) {
		e.preventDefault();
		isDraggingResize = true;
		document.addEventListener("mousemove", handleResizeMouseMove);
		document.addEventListener("mouseup", handleResizeMouseUp);
	}

	function handleResizeMouseMove(e: MouseEvent) {
		if (!isDraggingResize) return;
		const newWidth = window.innerWidth - e.clientX;
		shelfWidth.set(newWidth);
	}

	function handleResizeMouseUp() {
		isDraggingResize = false;
		document.removeEventListener("mousemove", handleResizeMouseMove);
		document.removeEventListener("mouseup", handleResizeMouseUp);
	}

	const dispatch = createEventDispatcher<{
		update: Task;
		preview: Task;
		delete: Task;
		duplicate: Task;
		close: void;
		selectSubtask: Task;
		selectParent: Task;
	}>();

	function handlePreview() {
		dispatch("preview", task);
	}

	const stateOptions: { value: TaskState; label: string; icon: typeof Circle }[] = [
		{ value: "Unstarted", label: "Unstarted", icon: Circle },
		{ value: "In Progress", label: "In Progress", icon: CircleDot },
		{ value: "Completed", label: "Completed", icon: CheckCircle }
	];

	function handleStateChange(newState: TaskState) {
		const wasCompleted = task.state === "Completed";
		const isNowCompleted = newState === "Completed";

		task.state = newState;

		if (isNowCompleted && !wasCompleted) {
			task.completedAt = new Date().toISOString();
		} else if (!isNowCompleted && wasCompleted) {
			task.completedAt = undefined;
		}

		dispatch("update", task);
	}

	function handleColorChange(e: CustomEvent<TaskColor>) {
		task.color = e.detail;
		dispatch("update", task);
	}

	function handleProgressChange(e: Event) {
		task.progress = parseInt((e.target as HTMLInputElement).value, 10);
		dispatch("update", task);
	}

	function handleNameChange() {
		dispatch("update", task);
	}

	function handleDescriptionChange() {
		dispatch("update", task);
	}

	function handleReadmeChange() {
		dispatch("update", task);
	}

	function addQuestion() {
		if (!task.questions) {
			task.questions = [];
		}
		task.questions.push({
			id: crypto.randomUUID(),
			state: "Open",
			question: "",
			answer: ""
		});
		task = task;
		dispatch("update", task);
	}

	function updateQuestion(index: number, field: "question" | "answer", value: string) {
		if (task.questions) {
			task.questions[index][field] = value;
			dispatch("update", task);
		}
	}

	function toggleQuestionState(index: number) {
		if (task.questions) {
			task.questions[index].state = task.questions[index].state === "Open" ? "Resolved" : "Open";
			dispatch("update", task);
		}
	}

	function deleteQuestion(index: number) {
		if (task.questions) {
			task.questions.splice(index, 1);
			task = task;
			dispatch("update", task);
		}
	}

	function handleDelete() {
		showActionsMenu = false;
		dispatch("delete", task);
	}

	function handleDuplicate() {
		showActionsMenu = false;
		dispatch("duplicate", task);
	}

	function toggleActionsMenu() {
		showActionsMenu = !showActionsMenu;
	}

	function closeActionsMenu() {
		showActionsMenu = false;
	}

	function handleClose() {
		dispatch("close");
	}

	function getStateColor(state: TaskState): string {
		switch (state) {
			case "Unstarted":
				return "var(--state-unstarted)";
			case "In Progress":
				return "var(--state-in-progress)";
			case "Completed":
				return "var(--state-completed)";
		}
	}

	function getRenderedMarkdown(content: string): string {
		return marked.parse(content || "", { async: false }) as string;
	}

	function handleEditorScroll() {
		if (isSyncingScroll || !planEditorEl || !planPreviewEl) return;
		isSyncingScroll = true;
		const scrollRatio = planEditorEl.scrollTop / (planEditorEl.scrollHeight - planEditorEl.clientHeight || 1);
		planPreviewEl.scrollTop = scrollRatio * (planPreviewEl.scrollHeight - planPreviewEl.clientHeight);
		requestAnimationFrame(() => {
			isSyncingScroll = false;
		});
	}

	function handlePreviewScroll() {
		if (isSyncingScroll || !planEditorEl || !planPreviewEl) return;
		isSyncingScroll = true;
		const scrollRatio = planPreviewEl.scrollTop / (planPreviewEl.scrollHeight - planPreviewEl.clientHeight || 1);
		planEditorEl.scrollTop = scrollRatio * (planEditorEl.scrollHeight - planEditorEl.clientHeight);
		requestAnimationFrame(() => {
			isSyncingScroll = false;
		});
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<aside class="shelf" bind:this={shelfElement} style="width: {$shelfWidth}px">
	<div class="resize-handle" on:mousedown={handleResizeMouseDown}></div>
	<header class="shelf-header">
		<input
			class="title-input"
			type="text"
			bind:value={task.name}
			on:input={handlePreview}
			on:blur={handleNameChange}
			placeholder="Task name..."
		/>
		<div class="header-actions">
			<div class="actions-dropdown">
				<Tooltip text="More actions" position="bottom">
					<button class="btn-icon" on:click={toggleActionsMenu}>
						<MoreHorizontal size={20} />
					</button>
				</Tooltip>
				{#if showActionsMenu}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="dropdown-backdrop" on:click={closeActionsMenu}></div>
					<div class="dropdown-menu">
						<button class="dropdown-item" on:click={handleDuplicate}>
							<Copy size={16} />
							<span>Duplicate Task</span>
						</button>
						<button class="dropdown-item danger" on:click={handleDelete}>
							<Trash2 size={16} />
							<span>Delete Task</span>
						</button>
					</div>
				{/if}
			</div>
			<button class="btn-icon" on:click={handleClose}>
				<X size={20} />
			</button>
		</div>
	</header>

	<Tabs {tabs} {activeTab} indicators={tabIndicators} on:change={handleTabChange} />

	<div class="shelf-body">
		{#if activeTab === "details"}
			<div class="tab-content">
				{#if ancestors.length > 0}
					<div class="shelf-breadcrumbs">
						{#each ancestors as ancestor}
							<button class="breadcrumb-item" on:click={() => dispatch("selectParent", ancestor)}>
								<span class="breadcrumb-state" style="background: {getStateColor(ancestor.state)}"></span>
								<span class="breadcrumb-name">{ancestor.name}</span>
							</button>
							<ChevronRight size={12} class="breadcrumb-separator" />
						{/each}
						<span class="breadcrumb-current">{task.name}</span>
					</div>
				{/if}

				<div class="props-grid">
					<label>State</label>
					<Dropdown
						value={task.state}
						options={stateOptions}
						align="left"
						on:change={(e) => handleStateChange(e.detail)}
					/>

					<label>Color</label>
					<ColorPicker value={task.color || "gray"} on:change={handleColorChange} />

					<label for="task-progress">Progress</label>
					<div class="progress-field">
						<input
							id="task-progress"
							type="range"
							min="0"
							max="100"
							step="5"
							value={task.progress ?? 0}
							on:input={handleProgressChange}
						/>
						<span class="progress-value">{task.progress ?? 0}%</span>
					</div>
				</div>

				{#if task.completedAt}
					<div class="form-group">
						<label>Completed At</label>
						<span class="completed-date">{new Date(task.completedAt).toLocaleString()}</span>
					</div>
				{/if}

				<div class="form-group">
					<label for="task-description">Description</label>
					<textarea
						id="task-description"
						bind:value={task.description}
						on:input={handlePreview}
						on:blur={handleDescriptionChange}
						rows="3"
						placeholder="Add a description..."
					></textarea>
				</div>

				<div class="form-section">
					<h3>Open Questions</h3>

					{#if task.questions && task.questions.length > 0}
						<div class="questions-list">
							{#each task.questions as question, index (question.id)}
								<div class="question-item" class:resolved={question.state === "Resolved"}>
									<Tooltip text={question.state === "Open" ? "Mark as resolved" : "Reopen"} position="right">
										<button class="btn-icon state-toggle" on:click={() => toggleQuestionState(index)}>
											<Check size={14} />
										</button>
									</Tooltip>
									<button class="btn-icon delete-btn" on:click={() => deleteQuestion(index)}>
										<Trash2 size={14} />
									</button>
									<Textarea
										class="question-input"
										bind:value={question.question}
										on:input={handlePreview}
										on:blur={() => updateQuestion(index, "question", question.question)}
										placeholder="Question..."
										rows={1}
										autoResize
									/>
									<Textarea
										class="answer-input"
										bind:value={question.answer}
										on:input={handlePreview}
										on:blur={() => updateQuestion(index, "answer", question.answer)}
										placeholder="Answer..."
										rows={1}
										autoResize
									/>
								</div>
							{/each}
						</div>
					{:else}
						<p class="empty-message">No questions yet</p>
					{/if}
					<Actions>
						<Button variant="secondary" on:click={addQuestion}>
							<Plus size={16} />
							Add Question
						</Button>
					</Actions>
				</div>

				{#if task.subtasks && task.subtasks.length > 0}
					<div class="form-section">
						<h3>Subtasks ({task.subtasks.length})</h3>
						<div class="subtasks-list">
							{#each task.subtasks as subtask (subtask.id)}
								<button class="subtask-item" on:click={() => dispatch("selectSubtask", subtask)}>
									<span class="subtask-state" style="background: {getStateColor(subtask.state)}"></span>
									<span class="subtask-name">{subtask.name}</span>
									<ChevronRight size={14} />
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else if activeTab === "plan"}
			<div class="tab-content plan-tab">
				<div class="plan-mode-switcher">
					<button class="mode-btn" class:active={planViewMode === "edit"} on:click={() => (planViewMode = "edit")}>
						Edit
					</button>
					<button
						class="mode-btn"
						class:active={planViewMode === "preview"}
						on:click={() => (planViewMode = "preview")}
					>
						Preview
					</button>
					<button class="mode-btn" class:active={planViewMode === "split"} on:click={() => (planViewMode = "split")}>
						Split
					</button>
				</div>
				<div class="plan-content" class:split-view={planViewMode === "split"}>
					{#if planViewMode === "edit" || planViewMode === "split"}
						<textarea
							class="readme-editor"
							bind:this={planEditorEl}
							bind:value={task.readme}
							on:input={handlePreview}
							on:blur={handleReadmeChange}
							on:scroll={planViewMode === "split" ? handleEditorScroll : undefined}
							placeholder="Write your plan here..."
						></textarea>
					{/if}
					{#if planViewMode === "preview" || planViewMode === "split"}
						<div
							class="readme-preview"
							bind:this={planPreviewEl}
							on:scroll={planViewMode === "split" ? handlePreviewScroll : undefined}
						>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- Markdown rendering requires raw HTML -->
							{@html getRenderedMarkdown(task.readme)}
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === "terminal"}
			<div class="tab-content terminal-tab">
				<div class="terminal-header">
					<div class="terminal-title">
						<span class="terminal-label">Claude</span>
						{#if terminalStatus === "exited"}
							<span class="terminal-status">(exited)</span>
						{/if}
					</div>
					<div class="terminal-actions">
						<Tooltip text="Reset session" position="top">
							<button class="btn-icon" on:click={resetTerminal}>
								<RefreshCw size={14} />
							</button>
						</Tooltip>
						{#if terminalStatus === "running"}
							<Tooltip text="Kill session" position="top">
								<button class="btn-icon" on:click={killTerminal}>
									<Square size={14} />
								</button>
							</Tooltip>
						{/if}
					</div>
				</div>

				<div class="terminal-content">
					{#key terminalKey}
						<Terminal {task} {projectPath} on:exit={handleTerminalExit} on:ready={handleTerminalReady} />
					{/key}
				</div>
			</div>
		{/if}
	</div>
</aside>

<style>
	.shelf {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		background: var(--shelf-bg);
		border-left: 1px solid var(--shelf-border);
		box-shadow: -4px 0 16px var(--shelf-shadow);
		z-index: 100;
	}

	.resize-handle {
		position: absolute;
		top: 0;
		left: -3px;
		bottom: 0;
		width: 6px;
		cursor: ew-resize;
		z-index: 101;
	}

	.resize-handle:hover {
		background: var(--button-primary-bg);
	}

	.shelf-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: none;
	}

	.title-input {
		flex: 1;
		min-width: 0;
		padding: var(--spacing-xs) 0;
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-semibold);
		background: transparent;
		border: none;
		color: var(--app-text);
	}

	.title-input:focus {
		outline: none;
	}

	.title-input::placeholder {
		color: var(--app-text-faint);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.actions-dropdown {
		position: relative;
	}

	.dropdown-backdrop {
		position: fixed;
		inset: 0;
		z-index: 199;
	}

	.dropdown-menu {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: var(--spacing-xs);
		min-width: 160px;
		padding: var(--spacing-xs);
		background: var(--shelf-bg);
		border: 1px solid var(--shelf-border);
		border-radius: var(--radius-sm);
		box-shadow: 0 4px 12px var(--shelf-shadow);
		z-index: 200;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		width: 100%;
		padding: var(--spacing-sm);
		font-size: var(--font-size-sm);
		color: var(--app-text);
		border-radius: var(--radius-sm);
		transition: background var(--transition-fast);
	}

	.dropdown-item:hover {
		background: var(--button-ghost-bg-hover);
	}

	.dropdown-item.danger {
		color: hsl(var(--hue-red), 70%, 55%);
	}

	.dropdown-item.danger:hover {
		background: hsla(var(--hue-red), 70%, 55%, 0.1);
	}

	.shelf-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.tab-content {
		flex: 1;
		padding: var(--spacing-lg);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.tab-content.plan-tab {
		overflow: hidden;
		gap: var(--spacing-xs);
	}

	.plan-mode-switcher {
		display: grid;
		background: var(--input-bg);
		gap: 2px;
		grid-auto-flow: column;
		justify-content: start;
	}

	.mode-btn {
		flex: 1;
		padding: var(--spacing-sm) var(--spacing-md);
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-medium);
		color: var(--app-text-muted);
		border-radius: 2px;
		transition: all var(--transition-fast);
	}

	.mode-btn:hover {
		color: var(--app-text);
		background: var(--button-ghost-bg-hover);
	}

	.mode-btn.active {
		color: var(--app-text);
		background: var(--button-secondary-bg);
	}

	.plan-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		gap: var(--spacing-md);
	}

	.plan-content.split-view {
		flex-direction: row;
	}

	.plan-content .readme-editor {
		flex: 1;
		min-height: 0;
		resize: none;
	}

	.readme-preview {
		flex: 1;
		min-height: 0;
		padding: var(--spacing-sm);
		font-size: var(--font-size-sm);
		background: var(--textarea-bg);
		border: 1px solid var(--textarea-border);
		border-radius: var(--radius-sm);
		color: var(--textarea-text);
		overflow-y: auto;
		line-height: 1.6;
	}

	.readme-preview :global(h1),
	.readme-preview :global(h2),
	.readme-preview :global(h3),
	.readme-preview :global(h4),
	.readme-preview :global(h5),
	.readme-preview :global(h6) {
		margin-top: var(--spacing-md);
		margin-bottom: var(--spacing-sm);
		font-weight: var(--font-weight-semibold);
		line-height: 1.3;
	}

	.readme-preview :global(h1) {
		font-size: var(--font-size-xl);
	}

	.readme-preview :global(h2) {
		font-size: var(--font-size-lg);
	}

	.readme-preview :global(h3) {
		font-size: var(--font-size-md);
	}

	.readme-preview :global(p) {
		margin: 0 0 var(--spacing-sm);
	}

	.readme-preview :global(ul),
	.readme-preview :global(ol) {
		margin: 0 0 var(--spacing-sm);
		padding-left: var(--spacing-lg);
	}

	.readme-preview :global(li) {
		margin-bottom: var(--spacing-xs);
	}

	.readme-preview :global(code) {
		padding: 1px 4px;
		background: var(--input-bg);
		border-radius: 3px;
		font-family: monospace;
		font-size: 0.9em;
	}

	.readme-preview :global(pre) {
		margin: 0 0 var(--spacing-sm);
		padding: var(--spacing-sm);
		background: var(--input-bg);
		border-radius: var(--radius-sm);
		overflow-x: auto;
	}

	.readme-preview :global(pre code) {
		padding: 0;
		background: none;
	}

	.readme-preview :global(blockquote) {
		margin: 0 0 var(--spacing-sm);
		padding-left: var(--spacing-sm);
		border-left: 3px solid var(--input-border);
		color: var(--app-text-muted);
	}

	.readme-preview :global(hr) {
		margin: var(--spacing-md) 0;
		border: none;
		border-top: 1px solid var(--input-border);
	}

	.readme-preview :global(a) {
		color: var(--button-primary-bg);
	}

	.readme-preview :global(a:hover) {
		text-decoration: underline;
	}

	.readme-preview :global(table) {
		width: 100%;
		margin-bottom: var(--spacing-sm);
		border-collapse: collapse;
	}

	.readme-preview :global(th),
	.readme-preview :global(td) {
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--input-border);
		text-align: left;
	}

	.readme-preview :global(th) {
		background: var(--input-bg);
		font-weight: var(--font-weight-semibold);
	}

	.readme-preview :global(img) {
		max-width: 100%;
		height: auto;
	}

	.readme-preview :global(*:first-child) {
		margin-top: 0;
	}

	.readme-preview :global(*:last-child) {
		margin-bottom: 0;
	}

	.tab-content.terminal-tab {
		padding: 0;
		gap: 0;
	}

	.terminal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--terminal-header-bg);
		border-bottom: 1px solid var(--shelf-border);
		flex-shrink: 0;
		gap: var(--spacing-xs);
	}

	.terminal-title {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		flex: 1;
	}

	.terminal-label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--terminal-header-text);
	}

	.terminal-status {
		font-size: var(--font-size-xs);
		color: var(--terminal-header-text);
		opacity: 0.7;
	}

	.terminal-actions {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.terminal-actions .btn-icon {
		color: var(--terminal-header-text);
		opacity: 0.7;
	}

	.terminal-actions .btn-icon:hover {
		opacity: 1;
		background: hsla(0, 0%, 50%, 0.2);
	}

	.terminal-content {
		flex: 1;
		overflow: hidden;
	}

	.btn-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--app-text-muted);
		transition: all var(--transition-fast);
	}

	.btn-icon:hover {
		background: var(--button-ghost-bg-hover);
		color: var(--app-text);
	}

	.props-grid {
		display: grid;
		grid-template-columns: 100px 1fr;
		gap: var(--spacing-sm) var(--spacing-md);
		align-items: center;
		max-width: 400px;
	}

	.props-grid label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--app-text-muted);
	}

	.progress-field {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.progress-field input[type="range"] {
		flex: 1;
	}

	.progress-value {
		font-size: var(--font-size-sm);
		color: var(--app-text-muted);
		min-width: 36px;
		text-align: right;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.form-group label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--app-text-muted);
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		padding: var(--spacing-sm);
		background: var(--input-bg);
		border: 1px solid var(--input-border);
		border-radius: var(--radius-sm);
		color: var(--input-text);
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		border-color: var(--input-border-focus);
	}

	.form-group select {
		cursor: pointer;
	}

	.form-group textarea {
		resize: vertical;
		min-height: 60px;
	}

	#task-description {
		min-height: 200px;
	}

	.completed-date {
		font-size: var(--font-size-sm);
		color: var(--state-completed);
	}

	.form-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.form-section h3 {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--app-text-muted);
	}

	.questions-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.question-item {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0 var(--spacing-xs);
		padding: var(--spacing-sm);
		background: var(--question-open-bg);
		border-left: 3px solid var(--question-open-border);
		border-radius: var(--radius-sm);
	}

	.question-item.resolved {
		background: var(--question-resolved-bg);
		border-left-color: var(--question-resolved-border);
	}

	.state-toggle {
		grid-column: 1;
		grid-row: 1 / 3;
		align-self: start;
		width: 24px;
		height: 24px;
	}

	.question-item.resolved .state-toggle {
		color: var(--state-completed);
	}

	.delete-btn {
		grid-column: 3;
		grid-row: 1;
		align-self: start;
		width: 24px;
		height: 24px;
		opacity: 0.5;
	}

	.delete-btn:hover {
		opacity: 1;
		color: var(--state-blocked);
	}

	.question-item :global(.question-input) {
		grid-column: 2;
		grid-row: 1;
		padding: var(--spacing-xs);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		background: transparent;
		border: none;
		color: var(--app-text);
		resize: none;
	}

	.question-item :global(.answer-input) {
		grid-column: 2;
		grid-row: 2;
		padding: var(--spacing-xs);
		font-size: var(--font-size-sm);
		background: transparent;
		border: none;
		color: var(--app-text-muted);
		resize: none;
	}

	.empty-message {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--app-text-faint);
		font-style: italic;
	}

	.readme-editor {
		min-height: 200px;
		padding: var(--spacing-sm);
		font-family: monospace;
		font-size: var(--font-size-sm);
		background: var(--textarea-bg);
		border: 1px solid var(--textarea-border);
		border-radius: var(--radius-sm);
		color: var(--textarea-text);
		resize: vertical;
	}

	.readme-editor:focus {
		border-color: var(--input-border-focus);
	}

	.subtasks-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.subtask-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		background: var(--input-bg);
		border: 1px solid var(--input-border);
		border-radius: var(--radius-sm);
		color: var(--app-text);
		font-size: var(--font-size-sm);
		text-align: left;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.subtask-item:hover {
		background: var(--button-ghost-bg-hover);
		border-color: var(--input-border-focus);
	}

	.subtask-state {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.subtask-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.shelf-breadcrumbs {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
		font-size: var(--font-size-sm);
	}

	.breadcrumb-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: 2px var(--spacing-xs);
		color: var(--app-text-muted);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.breadcrumb-item:hover {
		background: var(--button-ghost-bg-hover);
		color: var(--app-text);
	}

	.breadcrumb-state {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.breadcrumb-name {
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.shelf-breadcrumbs :global(.breadcrumb-separator) {
		color: var(--app-text-faint);
		flex-shrink: 0;
	}

	.breadcrumb-current {
		color: var(--app-text);
		font-weight: var(--font-weight-medium);
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
