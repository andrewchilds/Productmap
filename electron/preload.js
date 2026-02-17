const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

	loadSettings: () => ipcRenderer.invoke('settings:load'),
	saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

	loadProject: (projectPath) => ipcRenderer.invoke('project:load', projectPath),
	initProject: (projectPath) => ipcRenderer.invoke('project:init', projectPath),

	saveTask: (taskPath, meta, readme) => ipcRenderer.invoke('task:save', taskPath, meta, readme),
	deleteTask: (taskPath) => ipcRenderer.invoke('task:delete', taskPath),
	createTask: (parentTasksDir, meta) => ipcRenderer.invoke('task:create', parentTasksDir, meta),
	moveTask: (sourcePath, targetTasksDir) => ipcRenderer.invoke('task:move', sourcePath, targetTasksDir),

	startWatching: (projectPath) => ipcRenderer.invoke('watch:start', projectPath),
	stopWatching: () => ipcRenderer.invoke('watch:stop'),

	onFilesChanged: (callback) => {
		ipcRenderer.on('files:changed', (event, data) => callback(data));
	},

	removeFilesChangedListener: () => {
		ipcRenderer.removeAllListeners('files:changed');
	},

	// Terminal API
	spawnTerminal: (terminalId, cwd, cols, rows, prompt, sessionId, resumeSessionId) =>
		ipcRenderer.invoke('terminal:spawn', terminalId, cwd, cols, rows, prompt, sessionId, resumeSessionId),

	writeTerminal: (terminalId, data) =>
		ipcRenderer.invoke('terminal:write', terminalId, data),

	resizeTerminal: (terminalId, cols, rows) =>
		ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),

	killTerminal: (terminalId) =>
		ipcRenderer.invoke('terminal:kill', terminalId),

	getTerminalBuffer: (terminalId) =>
		ipcRenderer.invoke('terminal:getBuffer', terminalId),

	isTerminalAlive: (terminalId) =>
		ipcRenderer.invoke('terminal:isAlive', terminalId),

	listTerminals: () =>
		ipcRenderer.invoke('terminal:list'),

	cleanupTerminal: (terminalId) =>
		ipcRenderer.invoke('terminal:cleanup', terminalId),

	onTerminalData: (terminalId, callback) => {
		ipcRenderer.on(`terminal:data:${terminalId}`, (event, data) => callback(data));
	},

	onTerminalExit: (terminalId, callback) => {
		ipcRenderer.on(`terminal:exit:${terminalId}`, (event, exitCode) => callback(exitCode));
	},

	removeTerminalListeners: (terminalId) => {
		ipcRenderer.removeAllListeners(`terminal:data:${terminalId}`);
		ipcRenderer.removeAllListeners(`terminal:exit:${terminalId}`);
	},

	// Session persistence API
	loadSession: (taskId) =>
		ipcRenderer.invoke('session:load', taskId),

	saveSession: (taskId, data) =>
		ipcRenderer.invoke('session:save', taskId, data),

	deleteSession: (taskId) =>
		ipcRenderer.invoke('session:delete', taskId)
});
