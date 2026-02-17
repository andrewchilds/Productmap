<script lang="ts">
	import { onMount, onDestroy, tick } from "svelte";
	import type { AppSettings, Project, Task, Theme } from "$lib/types";
	import Toolbar from "$lib/components/Toolbar.svelte";
	import Canvas from "$lib/components/Canvas.svelte";
	import Shelf from "$lib/components/Shelf.svelte";
	import Breadcrumb from "$lib/components/Breadcrumb.svelte";
	import { selectedTask, selectTask, clearSelection } from "$lib/stores/selection";
	import { clipboard, copyTask } from "$lib/stores/clipboard";
	import { zoom, zoomIn, zoomOut, setZoom, BASE_GRID_SIZE, calculateCenteredZoomOffset } from "$lib/stores/zoom";
	import { setCanvasContext } from "$lib/stores/canvas-context";
	import { createCanvasOffsetsContext } from "$lib/stores/canvas-offsets";
	import { shelfWidth } from "$lib/stores/shelf";
	import {
		NEW_CARD_WIDTH,
		NEW_CARD_HEIGHT,
		EMBEDDED_CANVAS_MIN_WIDTH,
		EMBEDDED_CANVAS_MIN_HEIGHT
	} from "$lib/constants";
	import { get } from "svelte/store";
	import { findAncestorChain, findTaskById } from "$lib/utils/task-helpers";
	import { refreshRunningTerminals } from "$lib/stores/running-terminals";

	setCanvasContext({
		onTaskUpdate: handleTaskUpdate,
		onTaskCreate: handleTaskCreate,
		onTaskDelete: handleTaskDelete,
		onDrillDown: handleDrillDown,
		onTaskWarp: handleTaskWarp,
		onTaskWarpOut: handleTaskWarpOut
	});

	const canvasOffsetsCtx = createCanvasOffsetsContext();

	let settings: AppSettings = { projects: [] };
	let currentProject: Project | null = null;
	let tasks: Task[] = [];
	let navigationPath: Task[] = [];
	let isElectron = false;
	let mainEl: HTMLDivElement;

	$: currentTasks = navigationPath.length === 0 ? tasks : navigationPath[navigationPath.length - 1].subtasks;

	$: currentTasksDir = currentProject
		? navigationPath.length === 0
			? `${currentProject.path}/productmap/tasks`
			: `${navigationPath[navigationPath.length - 1].path}/tasks`
		: "";

	// Generate a unique key for the current canvas level (project + navigation path)
	$: canvasKey = currentProject ? [currentProject.path, ...navigationPath.map((t) => t.id)].join("/") : "";

	// Ancestor chain for the selected task (for shelf breadcrumbs)
	$: selectedTaskAncestors = $selectedTask ? findAncestorChain(tasks, $selectedTask.id) : [];

	function applyTheme(theme: Theme) {
		const effectiveTheme =
			theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
		document.documentElement.dataset.theme = effectiveTheme;
	}

	onMount(async () => {
		isElectron = typeof window !== "undefined" && window.electronAPI !== undefined;

		if (isElectron) {
			settings = await window.electronAPI.loadSettings();

			// Apply theme from settings on load
			applyTheme(settings.theme ?? "system");

			// Listen for system theme changes when in "system" mode
			const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
			mediaQuery.addEventListener("change", () => {
				if (settings.theme === "system" || !settings.theme) {
					applyTheme("system");
				}
			});

			// Refresh running terminals state on app startup
			await refreshRunningTerminals();

			window.electronAPI.onFilesChanged(async () => {
				if (currentProject) {
					await reloadTasks();
				}
			});
		}

		// Add keyboard event listener for copy/paste
		window.addEventListener("keydown", handleKeyDown);
	});

	onDestroy(() => {
		if (typeof window !== "undefined") {
			window.removeEventListener("keydown", handleKeyDown);
		}
	});

	function isTextInputFocused(): boolean {
		const activeElement = document.activeElement;
		if (!activeElement) return false;

		const tagName = activeElement.tagName.toLowerCase();
		if (tagName === "input" || tagName === "textarea") return true;
		if ((activeElement as HTMLElement).isContentEditable) return true;

		return false;
	}

	function zoomTowardCenter(direction: "in" | "out") {
		if (!mainEl) return;

		const oldZoom = get(zoom);
		if (direction === "in") {
			zoomIn();
		} else {
			zoomOut();
		}
		const newZoom = get(zoom);

		// If zoom didn't change (at min/max), do nothing
		if (oldZoom === newZoom) return;

		const rect = mainEl.getBoundingClientRect();
		const offset = get(canvasOffsetsCtx.store).offset;
		const newOffset = calculateCenteredZoomOffset(oldZoom, newZoom, rect.width, rect.height, offset);

		canvasOffsetsCtx.setOffset(newOffset);
		canvasOffsetsCtx.save();
	}

	function handleZoomChange(newZoom: number) {
		if (!mainEl) {
			setZoom(newZoom);
			return;
		}

		const oldZoom = get(zoom);
		setZoom(newZoom);
		const actualNewZoom = get(zoom); // Get clamped value

		// If zoom didn't change, do nothing
		if (oldZoom === actualNewZoom) return;

		const rect = mainEl.getBoundingClientRect();
		const offset = get(canvasOffsetsCtx.store).offset;
		const newOffset = calculateCenteredZoomOffset(oldZoom, actualNewZoom, rect.width, rect.height, offset);

		canvasOffsetsCtx.setOffset(newOffset);
		canvasOffsetsCtx.save();
	}

	function handleKeyDown(e: KeyboardEvent) {
		// Ignore if text input is focused
		if (isTextInputFocused()) return;

		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
		const modifierKey = isMac ? e.metaKey : e.ctrlKey;

		if (modifierKey && e.key === "c") {
			// Copy selected task
			if ($selectedTask) {
				e.preventDefault();
				copyTask($selectedTask);
			}
		} else if (modifierKey && e.key === "v") {
			// Paste copied task
			if ($clipboard && currentProject) {
				e.preventDefault();
				handleTaskDuplicate($clipboard);
			}
		} else if (e.key === "=" || e.key === "+") {
			// Zoom in toward center
			e.preventDefault();
			zoomTowardCenter("in");
		} else if (e.key === "-") {
			// Zoom out toward center
			e.preventDefault();
			zoomTowardCenter("out");
		} else if (e.key === "0") {
			// Reset zoom to 100%
			e.preventDefault();
			handleZoomChange(1);
		}
	}

	async function reloadTasks() {
		if (isElectron && currentProject) {
			const selectedId = $selectedTask?.id;
			console.log("reloadTasks: starting, selectedTask.id =", selectedId);

			tasks = await window.electronAPI.loadProject(currentProject.path);

			// Update selected task with fresh data from reloaded tree
			if ($selectedTask) {
				console.log("reloadTasks: looking for task with id =", $selectedTask.id);
				const updatedTask = findTaskById(tasks, $selectedTask.id);
				if (updatedTask) {
					console.log("reloadTasks: found task, re-selecting");
					selectTask(updatedTask);
				} else {
					// Task was deleted externally
					console.log("reloadTasks: task NOT found, clearing selection. Available IDs:", tasks.map(t => t.id));
					clearSelection();
				}
			}
		}
	}

	async function loadProject(project: Project) {
		currentProject = project;
		navigationPath = [];
		clearSelection();

		if (isElectron) {
			tasks = await window.electronAPI.loadProject(project.path);
			await window.electronAPI.startWatching(project.path);
		}
	}

	async function createProject(name: string, path: string) {
		const project: Project = { name, path };

		if (isElectron) {
			await window.electronAPI.initProject(path);
			settings.projects.push(project);
			await window.electronAPI.saveSettings(settings);
			settings = settings;
		}

		await loadProject(project);
	}

	async function handleThemeChange(theme: Theme) {
		applyTheme(theme);
		settings.theme = theme;

		if (isElectron) {
			await window.electronAPI.saveSettings(settings);
		}
	}

	function handleTaskPreview(task: Task) {
		// Update local state for instant UI reactivity (no save to disk)
		// Create a shallow copy so Svelte's keyed each block detects the change
		const updatedTask = { ...task };
		updateTaskInTree(tasks, updatedTask);
		tasks = tasks;

		if ($selectedTask?.id === task.id) {
			selectTask(updatedTask);
		}
	}

	async function handleTaskUpdate(task: Task) {
		if (!isElectron) return;

		const meta = {
			state: task.state,
			color: task.color,
			progress: task.progress,
			x: task.x,
			y: task.y,
			width: task.width,
			height: task.height,
			name: task.name,
			description: task.description,
			completedAt: task.completedAt,
			questions: task.questions
		};

		const newPath = await window.electronAPI.saveTask(task.path, meta, task.readme);

		// Update path if directory was renamed
		if (newPath && newPath !== task.path) {
			task.path = newPath;
		}

		// Update local state
		updateTaskInTree(tasks, task);
		tasks = tasks;

		if ($selectedTask?.id === task.id) {
			selectTask(task);
		}
	}

	function updateTaskInTree(taskList: Task[], updatedTask: Task): boolean {
		for (let i = 0; i < taskList.length; i++) {
			if (taskList[i].id === updatedTask.id) {
				taskList[i] = updatedTask;
				return true;
			}
			if (updateTaskInTree(taskList[i].subtasks, updatedTask)) {
				return true;
			}
		}
		return false;
	}

	async function handleTaskCreate(parentTask: Task | null, x: number, y: number) {
		if (!isElectron) return;

		// Determine the directory to create the task in
		const tasksDir = parentTask ? `${parentTask.path}/tasks` : currentTasksDir;

		if (!tasksDir) return;

		const meta = {
			state: "Unstarted" as const,
			x,
			y,
			width: NEW_CARD_WIDTH,
			height: NEW_CARD_HEIGHT,
			name: "New Task",
			description: "",
			questions: []
		};

		const { taskPath, taskId } = await window.electronAPI.createTask(tasksDir, meta);

		const newTask: Task = {
			...meta,
			id: taskId,
			path: taskPath,
			readme: "",
			subtasks: []
		};

		if (parentTask) {
			// Adding subtask to a parent task
			parentTask.subtasks.push(newTask);
			updateTaskInTree(tasks, parentTask);
			tasks = tasks;
		} else if (navigationPath.length === 0) {
			// Adding to root level
			tasks = [...tasks, newTask];
		} else {
			// Adding to current navigation level
			navigationPath[navigationPath.length - 1].subtasks.push(newTask);
			tasks = tasks;
		}

		console.log({ tasks });

		// Wait for Svelte to process the array update before selecting
		// This ensures the task is opened like an existing task
		await tick();
		selectTask(newTask);
	}

	async function handleTaskDelete(task: Task) {
		if (!isElectron) return;

		const hasSubtasks = task.subtasks.length > 0;
		if (hasSubtasks) {
			const confirmed = window.confirm(`Delete "${task.name}" and all its ${task.subtasks.length} subtask(s)?`);
			if (!confirmed) return;
		}

		await window.electronAPI.deleteTask(task.path);

		// Remove from local state
		removeTaskFromTree(tasks, task.id);
		tasks = tasks;

		if ($selectedTask?.id === task.id) {
			clearSelection();
		}
	}

	function removeTaskFromTree(taskList: Task[], taskId: string): boolean {
		for (let i = 0; i < taskList.length; i++) {
			if (taskList[i].id === taskId) {
				taskList.splice(i, 1);
				return true;
			}
			if (removeTaskFromTree(taskList[i].subtasks, taskId)) {
				return true;
			}
		}
		return false;
	}

	async function handleTaskDuplicate(task: Task) {
		if (!isElectron || !currentProject) return;

		// Create duplicate at the current navigation level
		const tasksDir = currentTasksDir;

		if (!tasksDir) return;

		// Offset the duplicate position by one grid cell
		const offsetAmount = BASE_GRID_SIZE * 2;

		const meta = {
			state: task.state,
			color: task.color,
			progress: task.progress,
			x: task.x + offsetAmount,
			y: task.y + offsetAmount,
			width: task.width,
			height: task.height,
			name: task.name,
			description: task.description,
			questions: task.questions ? structuredClone(task.questions) : []
		};

		const { taskPath, taskId } = await window.electronAPI.createTask(tasksDir, meta);

		// Copy the readme content
		const newTask: Task = {
			...meta,
			id: taskId,
			path: taskPath,
			readme: task.readme,
			subtasks: []
		};

		// Save the task with readme
		await window.electronAPI.saveTask(taskPath, meta, task.readme);

		// Add to current navigation level
		if (navigationPath.length === 0) {
			tasks = [...tasks, newTask];
		} else {
			navigationPath[navigationPath.length - 1].subtasks.push(newTask);
			tasks = tasks;
		}

		selectTask(newTask);
	}

	function handleDrillDown(task: Task) {
		navigationPath = [...navigationPath, task];
		clearSelection();
	}

	function handleNavigate(index: number) {
		if (index < 0) {
			navigationPath = [];
		} else {
			navigationPath = navigationPath.slice(0, index + 1);
		}
		clearSelection();
	}

	async function handleTaskWarp(task: Task, targetTask: Task, targetX: number, targetY: number) {
		if (!isElectron) return;

		// Move task directory to target's tasks/ directory
		const targetTasksDir = `${targetTask.path}/tasks`;
		const newPath = await window.electronAPI.moveTask(task.path, targetTasksDir);

		// Update task properties - position is relative to target's embedded canvas
		task.path = newPath;
		task.x = targetX;
		task.y = targetY;

		// Save updated meta with new position
		const meta = {
			state: task.state,
			color: task.color,
			progress: task.progress,
			x: task.x,
			y: task.y,
			width: task.width,
			height: task.height,
			name: task.name,
			description: task.description,
			completedAt: task.completedAt,
			questions: task.questions
		};
		await window.electronAPI.saveTask(task.path, meta, task.readme);

		// Remove from old location in tree
		removeTaskFromTree(tasks, task.id);

		// Add to target's subtasks
		targetTask.subtasks.push(task);
		updateTaskInTree(tasks, targetTask);

		tasks = tasks;
		clearSelection();
	}

	async function handleTaskWarpOut(task: Task, x: number, y: number) {
		if (!isElectron) return;

		// Move task directory to current level's tasks/ directory
		const newPath = await window.electronAPI.moveTask(task.path, currentTasksDir);

		// Update task properties
		task.path = newPath;
		task.x = x;
		task.y = y;

		// Save updated meta with new position
		const meta = {
			state: task.state,
			color: task.color,
			progress: task.progress,
			x: task.x,
			y: task.y,
			width: task.width,
			height: task.height,
			name: task.name,
			description: task.description,
			completedAt: task.completedAt,
			questions: task.questions
		};
		await window.electronAPI.saveTask(task.path, meta, task.readme);

		// Remove from old location in tree
		removeTaskFromTree(tasks, task.id);

		// Add to current navigation level
		if (navigationPath.length === 0) {
			tasks = [...tasks, task];
		} else {
			navigationPath[navigationPath.length - 1].subtasks.push(task);
			tasks = tasks;
		}

		clearSelection();
	}

	function handleSelectSubtask(subtask: Task) {
		selectTask(subtask);
	}

	function handleSelectParent(parentTask: Task) {
		// Select the parent task
		selectTask(parentTask);

		// Check if the parent task is on the current canvas level
		const parentIsOnCurrentCanvas = currentTasks.some((t) => t.id === parentTask.id);

		if (parentIsOnCurrentCanvas && mainEl) {
			// Pan the main canvas to center the parent task
			const mainRect = mainEl.getBoundingClientRect();
			const currentShelfWidth = get(shelfWidth);
			const visibleWidth = mainRect.width - currentShelfWidth;
			const visibleHeight = mainRect.height;

			// Calculate offset to center the parent task
			const taskCenterX = parentTask.x + parentTask.width / 2;
			const taskCenterY = parentTask.y + parentTask.height / 2;

			const targetOffset = {
				x: visibleWidth / 2 - taskCenterX,
				y: visibleHeight / 2 - taskCenterY
			};

			canvasOffsetsCtx.animateOffset(targetOffset);
		} else {
			// Parent is in an embedded canvas - find its parent and pan there
			const parentAncestors = findAncestorChain(tasks, parentTask.id);
			const immediateParent = parentAncestors[parentAncestors.length - 1];

			if (immediateParent) {
				const immediateParentIsOnCanvas = currentTasks.some((t) => t.id === immediateParent.id);
				const immediateParentHasEmbeddedCanvas =
					immediateParent.width >= EMBEDDED_CANVAS_MIN_WIDTH && immediateParent.height >= EMBEDDED_CANVAS_MIN_HEIGHT;

				if (immediateParentIsOnCanvas && immediateParentHasEmbeddedCanvas) {
					const parentCard = document.querySelector(`[data-task-id="${immediateParent.id}"]`);
					const embeddedCanvas = parentCard?.querySelector(".canvas.embedded") as HTMLElement;

					if (embeddedCanvas) {
						const canvasRect = embeddedCanvas.getBoundingClientRect();

						const taskCenterX = parentTask.x + parentTask.width / 2;
						const taskCenterY = parentTask.y + parentTask.height / 2;

						const targetOffset = {
							x: canvasRect.width / 2 - taskCenterX,
							y: canvasRect.height / 2 - taskCenterY
						};

						canvasOffsetsCtx.animateEmbeddedOffset(immediateParent.id, targetOffset);
					}
				}
			}
		}
	}
