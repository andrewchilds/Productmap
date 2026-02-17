import { writable } from "svelte/store";
import type { Task } from "$lib/types";

// Stores a deep copy of the task data (without path/id which are regenerated on paste)
export const clipboard = writable<Task | null>(null);

export function copyTask(task: Task) {
	// Store a deep copy of the task
	clipboard.set(structuredClone(task));
}

export function clearClipboard() {
	clipboard.set(null);
}
