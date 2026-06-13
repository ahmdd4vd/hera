<p align="center">
  <img src="assets/hera-logo.jpg" width="240" alt="Hera">
</p>

<h1 align="center">HERA</h1>

<p align="center">
  A skill that teaches AI coding agents how to build production-grade coding agents.
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/version-2.2.0-blue?style=flat-square" alt="Version"></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/agents_studied-18-brightgreen?style=flat-square" alt="Agents Studied"></a>
  <a href="#"><img src="https://img.shields.io/badge/sections-33-purple?style=flat-square" alt="Sections"></a>
  <a href="#"><img src="https://img.shields.io/badge/patterns-21-red?style=flat-square" alt="Patterns"></a>
  <a href="#"><img src="https://img.shields.io/badge/templates-12-orange?style=flat-square" alt="Templates"></a>
  <a href="#"><img src="https://img.shields.io/badge/languages-TypeScript%20%7C%20Python-blueviolet?style=flat-square" alt="Languages"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> · <a href="#what-is-hera">What is Hera</a> · <a href="#installation">Install</a> · <a href="#what-you-learn">What You Learn</a> · <a href="#file-structure">Files</a>
</p>

---

## What is Hera

Hera is a **skill** — a knowledge document that AI coding agents (Claude Code, OpenCode, Hermes, Codex, Cursor, etc.) load to understand how to build production-grade coding agents.

When an AI agent loads Hera's SKILL.md, it suddenly knows:
- How coding agents work internally (architecture, patterns, data flow)
- Which patterns work and which don't (from studying 18 real agents)
- How to make agents fast, smart, and not stupid (13 innovation patterns)
- How to handle errors, permissions, sessions, tools, providers
- How to avoid common mistakes (15 anti-patterns with real examples)
- How to integrate tools via MCP, load skills, manage memory, track costs
- How to build production features (plugins, hooks, observability, multi-modal)

**Hera is NOT a framework.** It's NOT a CLI tool. It's NOT a competitor to any agent.

**Hera is KNOWLEDGE** — verified from deep code study of 5 open-source agents and behavioral study of 13 closed-source agents.

---

## Quick Start (30 seconds)

```bash
# 1. Clone
git clone https://github.com/david-aistudio/hera.git && cd hera

# 2. Install for your agent
./install.sh claude        # or hermes, opencode, cursor, etc.

# 3. Your agent now knows how to build coding agents
```

---

## Installation

```bash
git clone https://github.com/david-aistudio/hera.git
cd hera
./install.sh <agent-name>
```

**Supported agents:**

| Agent | Command |
|---|---|
| Claude Code | `./install.sh claude` |
| Hermes | `./install.sh hermes` |
| OpenCode | `./install.sh opencode` |
| Codex | `./install.sh codex` |
| Cursor | `./install.sh cursor` |
| Antigravity | `./install.sh antigravity` |
| Pi | `./install.sh pi` |
| Aider | `./install.sh aider` |
| GitHub Copilot | `./install.sh copilot` |
| Kilo Code | `./install.sh kilo` |
| Kiro | `./install.sh kiro` |
| Devin | `./install.sh devin` |
| Trae | `./install.sh trae` |
| CodeBuddy | `./install.sh codebuddy` |
| OpenClaw | `./install.sh claw` |
| Factory Droid | `./install.sh droid` |
| All agents | `./install.sh all` |

---

## What You Learn

SKILL.md (3100+ lines, 33 sections) teaches everything you need to build a production-grade coding agent:

### Part 1: Fundamentals (from Pi Agent, 62K stars)
- Agent loop architecture (two-loop design)
- Session management (tree-based, branching)
- Tool system (7 built-in tools)
- Extension system (plugins, lifecycle hooks)
- AI layer (provider abstraction, streaming)
- System prompt construction
- Compaction (auto-summarize old messages)
- Event-driven architecture

### Part 2: Multi-Agent Knowledge (from 18 agents)
- Edit formats (Aider): SEARCH/REPLACE, not raw code
- Architect pattern (Aider): cheap model plans, expensive model edits
- Git-native workflow (Aider): auto-commit, reversible changes
- Effect-TS architecture (OpenCode): typed errors, dependency injection
- Agent-harness separation (OpenClaw): pure logic vs orchestration
- Branch compaction (OpenClaw): compact branches independently
- Permission levels (Claude Code): auto/confirm/block per tool
- Scout mode (Kilo Code): explore before editing
- Reference guidance (Kilo Code): context-aware prompts

### Part 3: Decision Framework (15 decision points)
Which pattern to use when, with conditions, justification, risks, and mitigation.

### Part 4: Anti-Patterns (15 patterns)
What NOT to do, with real failure examples and solutions.

### Part 5: Provider System
Multi-provider abstraction, custom endpoints, fallback chain, task-based routing.