</script>

<div class="app">
	<Toolbar
		{settings}
		{currentProject}
		on:loadProject={(e) => loadProject(e.detail)}
		on:createProject={(e) => createProject(e.detail.name, e.detail.path)}
		on:themeChange={(e) => handleThemeChange(e.detail)}
		on:zoomChange={(e) => handleZoomChange(e.detail)}
		{isElectron}
	/>

	<div class="main" bind:this={mainEl}>
		{#if currentProject}
			<Breadcrumb {navigationPath} projectName={currentProject.name} on:navigate={(e) => handleNavigate(e.detail)} />

			<Canvas tasks={currentTasks} {canvasKey} />

			{#if $selectedTask}
				{#key $selectedTask.id}
					<Shelf
						task={$selectedTask}
						ancestors={selectedTaskAncestors}
						projectPath={currentProject.path}
						on:preview={(e) => handleTaskPreview(e.detail)}
						on:update={(e) => handleTaskUpdate(e.detail)}
						on:delete={(e) => handleTaskDelete(e.detail)}
						on:duplicate={(e) => handleTaskDuplicate(e.detail)}
						on:close={clearSelection}
						on:selectSubtask={(e) => handleSelectSubtask(e.detail)}
						on:selectParent={(e) => handleSelectParent(e.detail)}
					/>
				{/key}
			{/if}
		{:else}
			<div class="welcome">
				<h1>Welcome to Productmap</h1>
				<p>Create or open a project to get started.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	.main {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.welcome {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: var(--spacing-md);
	}

	.welcome h1 {
		margin: 0;
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-semibold);
	}

	.welcome p {
		margin: 0;
		color: var(--app-text-muted);
		font-size: var(--font-size-md);
	}
</style>
