import { writable, derived } from "svelte/store";

// Set of task IDs that have running terminal processes
const runningTaskIds = writable<Set<string>>(new Set());

// Extract task ID from terminal ID (format: "term-{taskId}")
function extractTaskId(terminalId: string): string | null {
	const match = terminalId.match(/^term-(.+)$/);
	return match ? match[1] : null;
}

// Check if a specific task has a running terminal
export function hasRunningTerminal(taskId: string) {
	return derived(runningTaskIds, ($ids) => $ids.has(taskId));
}

// Get the full set of running task IDs (for components that need to check multiple)
export const runningTerminalTasks = {
	subscribe: runningTaskIds.subscribe
};

// Refresh the list of running terminals from the main process
export async function refreshRunningTerminals() {
	if (typeof window === "undefined" || !window.electronAPI) return;

	const terminals = await window.electronAPI.listTerminals();
	const taskIds = new Set<string>();

	for (const terminal of terminals) {
		if (terminal.status === "running") {
			const taskId = extractTaskId(terminal.id);
			if (taskId) {
				taskIds.add(taskId);
			}
		}
	}

	runningTaskIds.set(taskIds);
}

// Mark a task as having a running terminal
export function markTerminalRunning(taskId: string) {
	runningTaskIds.update((ids) => {
		const newIds = new Set(ids);
		newIds.add(taskId);
		return newIds;
	});
}

// Mark a task's terminal as stopped
export function markTerminalStopped(taskId: string) {
	runningTaskIds.update((ids) => {
		const newIds = new Set(ids);
		newIds.delete(taskId);
		return newIds;
	});
}
