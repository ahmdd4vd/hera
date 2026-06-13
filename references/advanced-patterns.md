# Advanced Agent Patterns

Patterns for production-grade AI coding agents. Extracted from deep code study of OpenClaw (378K stars), OpenCode (20K+), Kilo Code (20K+), and Aider (30K+).

---

## 1. MCP (Model Context Protocol)

MCP is the standard way to add tools to agents. Instead of building tools into the agent, you connect to MCP servers.

### What is MCP

```
Traditional: Agent → built-in tools (hardcoded)
MCP: Agent → MCP client → MCP server → tools (dynamic)

MCP Server = a process that exposes tools via JSON-RPC
MCP Client = code in the agent that connects to MCP servers
```

### Why MCP Matters

- **Tool sharing**: One MCP server works with ALL agents
- **Community tools**: Anyone can build an MCP server
- **No rewrite**: Add tools without changing agent code
- **Standard protocol**: JSON-RPC over stdio or HTTP

### MCP Server Types

```typescript
// 1. stdio server (runs as subprocess)
const stdioServer = {
  name: "filesystem",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
};

// 2. HTTP server (runs remotely)
const httpServer = {
  name: "remote-tools",
  url: "https://mcp.example.com/sse",
  headers: { "Authorization": "Bearer token" },
};
```

### MCP Client Implementation

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

class MCPManager {
  private clients: Map<string, Client> = new Map();

  async connect(config: MCPServerConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
    });

    const client = new Client(
      { name: "my-agent", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    this.clients.set(config.name, client);
  }

  async listTools(): Promise<Tool[]> {
    const tools: Tool[] = [];
    for (const [serverName, client] of this.clients) {
      const result = await client.listTools();
      for (const tool of result.tools) {
        tools.push({
          name: `${serverName}_${tool.name}`,
          description: tool.description,
          parameters: tool.inputSchema,
          server: serverName,
        });
      }
    }
    return tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const [serverName, toolName] = name.split("_", 2);
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`MCP server not found: ${serverName}`);

    const result = await client.callTool({ name: toolName, arguments: args });
    return result.content.map(c => c.text).join("\n");
  }
}
```

### MCP Configuration

```yaml
# mcp-servers.yaml
servers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    
  git:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-git"]
    
  sqlite:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-sqlite", "db.sqlite"]
    
  brave-search:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-brave-search"]
    env:
      BRAVE_API_KEY: ${BRAVE_API_KEY}
```

### Popular MCP Servers

| Server | Tools | Use Case |
|--------|-------|----------|
| filesystem | read, write, edit, list | File operations |
| git | commit, diff, log, branch | Git operations |
| sqlite | query, insert, update | Database |
| brave-search | search | Web search |
| puppeteer | navigate, screenshot | Browser automation |
| github | issues, prs, repos | GitHub API |
| slack | messages, channels | Slack integration |

---

## 2. Skills System

Skills are reusable knowledge documents that teach the agent how to do specific tasks.

### What is a Skill

```
Skill = markdown file with frontmatter that the agent loads when relevant

Structure:
├── name: skill name
├── description: what the skill does
├── triggers: when to load the skill
└── content: the actual knowledge
```

### Skill Format

```markdown
---
name: my-skill
description: "Description of what this skill does"
triggers:
  - "when user asks about X"
  - "when working with Y"
---

# My Skill

## How to Do X

Step 1: ...
Step 2: ...

## Common Mistakes

- Don't do A
- Always do B
```

### Skill Loading

```typescript
interface Skill {
  name: string;
  description: string;
  content: string;
  filePath: string;
  triggers?: string[];
  metadata?: Record<string, unknown>;
}

class SkillManager {
  private skills: Skill[] = [];

  async loadFromDirectory(dir: string): Promise<void> {
    const files = await glob("**/SKILL.md", { cwd: dir });
    for (const file of files) {
      const content = await readFile(path.join(dir, file));
      const { data, content: body } = parseFrontmatter(content);
      this.skills.push({
        name: data.name || path.basename(path.dirname(file)),
        description: data.description || "",
        content: body,
        filePath: path.join(dir, file),
        triggers: data.triggers,
      });
    }
  }

