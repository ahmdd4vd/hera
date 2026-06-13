# 🏛 Hera — AI Coding Agent Architecture Reference

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/agents-supported-brightgreen?style=flat-square" alt="Agents">
  <img src="https://img.shields.io/badge/stars-target-62K-yellow?style=flat-square" alt="Stars">
</p>

**Hera** is a complete architectural reference for building **production-grade AI coding agents**. Every detail is verified from the [Pi Agent](https://github.com/earendil-works/pi) source code (62K stars, TypeScript monorepo).

Use this to build your own coding agent, understand how existing agents work internally, or extend them with new capabilities.

---

## 🎯 What's Inside

- **18 sections** covering every aspect of agent architecture
- **Verified from source code** — not guesswork, not documentation
- **Implementation guide** — step-by-step build order
- **Pitfalls & lessons** — avoid common mistakes
- **Multi-agent support** — works with 18+ AI coding agents

---

## 🤖 Supported Agents

Hera works with all major AI coding agents:

| Agent | Config File | Status |
|---|---|---|
| **Claude Code** | `CLAUDE.md` | ✅ |
| **Hermes** | `~/.hermes/skills/hera/` | ✅ |
| **OpenCode** | `AGENTS.md` | ✅ |
| **Codex** | `AGENTS.md` | ✅ |
| **Cursor** | `.cursor/rules/hera.mdc` | ✅ |
| **Antigravity** | `.agents/rules/hera.md` | ✅ |
| **Pi** | `~/.pi/agent/skills/hera/` | ✅ |
| **Gemini** | `GEMINI.md` | ✅ |
| **Aider** | `AGENTS.md` | ✅ |
| **Copilot** | `~/.copilot/skills/hera/` | ✅ |
| **Amp** | `AGENTS.md` | ✅ |
| **Kilo** | `.kilo/skills/hera/` | ✅ |
| **Kiro** | `.kiro/skills/hera/` | ✅ |
| **Devin** | `~/.config/devin/skills/hera/` | ✅ |
| **Trae** | `AGENTS.md` | ✅ |
| **CodeBuddy** | `CODEBUDDY.md` | ✅ |
| **OpenClaw** | `AGENTS.md` | ✅ |
| **Factory Droid** | `AGENTS.md` | ✅ |

---

## 📦 Installation

### Quick Install (Recommended)

```bash
# Clone the repo
git clone https://github.com/david-aistudio/hera.git
cd hera

# Install for your agent
./install.sh <agent-name>
```

### Supported Agent Names

```bash
./install.sh claude      # Claude Code
./install.sh hermes      # Hermes Agent
./install.sh opencode    # OpenCode
./install.sh codex       # Codex
./install.sh cursor      # Cursor
./install.sh antigravity # Google Antigravity
./install.sh pi          # Pi coding agent
./install.sh gemini      # Gemini CLI
./install.sh aider       # Aider
./install.sh copilot     # GitHub Copilot CLI
./install.sh amp         # Amp
./install.sh kilo        # Kilo Code
./install.sh kiro        # Kiro
./install.sh devin       # Devin CLI
./install.sh trae        # Trae
./install.sh codebuddy   # CodeBuddy
./install.sh claw        # OpenClaw
./install.sh droid       # Factory Droid
./install.sh all         # Install for all detected agents
```

### Manual Installation

1. Copy `SKILL.md` to your agent's skill/config directory
2. Copy `AGENTS.md` to your project root (if supported)
3. Copy agent-specific configs (see table above)

---

## 📖 Documentation

### Quick Start

```
Read SKILL.md sections 1-6 for the core architecture.
Read sections 7-13 for advanced features.
Read section 16 for the implementation guide.
```

### Full Table of Contents

1. **Package Structure** — 4 packages, dependency flow
2. **Core Types** — AgentMessage, AgentState, AgentTool, AgentEvent
3. **Agent Loop** — Two-loop design, streaming flow, tool execution
4. **Agent Class** — Stateful wrapper, queueing, lifecycle
5. **Agent Harness** — Orchestration, hooks, turn execution
6. **Session System** — Tree-based storage, branching, context building
7. **Compaction System** — Auto-summarize, settings, flow
8. **Message Conversion** — convertToLlm, custom message types
9. **Tool System** — 7 built-in tools, factory pattern
10. **Extension System** — Full plugin system, UI context, events
11. **AI Layer** — 20+ providers, streaming, EventStream
12. **System Prompt** — Structure, context files, skills injection
13. **Skills & Templates** — Loading, format, invocation
14. **Event-Driven Architecture** — Full event flow diagram
15. **Key Design Patterns** — 8 patterns explained
16. **Implementation Guide** — Step-by-step build order
17. **Pitfalls & Lessons** — 8 critical gotchas
18. **File Reference** — All source files with line counts
19. **Comparison** — Hera vs other agents

---

## 🏗 Architecture Overview

```
User Input
  ↓
AgentHarness.prompt()
  ↓
AgentHarness.executeTurn()
  ↓
runAgentLoop()
  ├── emit: agent_start
  ├── emit: turn_start
  ├── emit: message_start (user message)
  ├── emit: message_end (user message)
  │
  ├── [LLM Call]
  │   ├── emit: message_start (assistant partial)
  │   ├── emit: message_update (text_delta, toolcall_delta, etc.)
  │   └── emit: message_end (assistant final)
  │
  ├── [Tool Execution]
  │   ├── emit: tool_execution_start
  │   ├── emit: tool_execution_update (partial)
  │   ├── emit: tool_execution_end
  │   └── emit: message_end (tool result)
  │
  ├── emit: turn_end
  │
  └── emit: agent_end
```

---

## 🔑 Key Design Patterns

1. **Immutable Snapshots** — Context is sliced/copied before each turn
2. **Queue-Based Steering** — Inject messages without interrupting agent
3. **Tree-Based Sessions** — Not linear log, but tree with branching
4. **Compaction** — Auto-summarize old messages
5. **TypeBox Schemas** — Tool parameters validated via TypeBox
6. **Provider Abstraction** — Same API for 20+ LLM providers
7. **Extension System** — Full plugin system with lifecycle hooks
8. **Declaration Merging** — Custom message types via TypeScript

---

## 🆚 Comparison

| Feature | Hera (Pi) | Claude Code | OpenCode | Cursor | Codex |
|---|---|---|---|---|---|
| **Agent Loop** | Two-loop | Single loop | Single loop | Single loop | Single loop |
| **Session** | Tree-based | Linear | SQLite | Linear | Linear |
| **Compaction** | Built-in | Manual | Manual | Manual | Manual |
| **Extensions** | Full plugin | Hooks | Plugins | Rules | Rules |
| **Providers** | 20+ | 1 | Multi | Multi | 1 |
| **Steering** | Queue-based | ❌ | ❌ | ❌ | ❌ |
| **Open Source** | ✅ MIT | ❌ | ✅ MIT | ❌ | ❌ |

---

## 📊 Stats

- **18 sections** of architecture documentation
- **5000+ lines** of verified technical content
- **20+ LLM providers** supported
- **18 AI agents** supported
- **8 design patterns** documented
- **8 pitfalls** identified and explained

---

## 🤝 Contributing

Contributions welcome! Please read the [CONTRIBUTING.md](CONTRIBUTING.md) first.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Pi Agent](https://github.com/earendil-works/pi) — Architecture reference (62K stars)
- [Graphify](https://github.com/safishamsi/graphify) — Code analysis tool
- All AI coding agents that inspired this project

---

## ⭐ Star History

If you find Hera useful, please star this repo! It helps others discover it.

---

<p align="center">
  <b>Built with ❤️ by <a href="https://github.com/david-aistudio">david-aistudio</a></b>
</p>
