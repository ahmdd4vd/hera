# ECC Patterns — Agent Harness Operating System

Patterns extracted from ECC (Everything Claude Code) — 211.9K stars, 64 specialized agents, 262 skills, 84 commands. The most comprehensive agent harness system.

---

## Agent Harness Construction

How to design agent action spaces, observation formats, and error recovery.

### Core Model

Agent output quality is constrained by 4 factors:

```
1. Action Space Quality — What tools does the agent have?
2. Observation Quality — What does the agent see after each action?
3. Recovery Quality — How does the agent recover from errors?
4. Context Budget Quality — How is context window managed?
```

### Action Space Design

```markdown
## Rules for Tool Design

1. Use stable, explicit tool names
2. Keep inputs schema-first and narrow
3. Return deterministic output shapes
4. Avoid catch-all tools unless isolation is impossible

## Granularity Rules

- **Micro-tools**: High-risk operations (deploy, migration, permissions)
- **Medium tools**: Common edit/read/search loops
- **Macro-tools**: Only when round-trip overhead is dominant cost
```

### Observation Design

Every tool response should include:

```typescript
interface ToolResponse {
  status: "success" | "warning" | "error";
  summary: string;           // One-line result
  next_actions: string[];    // Actionable follow-ups
  artifacts: string[];       // File paths / IDs
  error?: {
    root_cause: string;      // Why it failed
    retry_instruction: string; // How to retry safely
    stop_condition: string;   // When to stop retrying
  };
}
```

### Error Recovery Contract

For every error path, include:
- **Root cause hint**: Why did it fail?
- **Safe retry instruction**: How to retry without making it worse
- **Explicit stop condition**: When to give up and ask for help

```typescript
// Good error response
{
  status: "error",
  summary: "Failed to write file: permission denied",
  error: {
    root_cause: "File /etc/config.yml is owned by root",
    retry_instruction: "Use sudo or change file ownership first",
    stop_condition: "If user doesn't have sudo access, stop and explain"
  },
  next_actions: [
    "Try: sudo chmod 666 /etc/config.yml",
    "Or: write to ~/config.yml instead"
  ]
}
```

### Context Budgeting

```markdown
1. Keep system prompt minimal and invariant
2. Move large guidance into skills loaded on demand
3. Prefer references to files over inlining long documents
4. Compact at phase boundaries, not arbitrary token thresholds
```

### Architecture Pattern Guidance

```
ReAct: Best for exploratory tasks with uncertain path
Function-calling: Best for structured deterministic flows
Hybrid (recommended): ReAct planning + typed tool execution
```

### Benchmarking

Track these metrics:
- **Completion rate**: % of tasks completed successfully
- **Retries per task**: How many attempts before success
- **pass@1**: First attempt success rate
- **pass@3**: Success within 3 attempts
- **Cost per successful task**: Total cost / successful tasks

---

## Specialized Agent Architecture

ECC has 64 specialized agents. Key patterns for organizing agents:

### Agent Categories

```
Planning Agents:
├── planner — Implementation planning
├── architect — System design and scalability
└── chief-of-staff — High-level coordination

Quality Agents:
├── code-reviewer — Code quality and maintainability
├── security-reviewer — Vulnerability detection
├── tdd-guide — Test-driven development
└── database-reviewer — PostgreSQL/Supabase specialist

Language-Specific Agents:
├── python-reviewer — Python code review
├── typescript-reviewer — TypeScript/JavaScript review
├── go-reviewer — Go code review
├── rust-reviewer — Rust code review
├── java-reviewer — Java/Spring Boot review
├── cpp-reviewer — C/C++ review
└── [12+ more languages]

Build Agents:
├── build-error-resolver — Fix build/type errors
├── go-build-resolver — Go build errors
├── rust-build-resolver — Rust build errors
└── [per-language build resolvers]

Testing Agents:
├── e2e-runner — End-to-end Playwright testing
├── tdd-guide — Test-driven development workflow
└── benchmark — Performance benchmarking

Autonomous Agents:
├── loop-operator — Autonomous loop execution
├── harness-optimizer — Harness config tuning
└── doc-updater — Documentation updates
```

### Agent Orchestration Rules

```markdown
Use agents proactively without user prompt:
- Complex feature requests → planner
- Code just written/modified → code-reviewer
- Bug fix or new feature → tdd-guide
- Architectural decision → architect
- Security-sensitive code → security-reviewer
- Autonomous loops → loop-operator
- Harness config → harness-optimizer

Use parallel execution for independent operations.
```

---

## Autonomous Loop Patterns

6 loop patterns from simple to sophisticated:

### Pattern 1: Sequential Pipeline

```bash
# Simplest: chain commands
claude -p "Step 1: analyze the codebase"
claude -p "Step 2: plan the changes"
claude -p "Step 3: implement the changes"
claude -p "Step 4: write tests"
```

### Pattern 2: Infinite Agentic Loop

