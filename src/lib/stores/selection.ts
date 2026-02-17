import { writable } from "svelte/store";
import type { Task } from "$lib/types";

export const selectedTask = writable<Task | null>(null);

export function selectTask(task: Task | null) {
	console.log("models/selection:selectTask");
	selectedTask.set(task);
}

export function clearSelection() {
	console.log("models/selection:clearSelection");
	selectedTask.set(null);
}