### Part 6: Innovation Patterns (13 patterns)
How to make agents fast, smart, and not stupid:
- **Fast:** Streaming, parallel tools, cache warming, lazy loading
- **Smart:** Edit instructions, fuzzy match, architect+editor, linter, scout, references
- **Not stupid:** Self-healing, permissions, branch compaction, typed errors, auto-commit

### Part 7: Advanced Agent Patterns (8 production features)
See `references/advanced-patterns.md` for full details:

| Feature | What It Does | From |
|---|---|---|
| **MCP** | Standard tool integration via JSON-RPC | OpenClaw, Kilo Code |
| **Skills System** | Reusable knowledge documents | OpenClaw, OpenCode |
| **Memory System** | Cross-session persistent memory | OpenClaw (791 files) |
| **Plugin System** | Extend agent without modifying source | OpenClaw (5383 files) |
| **Cost Tracking** | Token counting, budget control | OpenClaw, OpenCode |
| **Observability** | Structured logging, tracing, metrics | OpenClaw, OpenCode |
| **Hooks System** | Lifecycle hooks (before/after LLM, tools) | OpenClaw (1333 files) |
| **Multi-Modal** | Image input (screenshots, designs) | All modern agents |

### Part 8: Production Patterns
- Security patterns (tool sandboxing, permissions, sanitization)
- Error handling (retry, graceful degradation, recovery)
- Testing patterns (unit, integration, E2E)
- Deployment (local, Docker, cloud)
- Streaming patterns (SSE, WebSocket, chunked responses)
- Memory management (token counting, context windows, compression)
- Multi-model routing (fallback chains, cost optimization)

---

## Code Templates

12 copy-paste ready templates (6 TypeScript + 6 Python):

| Template | TypeScript | Python |
|---|---|---|
| Agent Loop | `templates/minimal-agent-loop.ts` | `templates/python/minimal_agent_loop.py` |
| Tool System | `templates/minimal-tool.ts` | `templates/python/minimal_tool.py` |
| Session | `templates/minimal-session.ts` | `templates/python/minimal_session.py` |
| Provider | `templates/minimal-provider.ts` | `templates/python/minimal_provider.py` |
| Harness | `templates/minimal-harness.ts` | `templates/python/minimal_harness.py` |
| Extension | `templates/minimal-extension.ts` | `templates/python/minimal_extension.py` |

---

## Example Agents

Two complete working examples:

- **TypeScript:** `examples/full-agent/` — 20 files, demonstrates all patterns
- **Python:** `examples/python-agent/` — 27 files, 29 tests, multi-provider

---

## Source

Knowledge verified from deep code study of:

| Repository | Stars | Language | Key Patterns Learned |
|---|---|---|---|
| [earendil-works/pi](https://github.com/earendil-works/pi) | 62K | TypeScript | Two-loop, tree sessions, extensions, compaction |
| [paul-gauthier/aider](https://github.com/paul-gauthier/aider) | 30K+ | Python | Edit formats, fuzzy match, linter, git, architect |
| [anomalyco/opencode](https://github.com/anomalyco/opencode) | 20K+ | TypeScript | Effect-TS, permission system, plugins, skills |
| [openclaw/openclaw](https://github.com/openclaw/openclaw) | 378K | TypeScript | Agent-harness, compaction, memory, MCP, hooks |
| [Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode) | 20K+ | TypeScript | Scout mode, reference guidance, MCP |

Plus behavioral study of: Claude Code, Codex, Cursor, GitHub Copilot, Kiro, Devin, Trae, and more.

---

## File Structure

```
hera/
├── SKILL.md                      The skill (33 sections, 3100+ lines)
├── README.md                     This file
├── AGENTS.md                     Root contract (Hera Framework)
├── HERA_FRAMEWORK.md             Structural framework (663 lines)
├── CLAUDE.md                     Claude Code config
├── CHANGELOG.md                  Version history
├── CONTRIBUTING.md               Contribution guide
├── install.sh                    Installation script (18 agents)
├── package.json                  npm metadata
├── LICENSE                       MIT License
├── references/
│   ├── innovation-patterns.md    Innovation patterns (fast, smart, not stupid)
│   └── advanced-patterns.md      Advanced patterns (MCP, skills, memory, plugins, cost, hooks)
├── docs/
│   ├── PATTERNS.md               Production patterns
│   ├── STREAMING.md              Streaming patterns
│   ├── MEMORY.md                 Memory management
│   └── ROUTING.md                Multi-model routing
├── templates/
│   ├── *.ts                      6 TypeScript templates
│   └── python/*.py               6 Python templates
├── cli/
│   ├── hera-init.ts              CLI: project scaffolding
│   └── hera-validate.ts          CLI: validation
├── examples/
│   ├── full-agent/               TypeScript example (20 files)
│   └── python-agent/             Python example (27 files, 29 tests)
└── .github/actions/validate/    CI/CD validation action
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built by <a href="https://github.com/david-aistudio">david-aistudio</a>
</p>
