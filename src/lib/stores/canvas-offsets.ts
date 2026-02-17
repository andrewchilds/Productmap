import { getContext, setContext } from "svelte";
import { writable, get, type Writable } from "svelte/store";

const CANVAS_OFFSETS_KEY = "canvas-offsets";

export interface Offset {
	x: number;
	y: number;
}

export interface CanvasOffsetsData {
	offset: Offset;
	embedded: Record<string, Offset>;
}

export interface CanvasOffsetsContext {
	store: Writable<CanvasOffsetsData>;
	storageKey: Writable<string>;
	load: (key: string) => void;
	save: () => void;
	setOffset: (offset: Offset) => void;
	setEmbeddedOffset: (taskId: string, offset: Offset) => void;
	getEmbeddedOffset: (taskId: string) => Offset;
	animateOffset: (offset: Offset, duration?: number) => void;
	animateEmbeddedOffset: (taskId: string, offset: Offset, duration?: number) => void;
}

function createDefaultData(): CanvasOffsetsData {
	return {
		offset: { x: 0, y: 0 },
		embedded: {}
	};
}

function loadFromStorage(key: string): CanvasOffsetsData {
	if (!key) return createDefaultData();
	const saved = localStorage.getItem(key);
	if (saved) {
		try {
			const parsed = JSON.parse(saved);
			if (parsed && typeof parsed.offset?.x === "number" && typeof parsed.offset?.y === "number") {
				return {
					offset: parsed.offset,
					embedded: parsed.embedded || {}
				};
			}
		} catch {
			// Invalid JSON
		}
	}
	return createDefaultData();
}

function saveToStorage(key: string, data: CanvasOffsetsData): void {
	if (!key) return;
	localStorage.setItem(key, JSON.stringify(data));
}

export function createCanvasOffsetsContext(): CanvasOffsetsContext {
	const store = writable<CanvasOffsetsData>(createDefaultData());
	const storageKey = writable<string>("");
	let animationFrame: number | null = null;
	const embeddedAnimationFrames: Record<string, number> = {};

	const context: CanvasOffsetsContext = {
		store,
		storageKey,
		load: (key: string) => {
			storageKey.set(key);
			store.set(loadFromStorage(key));
		},
		save: () => {
			const key = get(storageKey);
			if (key) {
				saveToStorage(key, get(store));
			}
		},
		setOffset: (offset: Offset) => {
			store.update((data) => ({ ...data, offset }));
		},
		setEmbeddedOffset: (taskId: string, offset: Offset) => {
			store.update((data) => ({
				...data,
				embedded: { ...data.embedded, [taskId]: offset }
			}));
		},
		getEmbeddedOffset: (taskId: string): Offset => {
			return get(store).embedded[taskId] ?? { x: 0, y: 0 };
		},
		animateOffset: (targetOffset: Offset, duration: number = 240) => {
			// Cancel any ongoing animation
			if (animationFrame !== null) {
				cancelAnimationFrame(animationFrame);
			}

			const startOffset = get(store).offset;
			const startTime = performance.now();

			function animate(currentTime: number) {
				const elapsed = currentTime - startTime;
				const progress = Math.min(elapsed / duration, 1);

				// Ease-out cubic
				const eased = 1 - Math.pow(1 - progress, 3);

				const newOffset = {
					x: startOffset.x + (targetOffset.x - startOffset.x) * eased,
					y: startOffset.y + (targetOffset.y - startOffset.y) * eased
				};

				store.update((data) => ({ ...data, offset: newOffset }));

				if (progress < 1) {
					animationFrame = requestAnimationFrame(animate);
				} else {
					animationFrame = null;
					// Save after animation completes
					context.save();
				}
			}

			animationFrame = requestAnimationFrame(animate);
		},
		animateEmbeddedOffset: (taskId: string, targetOffset: Offset, duration: number = 240) => {
			// Cancel any ongoing animation for this embedded canvas
			if (embeddedAnimationFrames[taskId]) {
				cancelAnimationFrame(embeddedAnimationFrames[taskId]);
			}

			const startOffset = get(store).embedded[taskId] ?? { x: 0, y: 0 };
			const startTime = performance.now();

			function animate(currentTime: number) {
				const elapsed = currentTime - startTime;
				const progress = Math.min(elapsed / duration, 1);

				// Ease-out cubic
				const eased = 1 - Math.pow(1 - progress, 3);

				const newOffset = {
					x: startOffset.x + (targetOffset.x - startOffset.x) * eased,
					y: startOffset.y + (targetOffset.y - startOffset.y) * eased
				};

				store.update((data) => ({
					...data,
					embedded: { ...data.embedded, [taskId]: newOffset }
				}));

				if (progress < 1) {
					embeddedAnimationFrames[taskId] = requestAnimationFrame(animate);
				} else {
					delete embeddedAnimationFrames[taskId];
					// Save after animation completes
					context.save();
				}
			}

			embeddedAnimationFrames[taskId] = requestAnimationFrame(animate);
		}
	};

	setContext(CANVAS_OFFSETS_KEY, context);
	return context;
}

export function getCanvasOffsetsContext(): CanvasOffsetsContext | null {
	return getContext<CanvasOffsetsContext | null>(CANVAS_OFFSETS_KEY) ?? null;
}
