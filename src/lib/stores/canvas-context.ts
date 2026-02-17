import { getContext, setContext } from "svelte";
import type { Task } from "$lib/types";

const CANVAS_CONTEXT_KEY = "canvas-context";

export interface CanvasContextValue {
	onTaskUpdate: (task: Task) => void;
	onTaskCreate: (parentTask: Task | null, x: number, y: number) => void;
	onTaskDelete: (task: Task) => void;
	onDrillDown: (task: Task) => void;
	onTaskWarp: (task: Task, targetTask: Task, targetX: number, targetY: number) => void;
	onTaskWarpOut: (task: Task, x: number, y: number) => void;
}

export function setCanvasContext(value: CanvasContextValue): void {
	setContext(CANVAS_CONTEXT_KEY, value);
}

export function getCanvasContext(): CanvasContextValue {
	return getContext<CanvasContextValue>(CANVAS_CONTEXT_KEY);
}