```bash
# Run agent in a loop until task is done
while true; do
  result=$(claude -p "Continue working on: $TASK")
  if echo "$result" | grep -q "DONE"; then
    break
  fi
done
```

### Pattern 3: Continuous PR Loop

```bash
# Multi-day iterative project with CI gates
while true; do
  claude -p "Continue implementing: $FEATURE"
  git push
  # Wait for CI
  if ci_passes; then
    gh pr create
    break
  else
    claude -p "Fix CI failures: $(ci_errors)"
  fi
done
```

### Pattern 4: De-Sloppify Pattern

```bash
# Quality cleanup after implementation
claude -p "Implement: $FEATURE"
claude -p "Review and clean up the code you just wrote. Fix:
- Lint errors
- Type errors
- Missing tests
- Code duplication
- Poor naming"
```

### Pattern 5: Multi-Agent DAG

```bash
# Parallel agents with merge coordination
agent1=$(claude -p "Research: $TOPIC" &)
agent2=$(claude -p "Analyze codebase: $PATH" &)
agent3=$(claude -p "Check security: $PATH" &)
wait

# Merge results
claude -p "Based on research: $agent1
Codebase analysis: $agent2
Security check: $agent3
Create implementation plan."
```

### Pattern 6: RFC-Driven Orchestration

```bash
# Write RFC → Get approval → Implement → Verify
claude -p "Write RFC for: $FEATURE" > rfc.md
# Human reviews rfc.md
claude -p "Implement RFC: $(cat rfc.md)"
claude -p "Verify implementation matches RFC: $(cat rfc.md)"
```

---

## Agent Introspection (Self-Debugging)

When an agent fails repeatedly, it should debug itself before escalating.

### When to Activate

- Maximum tool call / loop-limit failures
- Repeated retries with no forward progress
- Context growth degrading output quality
- File-system or environment state mismatch
- Tool failures that are likely recoverable

### Self-Debugging Workflow

```markdown
## Step 1: Capture State
- What was the original task?
- What tools were called?
- What errors occurred?
- What was the last successful step?

## Step 2: Diagnose
- Is it a tool failure or logic failure?
- Is the agent stuck in a loop?
- Is context window full?
- Is the environment in unexpected state?

## Step 3: Contained Recovery
- Try a different approach
- Reduce scope (simpler task)
- Switch model (upgrade capability)
- Clear context and restart

## Step 4: Escalate
- If self-debugging fails, produce structured report
- Include: task, attempts, errors, diagnosis, suggested fix
```

---

## Hooks System

Event-driven automations that fire before or after tool executions.

### Hook Types

```
PreToolUse:   Runs BEFORE tool executes. Can BLOCK (exit 2) or WARN (stderr).
PostToolUse:  Runs AFTER tool completes. Can analyze but not block.
Stop:         Runs after each agent response.
SessionStart: Runs at session start.
SessionEnd:   Runs at session end.
PreCompact:   Runs before context compaction. Save state here.
```

### Hook Flow

```
User request → Agent picks tool → PreToolUse hook → Tool executes → PostToolUse hook
```

### Hook Examples

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "bash",
        "command": "check-dangerous-commands.sh",
        "description": "Block dangerous bash commands"
      },
      {
        "matcher": "write_file",
        "command": "check-file-permissions.sh",
        "description": "Check file write permissions"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "write_file",
        "command": "auto-lint.sh",
        "description": "Auto-lint after file write"
      },
      {
        "matcher": "bash",
        "command": "log-command.sh",
        "description": "Log all bash commands"
      }
    ],
    "PreCompact": [
      {
        "command": "save-state.sh",
        "description": "Save state before compaction"
      }
    ]
  }
}
```

---

## Rules Per Language

ECC has rules for 18+ languages. Pattern for organizing language-specific rules:

```
rules/
├── common/
│   └── principles.md        — Universal rules (all languages)
├── python/
│   └── style.md             — Python-specific rules
├── typescript/
│   └── style.md             — TypeScript-specific rules
├── go/
│   └── style.md             — Go-specific rules
├── rust/
│   └── style.md             — Rust-specific rules
└── [15+ more languages]
```

### Common Principles (All Languages)

```markdown
1. Immutability — Always create new objects, never mutate
2. Small functions — <50 lines per function
3. Small files — <800 lines per file
4. No deep nesting — Max 4 levels
5. Proper error handling — Never silently swallow errors
6. Input validation — Validate at system boundaries
7. No hardcoded values — Use constants or config
8. Readable names — Self-documenting identifiers
```

---

## Decision Matrix

```
Q: Building an agent system?
├── Need specialized agents? → 64-agent pattern (ECC)
├── Need autonomous loops? → 6 loop patterns (ECC)
├── Need self-debugging? → Agent introspection (ECC)
├── Need quality hooks? → PreToolUse/PostToolUse (ECC)
├── Need language rules? → Per-language rules (ECC)
└── Need benchmarking? → Track completion rate, pass@1, cost
```
