import { writable } from "svelte/store";
import type { Task } from "$lib/types";

export interface DragState {
	task: Task | null;
	parentTaskId: string | null;
	dropTarget: Task | null;
	dropToRoot: boolean;
	mousePosition: { x: number; y: number } | null;
	// Position relative to the drop target's embedded canvas (in canvas coordinates)
	targetCanvasPosition: { x: number; y: number } | null;
}

const initialState: DragState = {
	task: null,
	parentTaskId: null,
	dropTarget: null,
	dropToRoot: false,
	mousePosition: null,
	targetCanvasPosition: null
};

function createDragState() {
	const { subscribe, set, update } = writable<DragState>(initialState);

	return {
		subscribe,
		startDrag: (task: Task, parentTaskId: string | null) => {
			set({
				task,
				parentTaskId,
				dropTarget: null,
				dropToRoot: false,
				mousePosition: null,
				targetCanvasPosition: null
			});
		},
		setDropTarget: (target: Task | null) => {
			update((state) => ({ ...state, dropTarget: target }));
		},
		setDropToRoot: (value: boolean) => {
			update((state) => ({ ...state, dropToRoot: value }));
		},
		setMousePosition: (x: number, y: number) => {
			update((state) => ({ ...state, mousePosition: { x, y } }));
		},
		setTargetCanvasPosition: (x: number, y: number) => {
			update((state) => ({ ...state, targetCanvasPosition: { x, y } }));
		},
		endDrag: () => {
			set(initialState);
		},
		get: () => {
			let current: DragState = initialState;
			subscribe((value) => (current = value))();
			return current;
		}
	};
}

export const dragState = createDragState();