  findRelevant(task: string): Skill[] {
    return this.skills.filter(skill => {
      // Check if task matches skill description or triggers
      return skill.triggers?.some(t => task.includes(t)) ||
             task.toLowerCase().includes(skill.name.toLowerCase());
    });
  }

  formatForPrompt(skill: Skill): string {
    return `<skill name="${skill.name}">\n${skill.content}\n</skill>`;
  }
}
```

### Skill Invocation

```typescript
// When agent receives a task, find and load relevant skills
async function buildContextWithSkills(task: string, skills: SkillManager) {
  const relevant = skills.findRelevant(task);
  
  let context = systemPrompt;
  for (const skill of relevant) {
    context += "\n\n" + skills.formatForPrompt(skill);
  }
  
  return context;
}
```

---

## 3. Memory System (Cross-Session)

Memory lets the agent remember things across sessions.

### Memory Types

```
Short-term: Current conversation (session)
Long-term: Persistent facts, preferences, decisions (cross-session)
Working: Current task context (temporary)
```

### Memory Implementation

```typescript
interface MemoryEntry {
  id: string;
  content: string;
  category: string;  // "preference", "fact", "decision", "convention"
  timestamp: number;
  sessionId: string;
  relevance: number;  // 0-1, how relevant to current task
  source: string;     // where this memory came from
}

class MemoryStore {
  private entries: MemoryEntry[] = [];
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
    this.load();
  }

  remember(content: string, category: string, source: string): void {
    this.entries.push({
      id: generateId(),
      content,
      category,
      timestamp: Date.now(),
      sessionId: currentSessionId(),
      relevance: 1.0,
      source,
    });
    this.save();
  }

  recall(query: string, limit: number = 10): MemoryEntry[] {
    // Simple keyword matching (upgrade to embeddings for production)
    const queryWords = query.toLowerCase().split(/\s+/);
    
    return this.entries
      .map(entry => ({
        ...entry,
        relevance: this.calculateRelevance(entry, queryWords),
      }))
      .filter(entry => entry.relevance > 0.1)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  private calculateRelevance(entry: MemoryEntry, queryWords: string[]): number {
    const entryWords = entry.content.toLowerCase().split(/\s+/);
    const matches = queryWords.filter(w => entryWords.some(e => e.includes(w)));
    return matches.length / queryWords.length;
  }

  private load(): void {
    try {
      const data = fs.readFileSync(this.storagePath, "utf-8");
      this.entries = JSON.parse(data);
    } catch {
      this.entries = [];
    }
  }

  private save(): void {
    fs.writeFileSync(this.storagePath, JSON.stringify(this.entries, null, 2));
  }
}
```

### Memory Injection

```typescript
// Inject relevant memories into agent context
function buildContextWithMemory(
  task: string,
  systemPrompt: string,
  memory: MemoryStore
): string {
  const relevant = memory.recall(task);
  
  if (relevant.length === 0) return systemPrompt;
  
  const memorySection = relevant
    .map(m => `- [${m.category}] ${m.content}`)
    .join("\n");
  
  return `${systemPrompt}\n\nRelevant memories:\n${memorySection}`;
}
```

### Automatic Memory Extraction

```typescript
// Extract memories from conversation
async function extractMemories(
  messages: Message[],
  memory: MemoryStore
): Promise<void> {
  const lastUserMessage = messages.filter(m => m.role === "user").pop();
  if (!lastUserMessage) return;

  // Detect preferences
  const preferencePatterns = [
    /don'?t use (\w+)/i,
    /prefer (\w+)/i,
    /always use (\w+)/i,
    /never (\w+)/i,
  ];

  for (const pattern of preferencePatterns) {
    const match = lastUserMessage.content.match(pattern);
    if (match) {
      memory.remember(match[0], "preference", "user-statement");
    }
  }
}
```

---

## 4. Plugin System

Plugins extend the agent without modifying source code.

### Plugin Interface

```typescript
interface Plugin {
  name: string;
  version: string;
  description: string;

