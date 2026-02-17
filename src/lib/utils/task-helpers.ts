import type { Task } from "$lib/types";

/**
 * Find a task by ID in the task tree
 */
export function findTaskById(tasks: Task[], targetId: string): Task | null {
	for (const task of tasks) {
		if (task.id === targetId) {
			return task;
		}
		const found = findTaskById(task.subtasks, targetId);
		if (found) {
			return found;
		}
	}
	return null;
}

/**
 * Find the ancestor chain (path from root to task, excluding the task itself)
 */
export function findAncestorChain(tasks: Task[], targetId: string): Task[] {
	function search(subtasks: Task[], ancestors: Task[]): Task[] | null {
		for (const task of subtasks) {
			if (task.id === targetId) {
				return ancestors;
			}
			const result = search(task.subtasks, [...ancestors, task]);
			if (result) {
				return result;
			}
		}
		return null;
	}

	return search(tasks, []) ?? [];
}

/**
 * Check if a task is a descendant of another task (prevents dropping into own children)
 */
export function isDescendantOf(potentialDescendant: Task, potentialAncestor: Task): boolean {
	function searchSubtasks(subtasks: Task[]): boolean {
		for (const subtask of subtasks) {
			if (subtask.id === potentialDescendant.id) {
				return true;
			}
			if (searchSubtasks(subtask.subtasks)) {
				return true;
			}
		}
		return false;
	}

	return searchSubtasks(potentialAncestor.subtasks);
}

/**
 * Check if dropping task onto target would create a cycle
 * (task can't be dropped into itself or its descendants)
 */
export function wouldCreateCycle(draggedTask: Task, targetTask: Task): boolean {
	// Can't drop into self
	if (draggedTask.id === targetTask.id) {
		return true;
	}

	// Can't drop into own descendants
	return isDescendantOf(targetTask, draggedTask);
}
