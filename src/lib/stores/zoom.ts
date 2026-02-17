import { writable } from "svelte/store";

// Zoom range constants
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.25; // For keyboard +/- increments
export const ZOOM_WHEEL_SENSITIVITY = 0.005; // Sensitivity for wheel/trackpad deltaY

// Grid size in pixels at 100% zoom
export const BASE_GRID_SIZE = 20;

const STORAGE_KEY = "productmap:zoom";

function clampZoom(value: number): number {
	return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function roundZoom(value: number): number {
	// Round to 2 decimal places to avoid floating point issues
	return Math.round(value * 100) / 100;
}

export function formatZoomLabel(zoom: number): string {
	return `${Math.round(zoom * 100)}%`;
}

function loadZoom(): number {
	if (typeof localStorage === "undefined") return 1;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		const parsed = parseFloat(stored);
		if (!isNaN(parsed)) {
			return clampZoom(parsed);
		}
	}
	return 1;
}

function saveZoom(level: number) {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(STORAGE_KEY, String(level));
}

function createZoomStore() {
	const { subscribe, set, update } = writable<number>(loadZoom());

	return {
		subscribe,
		set: (level: number) => {
			const clamped = clampZoom(roundZoom(level));
			set(clamped);
			saveZoom(clamped);
		},
		update: (fn: (current: number) => number) => {
			update((current) => {
				const newLevel = clampZoom(roundZoom(fn(current)));
				saveZoom(newLevel);
				return newLevel;
			});
		}
	};
}

export const zoom = createZoomStore();

export function zoomIn(step: number = ZOOM_STEP) {
	zoom.update((current) => current + step);
}

export function zoomOut(step: number = ZOOM_STEP) {
	zoom.update((current) => current - step);
}

export function setZoom(level: number) {
	zoom.set(level);
}

/**
 * Get a smaller zoom level for sub-canvases.
 */
export function getSubCanvasZoom(parentZoom: number): number {
	return Math.max(MIN_ZOOM, parentZoom * 0.4);
}

/**
 * Calculate new offset to keep a focal point fixed when zooming.
 * @param oldZoom - Previous zoom level
 * @param newZoom - New zoom level
 * @param focalX - X position of focal point in screen coordinates (relative to canvas)
 * @param focalY - Y position of focal point in screen coordinates (relative to canvas)
 * @param currentOffset - Current pan offset
 * @returns New offset that keeps the focal point fixed
 */
export function calculateZoomOffset(
	oldZoom: number,
	newZoom: number,
	focalX: number,
	focalY: number,
	currentOffset: { x: number; y: number }
): { x: number; y: number } {
	// Calculate the logical point at the focal position before zoom
	const logicalX = focalX / oldZoom - currentOffset.x;
	const logicalY = focalY / oldZoom - currentOffset.y;

	// Calculate new offset so that the same logical point stays at the focal position after zoom
	return {
		x: focalX / newZoom - logicalX,
		y: focalY / newZoom - logicalY
	};
}

/**
 * Calculate new offset to keep the viewport center fixed when zooming.
 * Used for keyboard shortcuts and UI-based zoom changes.
 */
export function calculateCenteredZoomOffset(
	oldZoom: number,
	newZoom: number,
	viewportWidth: number,
	viewportHeight: number,
	currentOffset: { x: number; y: number }
): { x: number; y: number } {
	const centerX = viewportWidth / 2;
	const centerY = viewportHeight / 2;
	return calculateZoomOffset(oldZoom, newZoom, centerX, centerY, currentOffset);
}
