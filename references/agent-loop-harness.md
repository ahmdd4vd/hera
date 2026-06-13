# Agent Loop, Agent Class, and Agent Harness

> **Extracted from** `SKILL.md` §3–5 for focused reading.
> Covers the core runtime loop, the Agent class wrapper, and the AgentHarness orchestrator.

This file explains the **three core abstractions** that make a coding agent
work. Read this first when building a new agent.

## 3. AGENT LOOP (`packages/agent/src/agent-loop.ts`)

### 3.1 Architecture

The agent loop is the **heart of any coding agent**. It's a pure function that takes prompts, context, and config, and returns an event stream.

```typescript
function agentLoop(
  prompts: AgentMessage[],
  context: AgentContext,
  config: AgentLoopConfig,
  signal?: AbortSignal,
  streamFn?: StreamFn,
): EventStream<AgentEvent, AgentMessage[]>
```

### 3.2 Two-Loop Design

```
OUTER LOOP (follow-up messages)
├── Check for queued follow-up messages
├── If found → inject and continue
│
└── INNER LOOP (tool calls + steering)
    ├── 1. Inject pending steering messages
    ├── 2. streamAssistantResponse()
    │      → AgentMessage[] → Message[] (convertToLlm)
    │      → LLM call via streamFn
    │      → Emit message_start, message_update, message_end
    ├── 3. Check tool calls in response
    │      → executeToolCalls() (parallel or sequential)
    ├── 4. prepareNextTurn() → update context/model/thinking
    ├── 5. shouldStopAfterTurn() → graceful stop
    └── 6. getSteeringMessages() → inject mid-run messages
```

### 3.3 Streaming Flow

```typescript
async function streamAssistantResponse(context, config, signal, emit, streamFn) {
  // 1. Transform context (AgentMessage[] → AgentMessage[])
  let messages = config.transformContext
    ? await config.transformContext(context.messages, signal)
    : context.messages;

  // 2. Convert to LLM format (AgentMessage[] → Message[])
  const llmMessages = await config.convertToLlm(messages);

  // 3. Build LLM context
  const llmContext: Context = { systemPrompt, messages: llmMessages, tools };

  // 4. Resolve API key (supports expiring tokens)
  const apiKey = config.getApiKey
    ? await config.getApiKey(model.provider)
    : config.apiKey;

  // 5. Call LLM
  const response = await streamFn(model, llmContext, { ...config, apiKey, signal });

  // 6. Stream events
  for await (const event of response) {
    switch (event.type) {
      case "start":           // Partial message created
      case "text_delta":      // Streaming text
      case "toolcall_delta":  // Streaming tool call
      case "done":            // Final message
      case "error":           // Error
    }
  }
}
```

### 3.4 Tool Execution

**Two modes**: Sequential and Parallel

**Sequential**: Execute one tool at a time, emit results in order.

**Parallel** (default):
1. Prepare all tool calls sequentially (validate args, check beforeToolCall hook)
2. Execute all prepared tools concurrently via `Promise.all()`
3. Emit `tool_execution_end` in completion order
4. Create `ToolResultMessage` in assistant source order

**Tool preparation flow**:
```
prepareToolCall()
  → Find tool by name in context.tools
  → prepareToolCallArguments() (pre-validation shim)
  → validateToolArguments() (TypeBox schema validation)
  → beforeToolCall hook (can block execution)
  → Return PreparedToolCall or ImmediateToolCallOutcome (error)
```

**Termination**: If ALL tool results in a batch have `terminate === true`, the agent stops after that batch.

---

## 4. AGENT CLASS (`packages/agent/src/agent.ts`)

### 4.1 Purpose

Stateful wrapper around the low-level agent loop. Owns transcript, emits lifecycle events, executes tools, exposes queueing APIs.

### 4.2 Key Features

```typescript
class Agent {
  // === State ===
  state: AgentState;

  // === Queueing ===
  steer(message: AgentMessage): void;      // Inject mid-run
  followUp(message: AgentMessage): void;   // Queue after stop
  clearSteeringQueue(): void;
  clearFollowUpQueue(): void;
  hasQueuedMessages(): boolean;

  // === Lifecycle ===
  prompt(input: string | AgentMessage | AgentMessage[]): Promise<void>;
  continue(): Promise<void>;
  abort(): void;
  waitForIdle(): Promise<void>;
  reset(): void;

  // === Events ===
  subscribe(listener: (event: AgentEvent, signal: AbortSignal) => Promise<void> | void): () => void;

  // === Hooks ===
  convertToLlm: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
  transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
  beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>;
  afterToolCall?: (context: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | undefined>;
  prepareNextTurn?: (signal?: AbortSignal) => Promise<AgentLoopTurnUpdate | undefined>;

  // === Config ===
  steeringMode: QueueMode;  // "all" | "one-at-a-time"
  followUpMode: QueueMode;
  toolExecution: ToolExecutionMode; // "sequential" | "parallel"
  transport: Transport;     // "sse" | "websocket" | "websocket-cached" | "auto"
}
```

### 4.3 PendingMessageQueue

```typescript
class PendingMessageQueue {
  mode: QueueMode;
  enqueue(message: AgentMessage): void;
  hasItems(): boolean;
  drain(): AgentMessage[];  // "all" → drain everything, "one-at-a-time" → oldest only
  clear(): void;
}
```

### 4.4 Run Lifecycle

