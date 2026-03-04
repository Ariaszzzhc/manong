<p align="center"><strong>码农 Manong</strong></p>
<p align="center">An AI coding agent that lives in your project.</p>
<p align="center">
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#features">Features</a>
</p>

---

> **Warning:** This project is under rapid development. APIs, tool names, and internal structures may change without notice. **Not recommended for production use.**

<!-- TODO: replace with actual screenshot -->
<!-- ![Manong screenshot](docs/screenshot.png) -->

## What is Manong?

Manong is a native desktop app that gives you an AI coding agent with full access to your project. It reads your files, edits your code, runs your commands, and tracks tasks — all from a single window.

No browser tabs. No copy-paste. Open a folder and start building.

## Features

- **Direct file operations** — The agent reads, writes, searches, and edits files in your workspace. Not suggestions — actual changes.
- **Shell execution** — Run commands, see output, diagnose errors, fix them in the same conversation.
- **Extended thinking** — Watch the agent reason step-by-step before making changes.
- **Tool permissions** — Control what the agent can do. Review file edits with inline diff previews before approving. Choose between default, accept-edits, or full-bypass modes.
- **Image support** — Attach images to your messages for visual context.
- **MCP support** — Plug in any [Model Context Protocol](https://modelcontextprotocol.io) server for extra capabilities. Global + per-project config.
- **Custom skills** — Reusable markdown prompt templates. Drop into `.manong/skills/` or `~/.config/manong/skills/`, trigger with slash commands in the chat input.
- **Rich rendering** — Syntax highlighting, LaTeX math, Mermaid diagrams, inline diffs.
- **Task tracking** — Built-in todo lists for multi-step work.
- **Keyboard shortcuts** — Navigate views, toggle sidebar, manage sessions without touching the mouse.
- **i18n** — English and Chinese UI with automatic locale detection.
- **Workspace-centric** — Sessions, configs, and skills are all scoped to your project directory.

## How is this different?

| | Manong | Browser-based tools | Terminal agents |
|---|---|---|---|
| Runs on | Native desktop app | Browser tab | Terminal |
| File access | Direct, in your workspace | Copy-paste | Direct |
| UI | Full GUI with rich rendering | Web UI | TUI |
| Extensibility | MCP + Skills | Varies | Varies |

Manong combines the power of a terminal agent with the usability of a desktop app.

## Getting Started

```bash
pnpm install && pnpm start
```

Add your API key in **Settings**, open a folder, and start coding.

## License

MIT
