# Productmap

A visual product planning and mapping tool, for humans and agents.

<video src="https://github.com/user-attachments/assets/616001a8-4a6f-4352-84dd-4a6c730cf624" width="600" autoplay loop muted playsinline></video>

## Features

- Zero telemetry.
- Tasks are displayed as draggable, resizable cards on a recursive canvas.
- Tasks can have subtasks, plan documents, open & resolved questions, and its own dedicated Claude Code process.
- The Terminal tab in the Task shelf automatically prompts Claude with context fom the task along with basic instructions for how to use Productmap.
- All data is stored locally as text files in the `your-project/productmap` directory, in a human-readable and agent-readable format.

## Data Structure (on disk)

```
~/.productmap/
└── settings.json        # { projects: [{ name, path }] }
└── tasks/
    └── <task-id>.json   # Task session state

<project-path>/
└── productmap/
    ├── settings.json    # (optional, future use)
    └── tasks/
        └── <task-id>/
            ├── meta.json    # TaskMeta
            ├── README.md    # Plan document
            └── tasks/       # Subtasks (recursive)
                └── <subtask-id>/
                    ├── meta.json
                    ├── README.md
                    └── tasks/
```

## Getting Started

Use the pre-built package [here].

Start from source:

```bash
git clone git@github.com:andrewchilds/Productmap.git
cd Productmap
npm install
npm run dev:electron
```

Hot reloading:

```bash
npm install
npm run dev # terminal 1
npm run dev:electron:hot # terminal 2
```

## Tech Stack

- SvelteKit
- Electron
- TypeScript

## License

MIT
