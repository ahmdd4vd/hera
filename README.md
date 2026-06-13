<p align="center">
  <img src="assets/hera-logo.jpg" width="240" alt="Hera">
</p>

<h1 align="center">HERA</h1>

<p align="center">
  A skill that teaches AI coding agents how to build production-grade coding agents.
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/version-2.3.0-blue?style=flat-square" alt="Version"></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/repos_studied-8-brightgreen?style=flat-square" alt="Repos Studied"></a>
  <a href="#"><img src="https://img.shields.io/badge/sections-35-purple?style=flat-square" alt="Sections"></a>
  <a href="#"><img src="https://img.shields.io/badge/patterns-21-red?style=flat-square" alt="Patterns"></a>
  <a href="#"><img src="https://img.shields.io/badge/templates-12-orange?style=flat-square" alt="Templates"></a>
  <a href="#"><img src="https://img.shields.io/badge/token_savings-60_95%25-green?style=flat-square" alt="Token Savings"></a>
  <a href="#"><img src="https://img.shields.io/badge/languages-TypeScript%20%7C%20Python%20%7C%20Rust-blueviolet?style=flat-square" alt="Languages"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> · <a href="#what-is-hera">What is Hera</a> · <a href="#installation">Install</a> · <a href="#what-you-learn">What You Learn</a> · <a href="#source">Source</a>
</p>

---

## What is Hera

Hera is a **skill** — a knowledge document that AI coding agents (Claude Code, OpenCode, Hermes, Codex, Cursor, etc.) load to understand how to build production-grade coding agents.

When an AI agent loads Hera's SKILL.md, it suddenly knows:
- How coding agents work internally (architecture, patterns, data flow)
- Which patterns work and which don't (from studying 8 production agents)
- How to make agents fast, smart, and not stupid (13 innovation patterns)
- How to build with spec-driven development pipeline (from GSD Core)
- How to reduce token costs by 60-95% (from RTK + Headroom)
- How to integrate tools via MCP, load skills, manage memory, track costs
- How to avoid common mistakes (15 anti-patterns with real examples)

**Hera is NOT a framework.** It's NOT a CLI tool. It's NOT a competitor to any agent.

**Hera is KNOWLEDGE** — verified from deep code study of 8 open-source projects.

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

**Supported agents (18):**

| Agent | Command | | Agent | Command |
|---|---|---|---|---|
| Claude Code | `./install.sh claude` | | Kilo Code | `./install.sh kilo` |
| Hermes | `./install.sh hermes` | | Kiro | `./install.sh kiro` |
| OpenCode | `./install.sh opencode` | | Devin | `./install.sh devin` |
| Codex | `./install.sh codex` | | Trae | `./install.sh trae` |
| Cursor | `./install.sh cursor` | | CodeBuddy | `./install.sh codebuddy` |
| Antigravity | `./install.sh antigravity` | | OpenClaw | `./install.sh claw` |
| Pi | `./install.sh pi` | | Factory Droid | `./install.sh droid` |
| Aider | `./install.sh aider` | | All agents | `./install.sh all` |
| GitHub Copilot | `./install.sh copilot` | | | |

---

## What You Learn

SKILL.md (3300+ lines, 35 sections) teaches everything you need to build a production-grade coding agent:

### Part 1: Fundamentals (from Pi Agent, 62K stars)
Agent loop architecture, session management (tree-based, branching), tool system, extension system, AI layer (provider abstraction, streaming), system prompt construction, compaction, event-driven architecture.

### Part 2: Multi-Agent Knowledge (from 18 agents)
Edit formats (Aider), architect pattern (Aider), git-native workflow (Aider), Effect-TS architecture (OpenCode), agent-harness separation (OpenClaw), branch compaction (OpenClaw), permission levels (Claude Code), scout mode (Kilo Code), reference guidance (Kilo Code).

### Part 3: Decision Framework & Anti-Patterns
15 decision points with conditions, justification, risks, mitigation. 15 anti-patterns with real failure examples and solutions.

### Part 4: Provider System
Multi-provider abstraction, custom endpoints (Ollama, vLLM, LiteLLM), provider registry, fallback chain, task-based routing.

