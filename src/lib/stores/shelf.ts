import { writable } from "svelte/store";

const STORAGE_KEY = "productmap-shelf-width";
const DEFAULT_WIDTH = 600;
const MIN_WIDTH = 300;
const MAX_WIDTH = 1000;

function clampWidth(width: number): number {
	return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

function loadFromStorage(): number {
	if (typeof localStorage === "undefined") {
		return DEFAULT_WIDTH;
	}
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		const parsed = parseInt(stored, 10);
		if (!isNaN(parsed)) {
			return clampWidth(parsed);
		}
	}
	return DEFAULT_WIDTH;
}

function createShelfWidthStore() {
	const { subscribe, set } = writable<number>(DEFAULT_WIDTH);

	return {
		subscribe,
		set: (width: number) => {
			const clamped = clampWidth(width);
			set(clamped);
			if (typeof localStorage !== "undefined") {
				localStorage.setItem(STORAGE_KEY, String(clamped));
			}
		},
		load: () => {
			const width = loadFromStorage();
			set(width);
			return width;
		}
	};
}

export const shelfWidth = createShelfWidthStore();
