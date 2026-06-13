# Claude Code (OpenClaude) — Deep Architecture Analysis

> **Source**: [github.com/Gitlawb/openclaude](https://github.com/Gitlawb/openclaude)
> **Stars**: 211.9K+ (original Claude Code)
> **Language**: TypeScript (Bun runtime)
> **Files**: 2,846 total, 2,091 TypeScript, 1,720 source files
> **License**: Anthropic Commercial (OpenClaude fork: MIT)

---

## 1. Architecture Overview

Claude Code is the most sophisticated AI coding agent ever built. Its architecture is a masterclass in production-grade agent design.

### Core Design Principles
- **Streaming-first**: All tool execution happens during streaming, not after
- **Multi-layer compaction**: 5 different compaction strategies
- **Permission-based security**: Multi-mode permission system
- **Hook-driven extensibility**: Pre/post tool use hooks
- **Provider fallback**: Automatic provider switching on rate limits
- **Token budget management**: Per-turn token budgets with continuation

---

## 2. Query Loop (src/query.ts — 2,240 lines)

The query loop is the heart of Claude Code. It's an async generator that yields stream events.

### Loop Structure

```typescript
export async function* query(params: QueryParams): AsyncGenerator<StreamEvent, Terminal> {
  const consumedCommandUuids: string[] = []
  const terminal = yield* queryLoop(params, consumedCommandUuids)
  // Notify consumed commands
  for (const uuid of consumedCommandUuids) {
    notifyCommandLifecycle(uuid, 'completed')
  }
  return terminal
}

async function* queryLoop(params, consumedCommandUuids): AsyncGenerator<StreamEvent, Terminal> {
  // Immutable params
  const { systemPrompt, userContext, systemContext, canUseTool, fallbackModel, querySource, maxTurns } = params
  
  // Mutable cross-iteration state
  let state: State = {
    messages: params.messages,
    toolUseContext: params.toolUseContext,
    autoCompactTracking: params.autoCompactTracking,
    turnCount: 1,
    continuationNudgeCount: 0,
    // ... 9 more fields
  }
  
  while (true) {
    // 1. Pre-processing pipeline
    // 2. Compaction pipeline
    // 3. API streaming
    // 4. Tool execution
    // 5. Recovery mechanisms
    // 6. Continuation logic
  }
}
```

### Pre-processing Pipeline (per iteration)

```
1. Skill discovery prefetch (async, non-blocking)
2. Tool result budget enforcement
3. Snip compaction (history snipping)
4. Micro-compaction (cache editing)
5. Context collapse (archived message summaries)
6. Conversation arc tracking (knowledge graph)
7. System prompt construction
8. Memory pressure detection
9. Auto-compact threshold check
```

### Compaction Pipeline (5 strategies)

| Strategy | Trigger | How |
|----------|---------|-----|
| **Snip** | Feature flag | Remove old tool results, keep summaries |
| **Micro** | Cache editing | Replace large tool results with placeholders |
| **Context Collapse** | Staged collapses | Archive old messages, inject summaries |
| **Auto-compact** | Token threshold | LLM summarizes old messages |
| **Reactive** | 413 error | Emergency compact on prompt-too-long |

### Recovery Mechanisms

| Recovery | Trigger | Action |
|----------|---------|--------|
| **Model fallback** | FallbackTriggeredError | Switch to fallback model |
| **Provider fallback** | Rate limit (429) | Switch to next provider in chain |
| **Max output tokens** | Token limit hit | Escalate to 64k, then multi-turn recovery |
| **Prompt too long** | 413 error | Context collapse drain → reactive compact |
| **Media size error** | Image too large | Reactive compact (strip images) |
| **Provider max tokens** | Provider cap | Retry with provider-specific cap |
| **Continuation nudge** | No tool calls | Detect intent to continue, inject nudge |

---

## 3. Tool System (50+ tools)

### Tool Categories

**File Operations:**
- `FileReadTool` — Read files with line numbers
- `FileWriteTool` — Write files (create/overwrite)
- `FileEditTool` — Edit files (search/replace)
- `NotebookEditTool` — Edit Jupyter notebooks

**Search:**
- `GrepTool` — Ripgrep-based code search
- `GlobTool` — File pattern matching
- `LSPTool` — Language Server Protocol queries

**Execution:**
- `BashTool` — Shell command execution (with sandbox)
- `PowerShellTool` — PowerShell execution
- `REPLTool` — Interactive REPL

**Agent:**
- `AgentTool` — Spawn subagents
- `TaskCreateTool` — Create background tasks
- `TaskGetTool` — Get task status
- `TaskListTool` — List tasks
- `TaskOutputTool` — Get task output
- `TaskStopTool` — Stop tasks
- `TaskUpdateTool` — Update tasks

**Web:**
- `WebSearchTool` — Web search
- `WebFetchTool` — Fetch web content
- `WebBrowserTool` — Browser automation

**MCP:**
- `MCPTool` — MCP server tools
- `ListMcpResourcesTool` — List MCP resources
- `ReadMcpResourceTool` — Read MCP resources
- `McpAuthTool` — MCP authentication

**Planning:**
- `TodoWriteTool` — Task/todo management
- `EnterPlanModeTool` — Enter planning mode
- `ExitPlanModeTool` — Exit planning mode
- `VerifyPlanExecutionTool` — Verify plan execution

**Communication:**
- `SendMessageTool` — Send messages to users
- `AskUserQuestionTool` — Ask user questions
- `SendUserFileTool` — Send files to users

**Skills:**
- `SkillTool` — Load skills
- `DiscoverSkillsTool` — Discover available skills

**Other:**
- `SleepTool` — Sleep/wait
- `SnipTool` — Snip conversation history
- `MonitorTool` — Monitor processes
- `ConfigTool` — Configuration
- `BriefTool` — Brief mode
- `ScheduleCronTool` — Schedule cron jobs
- `WorkflowTool` — Workflow execution
- `TeamCreateTool` — Create teams
- `TeamDeleteTool` — Delete teams

### BashTool Deep Dive

The BashTool is the most complex tool. It has:

1. **AST-based command parsing** — Parses shell commands into AST
2. **Security validation** — Detects command substitution, dangerous patterns
3. **Path validation** — Validates file paths against permissions
4. **Read-only validation** — Enforces read-only mode
5. **Sandbox support** — Runs commands in sandbox
6. **Destructive command warnings** — Warns about `git reset --hard`, etc.
7. **Permission rules** — Per-command permission checking
8. **Sed validation** — Validates sed commands
9. **Command semantics** — Interprets exit codes (grep: 1=no matches, not error)

```typescript
// Permission checking flow
async function checkBashPermission(input): Promise<PermissionResult> {
  // 1. Parse command into AST
  const ast = tryParseShellCommand(input.command)
  
  // 2. Check for dangerous patterns
  if (hasCommandSubstitution(ast)) return { behavior: 'deny' }
  
  // 3. Check read-only constraints
  if (isReadOnlyMode) return checkReadOnlyConstraints(ast)
  
  // 4. Check path permissions
  const pathResult = validatePaths(ast)
  if (pathResult.behavior !== 'allow') return pathResult
  
  // 5. Check permission rules
  const ruleResult = checkPermissionRules(ast)
  if (ruleResult.behavior !== 'allow') return ruleResult
  
  // 6. Check classifier (AI-based)
  if (isClassifierEnabled) return classifyBashCommand(input)
  
  return { behavior: 'allow' }
}
```

---

## 4. Permission System

### Permission Modes

| Mode | Description | Auto-approve |
|------|-------------|--------------|
| `default` | Ask for each operation | No |
| `plan` | Read-only, no modifications | Read-only only |
| `acceptEdits` | Auto-accept file edits | Edits only |
| `bypassPermissions` | Skip all permissions | Yes |
| `fullAccess` | Full access | Yes |
| `dontAsk` | Don't ask | Yes |
| `auto` | AI classifier decides | Depends |

### Permission Rules

```typescript
type PermissionRule = {
  source: 'user' | 'project' | 'enterprise'
  tool: string
  pattern: string
  action: 'allow' | 'deny' | 'ask'
}
```

### Bash Classifier

When enabled, an AI classifier decides whether to allow bash commands:

```typescript
async function classifyBashCommand(input): Promise<ClassifierResult> {
  // Extract features from command
  const features = extractFeatures(input.command)
  
  // Classify
  const result = await classifier.classify(features)
  
  return {
    behavior: result.confidence > 0.9 ? 'allow' : 'ask',
    reason: result.reason
  }
}
```

---

## 5. Hook System

### Hook Events

| Event | When | Input | Exit Codes |
|-------|------|-------|------------|
| `PreToolUse` | Before tool execution | Tool call JSON | 0=silent, 2=block |
| `PostToolUse` | After tool execution | Tool input + response | 0=transcript, 2=show to model |
| `PostToolUseFailure` | After tool failure | Error details | 0=transcript, 2=show to model |
| `Stop` | When agent stops | Final message | 0=allow, 2=block |
| `SessionStart` | Session start | Session info | 0=continue |
| `Setup` | Initial setup | Config | 0=continue |

### Hook Configuration

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "python3 validate_bash.py",
        "timeout": 5000
      }
    ],
    "PostToolUse": [
      {
        "matcher": "FileEdit",
        "command": "python3 lint_edited.py",
        "timeout": 30000
      }
    ],
    "Stop": [
      {
        "command": "python3 check_quality.py",
        "timeout": 10000
      }
    ]
  }
}
```

### Hook Execution Flow

```
1. Tool call received
2. Find matching PreToolUse hooks
3. Execute hooks (stdin = tool input JSON)
4. Check exit codes:
   - 0: Continue (stdout not shown)
   - 2: Block tool call (stderr shown to model)
   - Other: Continue (stderr shown to user)
