# CLAUDE.md

## Project Overview

Productmap is a local-first product planning app. Tasks are displayed as draggable/resizable boxes on a 2D canvas. Data stored in markdown and JSON files locally.

## Tech Stack

- SvelteKit
- Electron
- TypeScript
- Vitest (unit/component tests with Playwright)

## Commands

- `npm run dev` - Start dev server
- `npm run dev:electron` - Build and run Electron app
- `npm run build` - Production build
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run check` - TypeScript/Svelte type checking

## Code Structure

```
src/
├── routes/
│   ├── +layout.svelte      # Root layout
│   ├── +layout.ts          # SSR/prerender config
│   └── +page.svelte        # Main app orchestrator
├── lib/
│   ├── components/
│   │   ├── Canvas.svelte     # 2D viewport with pan/zoom, grid, ghost card
│   │   ├── TaskCard.svelte   # Draggable/resizable task box
│   │   ├── GhostCard.svelte  # Preview for new task placement
│   │   ├── Toolbar.svelte    # Project selection/creation header
│   │   ├── Shelf.svelte      # Right sidebar: task editor (metadata, questions, readme)
│   │   ├── Breadcrumb.svelte # Task hierarchy navigation
│   │   └── ColorPicker.svelte
│   ├── stores/
│   │   └── selection.ts    # Selected task store
│   ├── types.ts            # TaskState, TaskMeta, Task, Question, Project, etc.
│   └── constants.ts        # Grid size (20px), card dimensions
├── app.css                 # CSS variables: colors, spacing, typography
└── app.html
electron/
├── main.js                 # Main process: IPC handlers, file ops, chokidar watcher
└── preload.js              # Exposes window.electronAPI bridge
```

## Key Types (src/lib/types.ts)

- `TaskState`: "Unstarted" | "Completed"
- `TaskMeta`: state, color, progress, x, y, width, height, name, description, questions
- `Task`: TaskMeta + id, path, readme (markdown), subtasks (recursive)
- `Question`: id, state (Open/Resolved), question, answer

## Code Style

See [docs/CODE_STYLE.md](docs/CODE_STYLE.md) for full guidelines.

Key points:

- Indent with tabs
- CSS: use grid/flex with gap (no margins on child elements)
- All colors via CSS variables from `src/app.css`
- Use `px` units only

## Other Notes

- the local `cat` command doesn't include `-A` - `usage: cat [-belnstuv] [file ...]`