### Part 5: Innovation Patterns
How to make agents fast, smart, and not stupid:
- **Fast:** Streaming, parallel tools, cache warming, lazy loading
- **Smart:** Edit instructions, fuzzy match, architect+editor, linter, scout, references
- **Not stupid:** Self-healing, permissions, branch compaction, typed errors, auto-commit

### Part 6: Advanced Agent Patterns

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

### Part 7: Spec-Driven Development (from GSD Core)

```
REQUIREMENTS → RESEARCH → PLANS → EXECUTION → VERIFICATION → UAT
```

Multi-agent orchestration with 6 specialized agents:
- **Planner** (cheap model): Breaks down tasks
- **Researcher** (cheap model): Explores codebase
- **Executor** (expensive model): Implements changes
- **Reviewer** (cheap model): Reviews code quality
- **Debugger** (expensive model): Fixes bugs
- **Verifier** (cheap model): Checks against requirements

### Part 8: Token Optimization (from RTK + Headroom)

**60-95% token reduction** without losing information:

| Strategy | Source | Savings |
|---|---|---|
| Command output filtering | RTK | 60-90% |
| Diff compression | Headroom | 70-90% |
| Search results compression | Headroom | 50-80% |
| Log compression | Headroom | 60-80% |
| Live zone detection | Headroom | 30-50% |
| Adaptive compression | Headroom | Variable |

### Part 9: Production Patterns
Security patterns, error handling, testing patterns, deployment (local, Docker, cloud), streaming patterns, memory management, multi-model routing.

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

Knowledge verified from deep code study of 8 open-source projects:

| Repository | Stars | Language | Key Patterns Learned |
|---|---|---|---|
| [earendil-works/pi](https://github.com/earendil-works/pi) | 62K | TypeScript | Two-loop, tree sessions, extensions, compaction |
| [paul-gauthier/aider](https://github.com/paul-gauthier/aider) | 30K+ | Python | Edit formats, fuzzy match, linter, git, architect |
| [anomalyco/opencode](https://github.com/anomalyco/opencode) | 20K+ | TypeScript | Effect-TS, permission system, plugins, skills |
| [openclaw/openclaw](https://github.com/openclaw/openclaw) | 378K | TypeScript | Agent-harness, compaction, memory, MCP, hooks |
| [Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode) | 20K+ | TypeScript | Scout mode, reference guidance, MCP |
| [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core) | Growing | Markdown | Spec-driven dev, multi-agent orchestration, context engineering |
| [rtk-ai/rtk](https://github.com/rtk-ai/rtk) | Growing | Rust | Token optimization, command filtering, hook interception |
| [chopratejas/headroom](https://github.com/chopratejas/headroom) | Growing | Rust | Context compression, diff/search/log compressors, adaptive sizing |

Plus behavioral study of: Claude Code, Codex, Cursor, GitHub Copilot, Kiro, Devin, Trae, and more.

---

## File Structure

```
hera/
├── SKILL.md                        The skill (35 sections, 3300+ lines)
├── README.md                       This file
├── AGENTS.md                       Root contract (Hera Framework)
├── HERA_FRAMEWORK.md               Structural framework (663 lines)
├── CLAUDE.md                       Claude Code config
├── CHANGELOG.md                    Version history
├── CONTRIBUTING.md                 Contribution guide
├── install.sh                      Installation script (18 agents)
├── package.json                    npm metadata
├── LICENSE                         MIT License
├── references/
│   ├── innovation-patterns.md      Fast, smart, not stupid patterns
│   ├── advanced-patterns.md        MCP, skills, memory, plugins, cost, hooks
│   ├── spec-driven-development.md  Spec-driven pipeline, multi-agent orchestration
│   └── token-optimization.md       Token optimization, context compression
├── docs/
│   ├── PATTERNS.md                 Production patterns
│   ├── STREAMING.md                Streaming patterns
│   ├── MEMORY.md                   Memory management
│   └── ROUTING.md                  Multi-model routing
├── templates/
│   ├── *.ts                        6 TypeScript templates
│   └── python/*.py                 6 Python templates
├── cli/
│   ├── hera-init.ts                CLI: project scaffolding
│   └── hera-validate.ts            CLI: validation
├── examples/
│   ├── full-agent/                 TypeScript example (20 files)
│   └── python-agent/               Python example (27 files, 29 tests)
└── .github/actions/validate/      CI/CD validation action
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built by <a href="https://github.com/david-aistudio">david-aistudio</a>
</p>