  // Lifecycle hooks
  onInit?(agent: AgentContext): Promise<void>;
  onBeforeTool?(tool: string, args: unknown): Promise<ToolCallResult | null>;
  onAfterTool?(tool: string, args: unknown, result: ToolCallResult): Promise<void>;
  onBeforeLLM?(messages: Message[]): Promise<Message[]>;
  onAfterLLM?(response: LLMResponse): Promise<LLMResponse>;
  onError?(error: Error): Promise<void>;

  // Extensions
  tools?: Tool[];
  providers?: Provider[];
  prompts?: PromptTemplate[];
}
```

### Plugin Manager

```typescript
class PluginManager {
  private plugins: Plugin[] = [];

  async register(plugin: Plugin): Promise<void> {
    if (plugin.onInit) {
      await plugin.onInit(this.agentContext);
    }
    this.plugins.push(plugin);
  }

  async executeHook(hook: string, ...args: unknown[]): Promise<unknown> {
    for (const plugin of this.plugins) {
      const handler = plugin[hook as keyof Plugin];
      if (typeof handler === "function") {
        const result = await (handler as Function).call(plugin, ...args);
        if (result !== null && result !== undefined) {
          return result;  // Plugin wants to modify behavior
        }
      }
    }
    return null;
  }

  getAllTools(): Tool[] {
    return this.plugins.flatMap(p => p.tools || []);
  }

  getAllProviders(): Provider[] {
    return this.plugins.flatMap(p => p.providers || []);
  }
}
```

### Plugin Example

```typescript
const gitPlugin: Plugin = {
  name: "git",
  version: "1.0.0",
  description: "Git integration tools",

  tools: [
    {
      name: "git_commit",
      description: "Commit changes",
      parameters: { message: { type: "string", required: true } },
      execute: async (args) => {
        await exec(`git add -A && git commit -m "${args.message}"`);
        return "Committed successfully";
      },
    },
    {
      name: "git_diff",
      description: "Show changes",
      execute: async () => exec("git diff"),
    },
  ],

  onAfterTool: async (tool, args, result) => {
    if (tool === "write_file") {
      await exec(`git add ${(args as any).path}`);
    }
  },
};
```

---

## 5. Cost Tracking

Track LLM usage and costs in production.

### Cost Tracker

```typescript
interface UsageRecord {
  timestamp: number;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  task: string;
  durationMs: number;
}

class CostTracker {
  private records: UsageRecord[] = [];
  private budget: number;

  constructor(dailyBudgetUsd: number) {
    this.budget = dailyBudgetUsd;
  }

  record(usage: UsageRecord): void {
    this.records.push(usage);
  }

  getDailyCost(): number {
    const today = new Date().toDateString();
    return this.records
      .filter(r => new Date(r.timestamp).toDateString() === today)
      .reduce((sum, r) => sum + r.costUsd, 0);
  }

  isOverBudget(): boolean {
    return this.getDailyCost() > this.budget;
  }

  getSummary(): CostSummary {
    const total = this.records.reduce((sum, r) => sum + r.costUsd, 0);
    const byModel = groupBy(this.records, "model");
    const byTask = groupBy(this.records, "task");

    return {
      totalCostUsd: total,
      dailyCostUsd: this.getDailyCost(),
      totalCalls: this.records.length,
      avgCostPerCall: total / this.records.length,
      byModel: Object.fromEntries(
        Object.entries(byModel).map(([k, v]) => [
          k,
          { calls: v.length, cost: v.reduce((s, r) => s + r.costUsd, 0) },
        ])
      ),
      byTask: Object.fromEntries(
        Object.entries(byTask).map(([k, v]) => [
          k,
          { calls: v.length, cost: v.reduce((s, r) => s + r.costUsd, 0) },
        ])
      ),
    };
  }

