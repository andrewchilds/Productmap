<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { Task } from '$lib/types';
	import { generateTaskPrompt } from '$lib/utils/prompt-generator';
	import { markTerminalRunning, markTerminalStopped } from '$lib/stores/running-terminals';
	import '@xterm/xterm/css/xterm.css';

	export let task: Task;
	export let projectPath: string;

	// Terminal owns its own lifecycle - no props from parent for session state
	const terminalId = `term-${task.id}`;

	const dispatch = createEventDispatcher<{
		exit: { exitCode: number };
		ready: { status: 'running' | 'exited' };
	}>();

	let terminalContainer: HTMLDivElement;
	let terminal: import('@xterm/xterm').Terminal | null = null;
	let fitAddon: import('@xterm/addon-fit').FitAddon | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let isInitialized = false;
	let showScrollButton = false;

	function handleViewportScroll(event: Event) {
		const viewport = event.target as HTMLElement;
		const isAtBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 10;
		showScrollButton = !isAtBottom;
	}

	function scrollToBottom() {
		const viewport = terminalContainer.querySelector('.xterm-viewport');
		if (viewport) {
			viewport.scrollTop = viewport.scrollHeight;
		}
	}

	onMount(async () => {
		// Dynamic import to avoid SSR issues
		const [{ Terminal }, { FitAddon }] = await Promise.all([
			import('@xterm/xterm'),
			import('@xterm/addon-fit')
		]);

		terminal = new Terminal({
			cursorBlink: true,
			fontFamily: 'Menlo, Monaco, "Courier New", monospace',
			fontSize: 13,
			lineHeight: 1.2,
			theme: {
				background: '#1a1a1a',
				foreground: '#e0e0e0',
				cursor: '#e0e0e0',
				cursorAccent: '#1a1a1a',
				selectionBackground: 'rgba(255, 255, 255, 0.2)',
				black: '#1a1a1a',
				red: '#ff5f56',
				green: '#5af78e',
				yellow: '#f3f99d',
				blue: '#57c7ff',
				magenta: '#ff6ac1',
				cyan: '#9aedfe',
				white: '#f1f1f0',
				brightBlack: '#686868',
				brightRed: '#ff5f56',
				brightGreen: '#5af78e',
				brightYellow: '#f3f99d',
				brightBlue: '#57c7ff',
				brightMagenta: '#ff6ac1',
				brightCyan: '#9aedfe',
				brightWhite: '#f1f1f0'
			}
		});

		fitAddon = new FitAddon();
		terminal.loadAddon(fitAddon);
		terminal.open(terminalContainer);

		// Initial fit
		fitAddon.fit();

		// Connect terminal input to PTY
		terminal.onData((data) => {
			window.electronAPI.writeTerminal(terminalId, data);
		});

		// Connect PTY output to terminal
		window.electronAPI.onTerminalData(terminalId, (data) => {
			terminal?.write(data);
		});

		// Handle PTY exit
		window.electronAPI.onTerminalExit(terminalId, async (exitCode) => {
			terminal?.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
			markTerminalStopped(task.id);
			// Persist stopped state so it survives tab navigation
			await window.electronAPI.saveSession(task.id, { terminalStopped: true });
			dispatch('exit', { exitCode });
		});

		// Set up resize observer
		resizeObserver = new ResizeObserver(() => {
			if (fitAddon && terminal && isInitialized) {
				// Preserve scroll position before resize
				const viewport = terminalContainer.querySelector('.xterm-viewport');
				const wasAtBottom = viewport
					? viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 10
					: true;
				const previousScrollTop = viewport?.scrollTop ?? 0;

				fitAddon.fit();
				const { cols, rows } = terminal;
				window.electronAPI.resizeTerminal(terminalId, cols, rows);

				// Force refresh to fix cursor position after resize
				terminal.refresh(0, rows - 1);

				// Restore scroll position after resize
				requestAnimationFrame(() => {
					const newViewport = terminalContainer.querySelector('.xterm-viewport');
					if (newViewport) {
						if (wasAtBottom) {
							// Was at bottom, scroll to new bottom
							newViewport.scrollTop = newViewport.scrollHeight;
						} else {
							// Restore previous scroll position
							newViewport.scrollTop = previousScrollTop;
						}
					}
				});
			}
		});
		resizeObserver.observe(terminalContainer);

		// Listen for scroll events on the xterm viewport
		const viewport = terminalContainer.querySelector('.xterm-viewport');
		if (viewport) {
			viewport.addEventListener('scroll', handleViewportScroll);
		}

		// Terminal owns its lifecycle - gather all data first, then decide
		const [session, ptyStatus] = await Promise.all([
			window.electronAPI.loadSession(task.id),
			window.electronAPI.isTerminalAlive(terminalId)
		]);

		const { cols, rows } = terminal;
		let initialStatus: 'running' | 'exited' = 'running';

		if (ptyStatus.exists && ptyStatus.status === 'running') {
			// PTY still alive in memory - reconnect and replay buffer
			const bufferResult = await window.electronAPI.getTerminalBuffer(terminalId);
			if (bufferResult) {
				if (bufferResult.buffer) {
					terminal.write(bufferResult.buffer);
					// Force refresh to fix cursor position after buffer replay
					terminal.refresh(0, terminal.rows - 1);
				}
				if (bufferResult.status === 'exited') {
					terminal.write(`\r\n\x1b[90m[Process exited with code ${bufferResult.exitCode}]\x1b[0m\r\n`);
					initialStatus = 'exited';
					dispatch('exit', { exitCode: bufferResult.exitCode ?? 0 });
				} else {
					markTerminalRunning(task.id);
				}
			}
			isInitialized = true;
		} else if (ptyStatus.exists && ptyStatus.status === 'exited') {
			// PTY exists but exited - replay buffer and show exited state
			const bufferResult = await window.electronAPI.getTerminalBuffer(terminalId);
			if (bufferResult?.buffer) {
				terminal.write(bufferResult.buffer);
				// Force refresh to fix cursor position after buffer replay
				terminal.refresh(0, terminal.rows - 1);
			}
			terminal.write(`\r\n\x1b[90m[Process exited with code ${ptyStatus.exitCode}]\x1b[0m\r\n`);
			initialStatus = 'exited';
			isInitialized = true;
			dispatch('exit', { exitCode: ptyStatus.exitCode ?? 0 });
		} else if (session.terminalStopped) {
			// Terminal was previously stopped - stay stopped until user clicks refresh
			initialStatus = 'exited';
			isInitialized = true;
		} else if (session.claudeSessionId) {
			// PTY dead but have session and not explicitly stopped - resume conversation with --resume flag
			await window.electronAPI.saveSession(task.id, { terminalStopped: false });
			await window.electronAPI.spawnTerminal(terminalId, projectPath, cols, rows, null, null, session.claudeSessionId);
			markTerminalRunning(task.id);
			isInitialized = true;
		} else {
			// Fresh start - generate new session ID
			const claudeSessionId = crypto.randomUUID();
			const prompt = generateTaskPrompt(task);
			await window.electronAPI.saveSession(task.id, { claudeSessionId, terminalStopped: false });
			await window.electronAPI.spawnTerminal(terminalId, projectPath, cols, rows, prompt, claudeSessionId, null);
			markTerminalRunning(task.id);
			isInitialized = true;
		}

		dispatch('ready', { status: initialStatus });

		// Focus the terminal
		terminal.focus();
	});

	onDestroy(() => {
		const viewport = terminalContainer?.querySelector('.xterm-viewport');
		if (viewport) {
			viewport.removeEventListener('scroll', handleViewportScroll);
		}
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
		if (terminal) {
			terminal.dispose();
		}
		// DON'T kill terminal on destroy - just disconnect UI listeners
		// The PTY stays alive for reconnection
		window.electronAPI.removeTerminalListeners(terminalId);
	});

	export function focus() {
		terminal?.focus();
	}
</script>

<div class="terminal-wrapper">
	<div class="terminal-container" bind:this={terminalContainer}></div>
	{#if showScrollButton}
		<button class="scroll-to-bottom" onclick={scrollToBottom}>
			Scroll to bottom
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M8 3V10M8 10L4.5 6.5M8 10L11.5 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M3 13H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			</svg>
		</button>
	{/if}
</div>

<style>
	.terminal-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.terminal-container {
		width: 100%;
		height: 100%;
		background: #1a1a1a;
	}

	.terminal-container :global(.xterm) {
		height: 100%;
		padding: var(--spacing-xs);
	}

	.terminal-container :global(.xterm-viewport) {
		overflow-y: auto;
	}

	.scroll-to-bottom {
		position: absolute;
		bottom: var(--spacing-lg);
		right: var(--spacing-lg);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm2) var(--spacing-lg);
		background: var(--button-primary-bg);
		color: var(--button-primary-text);
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--font-size-md);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast), transform var(--transition-fast);
		z-index: 10;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.scroll-to-bottom:hover {
		background: var(--button-primary-bg-hover);
		transform: translateY(-1px);
	}
</style>