5. Execute tool
6. Find matching PostToolUse hooks
7. Execute hooks (stdin = tool input + response)
8. Process results
```

---

## 6. Streaming Tool Execution

Claude Code can execute tools WHILE the model is still streaming:

```typescript
class StreamingToolExecutor {
  private pendingTools: Map<string, ToolExecution> = new Map()
  private completedResults: ToolResult[] = []
  
  addTool(toolBlock: ToolUseBlock, assistantMessage: AssistantMessage) {
    // Start executing tool immediately
    const execution = this.executeTool(toolBlock)
    this.pendingTools.set(toolBlock.id, execution)
  }
  
  getCompletedResults(): ToolResult[] {
    // Return any completed results
    const results = this.completedResults
    this.completedResults = []
    return results
  }
  
  getRemainingResults(): AsyncGenerator<ToolResult> {
    // Wait for all pending tools to complete
    return this.drainPending()
  }
}
```

---

## 7. Subagent System

Claude Code can spawn subagents for parallel work:

```typescript
// AgentTool spawns a subagent
const subagent = await spawnAgent({
  prompt: "Refactor this module",
  context: { files: [...], rules: [...] },
  model: "claude-sonnet-4",
  maxTurns: 10
})

// Subagent runs independently
// Results are streamed back to parent
```

### Agent Scoping

- Main thread: `agentId === undefined`
- Subagents: `agentId === unique-id`
- Each agent only sees its own messages
- Queue is scoped by agentId

---

## 8. Context Management

### Token Budget

```typescript
type TokenBudget = {
  total: number        // Total budget for turn
  remaining: number    // Remaining after compaction
  continuationCount:   // How many times we've continued
}
```

### Message Lifecycle

```
1. User input → UserMessage
2. System prompt → SystemMessage
3. LLM response → AssistantMessage
4. Tool calls → ToolUseBlock[]
5. Tool results → ToolResultBlockParam[]
6. Compaction → SummaryMessage
7. Attachments → AttachmentMessage
```

### Context Collapse

Old messages are archived and replaced with summaries:

```typescript
// Before collapse
[m1, m2, m3, m4, m5, m6, m7, m8, m9, m10]