  formatSummary(): string {
    const s = this.getSummary();
    return [
      `Total: $${s.totalCostUsd.toFixed(4)}`,
      `Today: $${s.dailyCostUsd.toFixed(4)} / $${this.budget}`,
      `Calls: ${s.totalCalls}`,
      `Avg: $${s.avgCostPerCall.toFixed(4)}/call`,
    ].join("\n");
  }
}
```

### Model Pricing

```typescript
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "claude-sonnet-4": { input: 0.003, output: 0.015 },
  "claude-haiku": { input: 0.00025, output: 0.00125 },
  "gemini-2.0-flash": { input: 0.0001, output: 0.0004 },
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (inputTokens / 1000) * pricing.input +
         (outputTokens / 1000) * pricing.output;
}
```

---

## 6. Observability (Tracing + Metrics)

Monitor agent behavior in production.

### Structured Logger

```typescript
interface LogEntry {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  event: string;
  data: Record<string, unknown>;
  sessionId: string;
  duration?: number;
}

class AgentLogger {
  private logs: LogEntry[] = [];

  log(level: LogEntry["level"], event: string, data: Record<string, unknown> = {}): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      event,
      data,
      sessionId: currentSessionId(),
    };
    this.logs.push(entry);
    console.log(JSON.stringify(entry));
  }

  debug(event: string, data?: Record<string, unknown>): void {
    this.log("debug", event, data);
  }

  info(event: string, data?: Record<string, unknown>): void {
    this.log("info", event, data);
  }

  warn(event: string, data?: Record<string, unknown>): void {
    this.log("warn", event, data);
  }

  error(event: string, data?: Record<string, unknown>): void {
    this.log("error", event, data);
  }

  // Convenience methods
  llmCall(model: string, tokens: number, durationMs: number): void {
    this.info("llm_call", { model, tokens, durationMs });
  }

  toolCall(tool: string, args: unknown, durationMs: number, success: boolean): void {
    this.info("tool_call", { tool, args, durationMs, success });
  }

  agentError(error: string, context?: Record<string, unknown>): void {
    this.error("agent_error", { error, ...context });
  }
}
```

### Trace Context

```typescript
interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, unknown>;
}

class Tracer {
  private traces: Map<string, TraceContext> = new Map();

  startSpan(operation: string, parentSpanId?: string): TraceContext {
    const span: TraceContext = {
      traceId: parentSpanId ? this.traces.get(parentSpanId)?.traceId || generateId() : generateId(),
      spanId: generateId(),
      parentSpanId,
      operation,
      startTime: Date.now(),
      attributes: {},
    };
    this.traces.set(span.spanId, span);
    return span;
  }

  endSpan(spanId: string): void {
    const span = this.traces.get(spanId);
    if (span) {
      span.endTime = Date.now();
    }
  }

  addAttribute(spanId: string, key: string, value: unknown): void {
    const span = this.traces.get(spanId);
    if (span) {
      span.attributes[key] = value;
    }
  }
}
```

---

## 7. Hooks System

Lifecycle hooks that trigger on events.

### Hook Types

```typescript
enum HookPoint {
  BEFORE_LLM = "before_llm",         // Before calling LLM
  AFTER_LLM = "after_llm",           // After LLM response
  BEFORE_TOOL = "before_tool",       // Before tool execution
  AFTER_TOOL = "after_tool",         // After tool execution
  ON_ERROR = "on_error",             // On error
  ON_START = "on_start",             // Agent session start
  ON_STOP = "on_stop",               // Agent session end
  ON_MESSAGE = "on_message",         // New user message
  ON_COMPACT = "on_compact",         // Before compaction
  ON_COMMIT = "on_commit",           // After git commit
}
```

### Hook Manager

```typescript
interface Hook {
  point: HookPoint;
  handler: (context: HookContext) => Promise<HookResult>;
  priority: number;  // Lower = runs first
}

class HookManager {
  private hooks: Map<HookPoint, Hook[]> = new Map();

  register(hook: Hook): void {
    const hooks = this.getHooks(hook.point);
    hooks.push(hook);
    hooks.sort((a, b) => a.priority - b.priority);
  }

