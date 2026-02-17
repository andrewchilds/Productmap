// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { Task, TaskMeta, AppSettings } from '$lib/types';

interface TerminalBufferResult {
	buffer: string;
	status: 'running' | 'exited';
	exitCode: number | null;
}

interface TerminalAliveResult {
	exists: boolean;
	status?: 'running' | 'exited';
	exitCode?: number | null;
}

interface TerminalListEntry {
	id: string;
	status: 'running' | 'exited';
	exitCode: number | null;
}

interface SessionData {
	taskPath?: string;
	claudeSessionId?: string | null;
	activeTab?: 'details' | 'plan' | 'terminal';
	terminalStopped?: boolean;
}

interface ElectronAPI {
	selectDirectory: () => Promise<string | null>;
	loadSettings: () => Promise<AppSettings>;
	saveSettings: (settings: AppSettings) => Promise<void>;
	loadProject: (projectPath: string) => Promise<Task[]>;
	initProject: (projectPath: string) => Promise<boolean>;
	saveTask: (taskPath: string, meta: TaskMeta, readme?: string) => Promise<string>;
	deleteTask: (taskPath: string) => Promise<void>;
	createTask: (parentTasksDir: string, meta: TaskMeta) => Promise<{ taskPath: string; taskId: string }>;
	moveTask: (sourcePath: string, targetTasksDir: string) => Promise<string>;
	startWatching: (projectPath: string) => Promise<void>;
	stopWatching: () => Promise<void>;
	onFilesChanged: (callback: (data: { eventType: string; filePath: string }) => void) => void;
	removeFilesChangedListener: () => void;

	// Terminal API
	spawnTerminal: (terminalId: string, cwd: string, cols: number, rows: number, prompt: string | null, sessionId: string | null, resumeSessionId: string | null) => Promise<boolean>;
	writeTerminal: (terminalId: string, data: string) => Promise<void>;
	resizeTerminal: (terminalId: string, cols: number, rows: number) => Promise<void>;
	killTerminal: (terminalId: string) => Promise<void>;
	getTerminalBuffer: (terminalId: string) => Promise<TerminalBufferResult | null>;
	isTerminalAlive: (terminalId: string) => Promise<TerminalAliveResult>;
	listTerminals: () => Promise<TerminalListEntry[]>;
	cleanupTerminal: (terminalId: string) => Promise<void>;
	onTerminalData: (terminalId: string, callback: (data: string) => void) => void;
	onTerminalExit: (terminalId: string, callback: (exitCode: number) => void) => void;
	removeTerminalListeners: (terminalId: string) => void;

	// Session persistence API
	loadSession: (taskId: string) => Promise<SessionData>;
	saveSession: (taskId: string, data: SessionData) => Promise<void>;
	deleteSession: (taskId: string) => Promise<void>;
}

declare global {
	interface Window {
		electronAPI: ElectronAPI;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