```
prompt("text")
  → normalizePromptInput() → AgentMessage[]
  → runWithLifecycle()
    → Create AbortController
    → Set isStreaming = true
    → Run agentLoop()
    → Process events (update state, notify listeners)
    → On error: handleRunFailure() → emit error events
    → Finally: finishRun() → clear state, resolve promise
```

### 4.5 Event Processing

```typescript
private async processEvents(event: AgentEvent): Promise<void> {
  switch (event.type) {
    case "message_start":  → state.streamingMessage = event.message;
    case "message_update": → state.streamingMessage = event.message;
    case "message_end":    → state.streamingMessage = undefined;
                            state.messages.push(event.message);
    case "tool_execution_start": → state.pendingToolCalls.add(event.toolCallId);
    case "tool_execution_end":   → state.pendingToolCalls.delete(event.toolCallId);
    case "turn_end":       → Capture error message if present;
    case "agent_end":      → state.streamingMessage = undefined;
  }
  // Notify all listeners (awaited in order)
  for (const listener of this.listeners) await listener(event, signal);
}
```

---

## 5. AGENT HARNESS (`packages/agent/src/harness/agent-harness.ts`)

### 5.1 Purpose

Orchestration layer that wraps Agent with session management, compaction, skills, prompt templates, resource loading, and hook system.

### 5.2 Architecture

```
AgentHarness
├── Session (tree-based storage, branching, compaction)
├── Resources (skills, prompt templates)
├── Tools (Map<string, AgentTool>)
├── Hooks (event handlers)
├── Queues (steer, followUp, nextTurn)
├── Phase ("idle" | "turn" | "compact" | "fork" | "switch")
└── Agent (low-level loop)
```

### 5.3 Turn State

```typescript
interface AgentHarnessTurnState<TSkill, TPromptTemplate, TTool> {
  messages: AgentMessage[];
  resources: AgentHarnessResources<TSkill, TPromptTemplate>;
  streamOptions: AgentHarnessStreamOptions;
  sessionId: string;
  systemPrompt: string;
  model: Model<any>;
  thinkingLevel: ThinkingLevel;
  tools: TTool[];
  activeTools: TTool[];
}
```

### 5.4 Key Methods

```typescript
class AgentHarness {
  // === Core ===
  prompt(text: string, options?: { images?: ImageContent[] }): Promise<AssistantMessage>;
  skill(name: string, additionalInstructions?: string): Promise<AssistantMessage>;
  promptFromTemplate(name: string, args?: string[]): Promise<AssistantMessage>;

  // === Queueing ===
  steer(text: string, options?: { images?: ImageContent[] }): Promise<void>;
  followUp(text: string, options?: { images?: ImageContent[] }): Promise<void>;
  nextTurn(messages: AgentMessage[]): Promise<void>;

  // === Session ===
  getSession(): Session;
  switchSession(sessionId: string): Promise<void>;
  forkSession(label?: string): Promise<string>;
  compactSession(): Promise<void>;

  // === State ===
  abort(): void;
  getPhase(): AgentHarnessPhase;

  // === Events ===
  on<TType extends string>(type: TType, handler: (event: any, signal?: AbortSignal) => any): () => void;
}
```

### 5.5 Hook System

```typescript
type AgentHarnessEvent =
  | { type: "before_agent_start"; prompt: string; images?: ImageContent[];
      systemPrompt: string; resources: AgentHarnessResources }
  | { type: "before_provider_request"; model: Model<any>; sessionId: string;
      streamOptions: AgentHarnessStreamOptions }
  | { type: "before_provider_payload"; model: Model<any>; payload: unknown }
  | { type: "after_provider_response"; status: number; headers: Record<string, string> }
  | { type: "context"; messages: AgentMessage[] }
  | { type: "tool_call"; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolCallId: string; toolName: string; input: Record<string, unknown>;
      content: (TextContent | ImageContent)[]; details: unknown; isError: boolean }
  | { type: "message_end"; message: AgentMessage }
  | { type: "turn_end"; message: AssistantMessage; toolResults: ToolResultMessage[] }
  | { type: "agent_end"; messages: AgentMessage[] }
  | { type: "save_point"; hadPendingMutations: boolean }
  | { type: "settled"; nextTurnCount: number }
  | { type: "queue_update"; steer: UserMessage[]; followUp: UserMessage[];
      nextTurn: AgentMessage[] };
```

### 5.6 Execute Turn Flow

```
executeTurn(turnState, text, options)
  1. Create user message from text + images
  2. Prepend nextTurnQueue messages
  3. Emit before_agent_start hook (can inject messages, override system prompt)
  4. Create AbortController
  5. Run agentLoop() with:
     - createContext(turnState)
     - createLoopConfig(getTurnState, setTurnState)
     - handleAgentEvent() as event handler
     - createStreamFn(getTurnState) as stream function
  6. On success: return last assistant message
  7. On error: emitRunFailure() → create failure message, emit events
  8. Finally: flushPendingSessionWrites()
```

### 5.7 Stream Function

```typescript
createStreamFn(getTurnState): StreamFn {
  return async (model, context, streamOptions) => {
    const auth = await this.getApiKeyAndHeaders?.(model);
    const requestOptions = await this.emitBeforeProviderRequest(
      model, sessionId, streamOptions
    );
    return streamSimple(model, context, {
      ...requestOptions,
      apiKey: auth?.apiKey,
      onPayload: async (payload) =>
        await this.emitBeforeProviderPayload(model, payload),
      onResponse: async (response) =>
        await this.emitOwn({ type: "after_provider_response", ... }),
    });
  };
}
```

---

