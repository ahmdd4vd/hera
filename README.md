<p align="center">
  <img src="assets/hera-logo.jpg" width="240" alt="Hera">
</p>

<h1 align="center">HERA</h1>

<p align="center">
  Complete architecture reference for building production-grade AI coding agents.
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="Version"></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/agents-18+-brightgreen?style=flat-square" alt="Agents"></a>
</p>

---

## What is Hera?

Hera is a technical reference document that explains how [Pi Agent](https://github.com/earendil-works/pi) works internally. Pi is an open-source TypeScript coding agent with 62K stars on GitHub.

Every section in this document is verified against the actual source code. This is not a tutorial or a blog post — it's a breakdown of a real, production-grade agent architecture.

**Use this to:**
- Understand how coding agents work under the hood
- Build your own agent from scratch
- Reference proven patterns for agent design

---

## What's Covered

| # | Section | Content |
|---|---------|---------|
| 1 | Package Structure | 4 packages and how they depend on each other |
| 2 | Core Types | Message, AgentState, AgentTool, AgentEvent definitions |
| 3 | Agent Loop | The main loop that calls LLM and executes tools |
| 4 | Agent Class | Stateful wrapper with message queueing |
| 5 | Agent Harness | Orchestration layer with session, hooks, compaction |
| 6 | Session System | Tree-based conversation storage with branching |
| 7 | Compaction | Auto-summarize old messages to fit context window |
| 8 | Message Conversion | How custom messages become LLM-compatible messages |
| 9 | Tool System | 7 built-in tools (read, write, edit, bash, grep, find, ls) |
| 10 | Extension System | Plugin system with lifecycle hooks and UI primitives |
| 11 | AI Layer | Provider abstraction for 20+ LLM providers |
| 12 | System Prompt | How the system prompt is constructed |
| 13 | Skills & Templates | How skills and prompt templates are loaded |
| 14 | Event Architecture | Full event flow from user input to response |
| 15 | Design Patterns | 8 patterns used throughout the codebase |
| 16 | Implementation Guide | Step-by-step order to build your own agent |
| 17 | Pitfalls | 8 mistakes to avoid |
| 18 | File Reference | Source file locations and line counts |
| 19 | Comparison | How Pi differs from Claude Code, Cursor, Codex, etc. |

---

## Key Architecture Decisions

**Two-loop agent loop:**
The inner loop handles tool calls and mid-run user messages (steering). The outer loop handles follow-up messages that arrive after the agent would normally stop.

**Tree-based sessions:**
Conversations are stored as a tree, not a linear log. This enables branching — you can fork from any point and explore different paths.

**Built-in compaction:**
When the context window gets too long, old messages are automatically summarized by the LLM. Recent messages are kept intact.

**Queue-based steering:**
Users can inject messages while the agent is running without interrupting it. Three queue types: steer (mid-run), follow-up (after stop), and next-turn (prepend to next turn).

**Provider abstraction:**
The same API works for 20+ providers (OpenAI, Anthropic, Google, Bedrock, etc.). Providers register handlers for their API type.

---

## Supported Agents

This reference can be loaded into any of these AI coding agents:

| Agent | Config File |
|---|---|
| Claude Code | `CLAUDE.md` |
| Hermes | `~/.hermes/skills/hera/SKILL.md` |
| OpenCode | `AGENTS.md` |
| Codex | `AGENTS.md` |
| Cursor | `.cursor/rules/hera.mdc` |
| Antigravity | `.agents/rules/hera.md` |
| Pi | `~/.pi/agent/skills/hera/SKILL.md` |
| Gemini CLI | `GEMINI.md` |
| Aider | `AGENTS.md` |
| GitHub Copilot | `~/.copilot/skills/hera/SKILL.md` |
| Amp | `AGENTS.md` |
| Kilo Code | `.kilo/skills/hera/SKILL.md` |
| Kiro | `.kiro/skills/hera/SKILL.md` |
| Devin | `~/.config/devin/skills/hera/SKILL.md` |
| Trae | `AGENTS.md` |
| CodeBuddy | `CODEBUDDY.md` |
| OpenClaw | `AGENTS.md` |
| Factory Droid | `AGENTS.md` |

---

## Installation

```bash
git clone https://github.com/david-aistudio/hera.git
cd hera
./install.sh <agent-name>
```

Available agent names: `claude`, `hermes`, `opencode`, `codex`, `cursor`, `antigravity`, `pi`, `gemini`, `aider`, `copilot`, `amp`, `kilo`, `kiro`, `devin`, `trae`, `codebuddy`, `claw`, `droid`, `all`

---

## How Pi Agent Works (Summary)

```
User Input
  → AgentHarness.prompt()
    → Create turn state (system prompt, tools, messages)
    → Run agent loop:
        → Stream LLM response
        → If response has tool calls:
            → Execute tools (parallel or sequential)
            → Add results to context
            → Loop back to LLM
        → If no tool calls:
            → Check steering queue (mid-run messages)
            → Check follow-up queue (after-stop messages)
            → If queued messages exist, loop back
            → Otherwise, return response
    → Save messages to session
```

---

## Comparison

| Feature | Pi | Claude Code | OpenCode | Cursor | Codex |
|---|---|---|---|---|---|
| Agent loop | Two-loop (steering + follow-up) | Single loop | Single loop | Single loop | Single loop |
| Session storage | Tree-based with branching | Linear | SQLite | Linear | Linear |
| Compaction | Built-in auto-summarize | Manual | Manual | Manual | Manual |
| Extension system | Full plugin (lifecycle hooks, tools, UI) | Hooks only | Plugins | Rules | Rules |
| LLM providers | 20+ native | 1 (Anthropic) | Multi | Multi | 1 (OpenAI) |
| Mid-run injection | Queue-based steering | Not supported | Not supported | Not supported | Not supported |
| Open source | Yes (MIT) | No | Yes (MIT) | No | No |

---

## File Structure

```
hera/
├── SKILL.md                    Main architecture reference (37KB, 19 sections)
├── README.md                   This file
├── AGENTS.md                   Config for OpenCode, Codex, Aider, Amp, etc.
├── CLAUDE.md                   Config for Claude Code
├── install.sh                  Installation script for all agents
├── package.json                npm metadata
├── LICENSE                     MIT License
├── assets/
│   └── hera-logo.jpg           Logo image
├── .cursor/rules/hera.mdc     Cursor config
├── .agents/rules/hera.md      Antigravity config
├── .agents/workflows/hera.md  Antigravity workflow config
└── .kiro/skills/hera/SKILL.md Kiro config
```

---

## Source

All architecture details are verified from:
- **Repository**: [earendil-works/pi](https://github.com/earendil-works/pi)
- **Stars**: 62,000+
- **Language**: TypeScript
- **License**: MIT
- **Version analyzed**: v0.79.2

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built by <a href="https://github.com/david-aistudio">david-aistudio</a>
</p>