// After collapse (archive m1-m5)
[summary_of_m1_to_m5, m6, m7, m8, m9, m10]
```

---

## 9. Provider System

### Provider Fallback Chain

```typescript
type ProviderProfile = {
  id: string
  name: string
  model: string
  apiKey: string
  baseUrl: string
}

// On rate limit (429):
// 1. Try next provider in chain
// 2. Update model to match new provider
// 3. Retry request
// 4. If all fail, surface error
```

---

## 10. Key Patterns

### Pattern 1: Async Generator Streaming
```typescript
async function* query(params): AsyncGenerator<StreamEvent> {
  while (true) {
    for await (const message of callModel(...)) {
      yield message  // Stream to UI
    }
    // Process results
    // Continue or break
  }
}
```

### Pattern 2: State Machine Loop
```typescript
let state: State = { ... }
while (true) {
  // Process state
  // Determine next state
  state = { ...next }
  continue  // Loop back
}
```

### Pattern 3: Withheld Errors
```typescript
// Don't surface errors immediately
// Try recovery first
let withheld = false
if (isPromptTooLong(message)) {
  withheld = true  // Try compact first
}
if (!withheld) {
  yield message  // Surface to user
}
```

### Pattern 4: Streaming Tool Execution
```typescript
// Execute tools during streaming, not after
for await (const message of callModel(...)) {
  if (message.type === 'tool_use') {
    streamingToolExecutor.addTool(message)
  }
  // Yield completed results as they finish
  for (const result of streamingToolExecutor.getCompletedResults()) {
    yield result
  }
}
```

### Pattern 5: Multi-layer Recovery
```typescript
// Try multiple recovery strategies
if (isPromptTooLong) {
  // 1. Try context collapse drain
  if (drained) continue
  // 2. Try reactive compact
  if (compacted) continue
  // 3. Surface error
  yield error
}
```

---

## 11. Lessons for Agent Builders

1. **Streaming is essential** — Don't wait for full response before executing tools
2. **Multiple compaction strategies** — One strategy isn't enough
3. **Permission system is critical** — Users need control over what the agent can do
4. **Hooks enable customization** — Let users inject their own logic
5. **Provider fallback is production-ready** — Rate limits happen
6. **Token budget management** — Control costs and prevent runaway usage
7. **Subagent support** — Parallel work is faster
8. **Error recovery is complex** — Plan for every failure mode
9. **AST-based security** — Don't use regex for command parsing
10. **Streaming tool execution** — Execute tools during model streaming

---

*Last updated: 2026-06-13*
*Verified from OpenClaude source code (2,846 files, 2,091 TypeScript)*
