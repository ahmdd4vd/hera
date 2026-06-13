# Kilo Code — Deep Architecture Analysis

> **Source**: [github.com/Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode)
> **Stars**: 20K+
> **Language**: TypeScript (Bun runtime)
> **License**: Apache 2.0
> **Type**: Monorepo (Turborepo + Bun workspaces)

---

## 1. Architecture Overview

Kilo Code is a monorepo-based AI coding agent with VS Code extension and CLI.

### Monorepo Structure

```
packages/
├── opencode/          — Core CLI (agents, tools, sessions, server, TUI)
├── sdk/js/            — Auto-generated TypeScript SDK
├── kilo-vscode/       — VS Code extension with Agent Manager
├── kilo-gateway/      — Auth, provider routing, API integration
├── kilo-telemetry/    — PostHog analytics + OpenTelemetry
├── kilo-i18n/         — Internationalization
├── kilo-ui/           — SolidJS component library
└── util/              — Shared utilities
```

### Key Products

| Product | Package | Description |
|---------|---------|-------------|
| Kilo CLI | `packages/opencode/` | Core engine. TUI, `kilo run`, `kilo serve` |
| Kilo VS Code | `packages/kilo-vscode/` | VS Code extension with Agent Manager |
| Kilo Gateway | `packages/kilo-gateway/` | Auth and provider routing |

---

## 2. Agent Manager (VS Code Extension)

### Multi-Session Orchestration

The Agent Manager is a feature inside the VS Code extension that enables:
- **Multiple agent sessions** — Run multiple agents in parallel
- **Git worktree isolation** — Each session in its own worktree
- **Session management** — Create, switch, delete sessions
- **Directory context** — Each session has its own working directory

### Architecture

```
VS Code Extension
├── KiloConnectionService (sidebar)
├── KiloConnectionService (editor tab)
├── KiloConnectionService (Agent Manager)
└── Shared kilo serve backend
    └── Directory-keyed InstanceState
```

---

## 3. LLM Package (packages/llm/)

### Core Components

| Component | File | Purpose |
|-----------|------|---------|
| LLM | `llm.ts` | Main LLM interface |
| Provider | `provider.ts` | Provider abstraction |
| Tool | `tool.ts` | Tool definition |
| Tool Runtime | `tool-runtime.ts` | Tool execution |
| Route | `route/` | HTTP/WebSocket routing |
| Cache | `cache-policy.ts` | Caching strategies |
| Schema | `schema/` | Types and validation |

### Provider System

```typescript
interface Provider {
  model: Model
  streamResponse(messages: Message[], tools: Tool[]): AsyncGenerator<ProviderEvent>
}

interface ProviderEvent {
  type: 'content' | 'tool_use' | 'error' | 'complete'
  content?: string
  toolCall?: ToolCall
  error?: Error
}
```

### Tool System

```typescript
interface Tool {
  name: string
  description: string
  parameters: JSONSchema
  execute(input: unknown): Promise<ToolResult>
}

interface ToolResult {
  content: string
  isError: boolean
  metadata?: Record<string, unknown>
}
```

---

## 4. Session Management

### Session Lifecycle

```
1. Create session (with directory context)
2. Load conversation history
3. Process user input
4. Stream LLM response
5. Execute tool calls
6. Save messages
7. Repeat 3-6
```

### Session Isolation

Each session has:
- **Own working directory** — Git worktree or directory
- **Own conversation history** — Messages, tool results
- **Own state** — Config, permissions, context

---

## 5. Gateway (packages/kilo-gateway/)

### Features

- **Auth** — User authentication
- **Provider routing** — Route to different providers
- **API integration** — Connect to various APIs
- **Rate limiting** — Prevent abuse

---

## 6. Key Patterns

### Pattern 1: Monorepo with Turborepo
```
Root
├── turbo.json (build pipeline)
├── packages/
│   ├── opencode/ (core)
│   ├── sdk/ (auto-generated)
│   ├── kilo-vscode/ (extension)
│   └── ...
└── bun.lockb
```

### Pattern 2: Auto-generated SDK
```typescript
// packages/sdk/js/ is auto-generated from server endpoints
// Never edit src/gen/ by hand
// Run ./script/generate.ts to regenerate
```

### Pattern 3: Effect-TS Integration
```typescript
// Use Effect for type-safe error handling
// Don't add Promise facades to shared Effect services
// Use service dependencies or AppRuntime
```

### Pattern 4: Annotation System
```typescript
// Kilo-specific changes in shared opencode files must be annotated
// kilocode_change marker for upstream merge conflicts
// Run script/check-opencode-annotations.ts to verify
```

---

## 7. Build and Dev

```bash
# Dev
bun run dev

# Typecheck
bun turbo typecheck

# Test (from packages/opencode/)
bun test

# Single test
bun test ./test/tool/tool-define.test.ts

# VS Code extension
bun run extension

# SDK regen
./script/generate.ts
```

---

## 8. Lessons for Agent Builders

1. **Monorepo structure** — Separate concerns into packages
2. **Auto-generated SDK** — Keep API and client in sync
3. **Agent Manager** — Multi-session orchestration with worktree isolation
4. **Gateway pattern** — Centralize auth and provider routing
5. **Telemetry** — Track analytics and errors
6. **i18n** — Support multiple languages from the start
7. **Annotation system** — Track changes in shared code
8. **Quality checks** — Lint, typecheck, test before commit

---

*Last updated: 2026-06-13*
*Verified from Kilo Code source code (TypeScript monorepo)*
