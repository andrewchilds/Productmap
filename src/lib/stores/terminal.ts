import { writable } from 'svelte/store';

const STORAGE_KEY = 'productmap-terminal-split-ratio';
const DEFAULT_RATIO = 0.5;
const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

function clampRatio(ratio: number): number {
	return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

function loadFromStorage(): number {
	if (typeof localStorage === 'undefined') {
		return DEFAULT_RATIO;
	}
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		const parsed = parseFloat(stored);
		if (!isNaN(parsed)) {
			return clampRatio(parsed);
		}
	}
	return DEFAULT_RATIO;
}

function createTerminalSplitRatioStore() {
	const { subscribe, set, update } = writable<number>(DEFAULT_RATIO);

	return {
		subscribe,
		set: (ratio: number) => {
			const clamped = clampRatio(ratio);
			set(clamped);
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(STORAGE_KEY, String(clamped));
			}
		},
		load: () => {
			const ratio = loadFromStorage();
			set(ratio);
			return ratio;
		}
	};
}

export const terminalSplitRatio = createTerminalSplitRatioStore();
