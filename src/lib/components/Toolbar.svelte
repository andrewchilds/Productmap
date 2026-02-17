<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { Plus } from "lucide-svelte";
	import type { AppSettings, Project, Theme } from "$lib/types";
	import Button from "./Button.svelte";
	import ZoomSelector from "./ZoomSelector.svelte";
	import ThemeSelector from "./ThemeSelector.svelte";

	export let settings: AppSettings;
	export let currentProject: Project | null;
	export let isElectron: boolean;

	const dispatch = createEventDispatcher<{
		loadProject: Project;
		createProject: { name: string; path: string };
		themeChange: Theme;
		zoomChange: number;
	}>();

	let showCreateModal = false;
	let newProjectName = "";
	let newProjectPath = "";

	async function handleSelectDirectory() {
		if (!isElectron) return;
		const path = await window.electronAPI.selectDirectory();
		if (path) {
			newProjectPath = path;
		}
	}

	function handleCreateProject() {
		if (!newProjectName.trim() || !newProjectPath.trim()) return;
		dispatch("createProject", { name: newProjectName.trim(), path: newProjectPath.trim() });
		showCreateModal = false;
		newProjectName = "";
		newProjectPath = "";
	}

	function handleOpenProject(project: Project) {
		dispatch("loadProject", project);
	}
</script>

<header class="toolbar">
	<div class="toolbar-left">
		<span class="app-name">Productmap</span>
		{#if settings.projects.length > 0}
			<div class="project-tabs">
				{#each settings.projects as project}
					<button
						class="project-tab"
						class:active={currentProject?.path === project.path}
						on:click={() => handleOpenProject(project)}
					>
						{project.name}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="toolbar-right">
		<ZoomSelector on:change={(e) => dispatch("zoomChange", e.detail)} />
		<ThemeSelector theme={settings.theme ?? "system"} on:change={(e) => dispatch("themeChange", e.detail)} />
		<Button
			variant={settings.projects.length === 0 ? "primary" : "secondary"}
			on:click={() => (showCreateModal = true)}
		>
			<Plus size={16} />
			<span>New Project</span>
		</Button>
	</div>
</header>

{#if showCreateModal}
	<div class="modal-overlay" on:click={() => (showCreateModal = false)} on:keydown={() => {}}>
		<div class="modal" on:click|stopPropagation on:keydown={() => {}}>
			<h2>New Project</h2>

			<div class="form-group">
				<label for="project-name">Project Name</label>
				<input id="project-name" type="text" bind:value={newProjectName} placeholder="My Project" />
			</div>

			<div class="form-group">
				<label for="project-path">Project Directory</label>
				<div class="path-input">
					<input id="project-path" type="text" bind:value={newProjectPath} placeholder="/path/to/project" readonly />
					<Button variant="secondary" on:click={handleSelectDirectory}>Browse</Button>
				</div>
			</div>

			<div class="modal-actions">
				<Button variant="secondary" on:click={() => (showCreateModal = false)}>Cancel</Button>
				<Button
					variant="primary"
					on:click={handleCreateProject}
					disabled={!newProjectName.trim() || !newProjectPath.trim()}
				>
					Create
				</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 48px;
		padding: 0 var(--spacing-md);
		background: var(--toolbar-bg);
		border-bottom: 1px solid var(--toolbar-border);
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		align-self: stretch;
		gap: var(--spacing-md);
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.app-name {
		font-weight: var(--font-weight-semibold);
		color: var(--toolbar-text);
	}

	.project-tabs {
		display: flex;
		align-items: stretch;
		align-self: stretch;
		margin: 4px 0 0;
	}

	.project-tab {
		padding: 0 var(--spacing-md);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--app-text-muted);
		background: transparent;
		border-bottom: 2px solid transparent;
		transition:
			color var(--transition-fast),
			border-color var(--transition-fast);
	}

	.project-tab:hover {
		color: var(--app-text);
	}

	.project-tab.active {
		color: var(--app-text);
		border-bottom-color: var(--button-primary-bg);
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--modal-overlay);
		z-index: 1000;
	}

	.modal {
		width: 400px;
		padding: var(--spacing-lg);
		background: var(--modal-bg);
		border: 1px solid var(--modal-border);
		border-radius: var(--radius-lg);
		box-shadow: 0 8px 24px var(--modal-shadow);
	}

	.modal h2 {
		margin: 0 0 var(--spacing-lg);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
	}

	.form-group {
		margin-bottom: var(--spacing-md);
	}

	.form-group label {
		display: block;
		margin-bottom: var(--spacing-xs);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--app-text-muted);
	}

	.form-group input {
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--input-bg);
		border: 1px solid var(--input-border);
		border-radius: var(--radius-sm);
		color: var(--input-text);
	}

	.form-group input:focus {
		border-color: var(--input-border-focus);
	}

	.form-group input::placeholder {
		color: var(--input-placeholder);
	}

	.path-input {
		display: flex;
		gap: var(--spacing-sm);
	}

	.path-input input {
		flex: 1;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-lg);
	}
</style>