  getHooks(point: HookPoint): Hook[] {
    if (!this.hooks.has(point)) {
      this.hooks.set(point, []);
    }
    return this.hooks.get(point)!;
  }

  async execute(point: HookPoint, context: HookContext): Promise<HookResult> {
    const hooks = this.getHooks(point);
    for (const hook of hooks) {
      const result = await hook.handler(context);
      if (result.stop) return result;  // Stop processing
    }
    return { continue: true };
  }
}
```

### Hook Examples

```typescript
// Auto-lint after file write
hooks.register({
  point: HookPoint.AFTER_TOOL,
  priority: 10,
  handler: async (ctx) => {
    if (ctx.toolName === "write_file") {
      const errors = await lint(ctx.args.path);
      if (errors.length > 0) {
        return { continue: false, error: `Lint errors: ${errors.join(", ")}` };
      }
    }
    return { continue: true };
  },
});

// Auto-commit after successful edit
hooks.register({
  point: HookPoint.AFTER_TOOL,
  priority: 20,
  handler: async (ctx) => {
    if (ctx.toolName === "write_file" && ctx.result.success) {
      await exec(`git add ${ctx.args.path}`);
      await exec(`git commit -m "Auto: edit ${ctx.args.path}"`);
    }
    return { continue: true };
  },
});

// Permission check before dangerous commands
hooks.register({
  point: HookPoint.BEFORE_TOOL,
  priority: 1,
  handler: async (ctx) => {
    if (ctx.toolName === "bash") {
      const dangerous = ["rm -rf", "mkfs", "dd if="];
      for (const pattern of dangerous) {
        if (ctx.args.command.includes(pattern)) {
          return { continue: false, error: `Blocked: ${pattern}` };
        }
      }
    }
    return { continue: true };
  },
});
```

---

## 8. Multi-Modal Support

Handle images, not just text.

### Image Content Type

```typescript
interface ImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    data: string;
  };
}

interface TextContent {
  type: "text";
  text: string;
}

type Content = TextContent | ImageContent;
```

### Image Processing

```typescript
class ImageProcessor {
  async fromFile(filePath: string): Promise<ImageContent> {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mediaType = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
    }[ext] || "image/png";

    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType as ImageContent["source"]["media_type"],
        data: data.toString("base64"),
      },
    };
  }

  async fromUrl(url: string): Promise<ImageContent> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/png";

    return {
      type: "image",
      source: {
        type: "base64",
        media_type: contentType as ImageContent["source"]["media_type"],
        data: Buffer.from(buffer).toString("base64"),
      },
    };
  }

  async fromScreenshot(): Promise<ImageContent> {
    // Take screenshot of current screen
    const screenshot = await takeScreenshot();
    return this.fromFile(screenshot);
  }
}
```

### Multi-Modal Message

```typescript
// Build message with text + images
function buildMultiModalMessage(
  text: string,
  images: ImageContent[]
): Message {
  const content: Content[] = [
    { type: "text", text },
    ...images,
  ];

  return {
    role: "user",
    content,
  };
}

// Usage:
const image = await imageProcessor.fromFile("screenshot.png");
const message = buildMultiModalMessage(
  "What's wrong with this UI?",
  [image]
);
const response = await agent.chat([message]);
```

---

## Decision Matrix: Which Feature for Which Use Case

```
Q: Building a production agent?
├── Need tool integration? → MCP
├── Need reusable knowledge? → Skills System
├── Need cross-session memory? → Memory System
├── Need extensibility? → Plugin System
├── Need budget control? → Cost Tracking
├── Need debugging? → Observability
├── Need automation? → Hooks System
└── Need image support? → Multi-Modal

Q: Building a coding agent specifically?
├── MCP → filesystem, git, database servers
├── Skills → coding patterns, frameworks, conventions
├── Memory → user preferences, project conventions
├── Plugins → git integration, linting, testing
├── Cost → track per-task cost, optimize model selection
├── Hooks → auto-lint, auto-commit, permission check
└── Multi-Modal → screenshot errors, design mockups
```
