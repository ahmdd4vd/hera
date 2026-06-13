# Spec-Driven Development & Multi-Agent Orchestration

From deep study of GSD Core — a meta-prompting framework with 33 specialized agents.

## Spec-Driven Development Pipeline

```
Requirements → Research → Plans → Execution → Verification

1. REQUIREMENTS: Break down what needs to be built
2. RESEARCH: Explore codebase, find relevant files, understand architecture
3. PLANS: Create step-by-step implementation plan
4. EXECUTION: Implement each step with atomic commits
5. VERIFICATION: Verify against requirements, run tests, check quality
```

**Why it works:** Each phase has a specialized agent. Planning agent doesn't code. Execution agent doesn't plan. Separation improves quality.

## Multi-Agent Orchestration

Spawn specialized agents with fresh context windows:

```typescript
async function orchestrate(task: string) {
  // Phase 1: Research agent explores codebase
  const research = await spawnAgent("researcher", {
    task: `Research: ${task}`,
    tools: ["read_file", "grep", "find"],
  });

  // Phase 2: Planner agent creates plan
  const plan = await spawnAgent("planner", {
    task: `Plan: ${task}`,
    context: research.findings,
    tools: ["read_file"],
  });

  // Phase 3: Executor agent implements
  const result = await spawnAgent("executor", {
    task: `Execute: ${plan.steps}`,
    tools: ["read_file", "write_file", "bash"],
  });

  // Phase 4: Verifier agent checks
  const verification = await spawnAgent("verifier", {
    task: `Verify: ${result.changes}`,
    tools: ["read_file", "bash"],
  });

  return { research, plan, result, verification };
}
```

## Specialized Agent Roles (from GSD's 33 agents)

| Agent | Role | Tools |
|---|---|---|
| Researcher | Explore codebase, find relevant files | read, grep, find |
| Planner | Create step-by-step plan | read |
| Executor | Implement changes | read, write, bash |
| Verifier | Check implementation | read, bash |
| Debugger | Diagnose issues | read, bash, grep |
| Code Reviewer | Review code quality | read |
| Doc Writer | Write documentation | read, write |
| Security Auditor | Check for vulnerabilities | read, grep |

## Context Engineering

Structured artifacts per task:

```markdown
## Task Context

### What we're building
[Description]

### Relevant files
- src/auth/login.ts — Authentication logic
- src/models/user.ts — User model

### Constraints
- Must use existing session system
- Must pass all existing tests

### Acceptance criteria
- [ ] Login works with email/password
- [ ] Session persists across restarts
```

## Hierarchical Skill Routing

Two-stage routing to reduce token cost:

```
Stage 1: Namespace Router (6 entries)
├── gsd-workflow → development workflow skills
├── gsd-project → project management skills
├── gsd-quality → code quality skills
├── gsd-context → context engineering skills
├── gsd-manage → project management skills
└── gsd-ideate → ideation skills

Stage 2: Concrete Skills (61 entries, nested under routers)
├── gsd-workflow/planner → planning skill
├── gsd-workflow/executor → execution skill
├── gsd-quality/code-reviewer → code review skill
└── ...
```

**Why:** Instead of loading 67 skills at once (expensive), load 6 routers, then router loads relevant concrete skill. Saves tokens.

## State Management

Persistent project memory across sessions:

```typescript
interface ProjectState {
  phase: "research" | "planning" | "execution" | "verification";
  completedSteps: string[];
  currentStep: string;
  decisions: Decision[];
  findings: Finding[];
}

function saveState(state: ProjectState): void {
  writeFileSync(".gsd/state.json", JSON.stringify(state, null, 2));
}

function loadState(): ProjectState {
  return JSON.parse(readFileSync(".gsd/state.json", "utf-8"));
}
```
