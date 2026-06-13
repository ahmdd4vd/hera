# OpenAI Codex — Architecture & Function-Calling Patterns

> **Source**: OpenAI Codex / OpenAI function-calling API
> **Best reference**: [github.com/openai/codex](https://github.com/openai/codex) (open-source CLI)
> **Patterns verified from**: `examples/full-agent/src/providers/openai-real.ts`
> **License**: MIT (Codex CLI), OpenAI API (proprietary)

---

## 1. Architecture Overview

OpenAI's Codex ecosystem is built around three orthogonal concerns:

1. **Function calling** — the LLM emits structured tool calls instead of free-form text
2. **Multi-turn message protocol** — alternating `system` / `user` / `assistant` / `tool` roles
3. **Streaming** — token-by-token responses with optional `tool_calls` deltas

Unlike other agents (Pi, Aider) that bake their own message format, Codex uses
**the OpenAI Chat Completions format directly**. Anything that speaks that
format (vLLM, LiteLLM, Ollama, TokenRouter) is "Codex-compatible."

### Core Design
- **Function-calling as primitive** — every tool is a JSON-schema function
- **Tool/role separation** — `tool` role messages carry execution results back
- **Stateless** — server has no concept of session; client manages state
- **Token streaming** — `stream: true` returns SSE deltas
- **Parallel tool calls** — LLM can emit multiple `tool_calls` in one response

---

## 2. Message Protocol

### 2.1 Roles

```typescript
type OpenAIMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
```

### 2.2 Tool Definition

```typescript
{
  type: "function",
  function: {
    name: "read_file",
    description: "Read the contents of a file at the given path",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute file path" },
        offset: { type: "number", description: "1-indexed line to start" },
        limit: { type: "number", description: "Max lines to read" }
      },
      required: ["path"]
    }
  }
}
```

### 2.3 Tool Call (assistant message)

```typescript
{
  role: "assistant",
  content: null,
  tool_calls: [
    {
      id: "call_abc123",
      type: "function",
      function: {
        name: "read_file",
        arguments: '{"path": "/repo/src/index.ts"}'  // JSON STRING
      }
    }
  ]
}
```

### 2.4 Tool Result (tool message)

```typescript
{
  role: "tool",
  tool_call_id: "call_abc123",
  content: "1|import { foo } from './foo.js';\n2|..."
}
```

---

## 3. Streaming Protocol

### 3.1 SSE Delta Format

OpenAI streams responses as Server-Sent Events:

```
data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"delta":{"role":"assistant"},"index":0}]}

data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"},"index":0}]}

data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","function":{"name":"read","arguments":""}}]},"index":0}]}

data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\""}}]},"index":0}]}

data: [DONE]
```

### 3.2 Key Gotcha: Tool Call Arguments Are a String

> ⚠️ **M3 compatibility note**: The `arguments` field is a **JSON string**, not a parsed object. Some models (like MiniMax-M3 via TokenRouter) may return it pre-parsed as a dict. Always handle both:
>
> ```typescript
> const args = typeof part.arguments === "string"
>   ? JSON.parse(part.arguments)
>   : part.arguments;
> ```
>
> This is the bug fixed in `examples/full-agent/src/agent/loop.py` (commit `934ab8c`):
> `str().replace(...)` → `json.dumps(...)` to handle dict-typed tool args.

### 3.3 Accumulating Tool Call Deltas

Streaming responses deliver tool calls **incrementally** — name first, then
arguments character by character. Buffer them client-side:

```typescript
const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

for await (const chunk of stream) {
  for (const choice of chunk.choices) {
    for (const delta of choice.delta.tool_calls ?? []) {
      const buf = toolCallBuffers.get(delta.index) ?? { id: "", name: "", args: "" };
      if (delta.id) buf.id = delta.id;
      if (delta.function?.name) buf.name += delta.function.name;
      if (delta.function?.arguments) buf.args += delta.function.arguments;
      toolCallBuffers.set(delta.index, buf);
    }
  }
}

// After stream ends, parse accumulated args
const toolCalls = [...toolCallBuffers.values()].map((buf) => ({
  ...buf,
  arguments: JSON.parse(buf.args),
}));
```

---

## 4. Agent Loop Pattern

### 4.1 The Loop (Codex-style)

```
1. Build messages: [system, ...history, user]
2. Send to LLM with stream: true
3. For each delta:
   a. If content → emit to user
   b. If tool_calls → buffer
4. After stream ends:
   a. Append assistant message to history
   b. If no tool_calls → DONE
   c. Else: execute each tool, append tool messages
   d. Goto 1
```

### 4.2 Concrete Code (from `openai-real.ts`)

```typescript
// From examples/full-agent/src/providers/openai-real.ts
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;

  // Text content
  if (delta?.content) {
    yield { type: "text", text: delta.content };
  }

  // Tool calls (accumulated)
  if (delta?.tool_calls) {
    for (const tc of delta.tool_calls) {
      if (tc.function?.name) {
        toolCallBuffer.name = tc.function.name;
      }
      if (tc.function?.arguments) {
        toolCallBuffer.arguments += tc.function.arguments;
      }
    }
  }
}
```

### 4.3 Message Conversion (agent → OpenAI)

```typescript
function convertToOpenAI(messages: AgentMessage[]): OpenAIMessage[] {
  const out: OpenAIMessage[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      out.push({ role: "user", content: extractText(msg.content) });
    } else if (msg.role === "assistant") {
      const toolCalls = msg.content
        .filter((c) => c.type === "toolCall")
        .map((c) => ({
          id: c.id,
          type: "function",
          function: {
            name: c.name,
            arguments: typeof c.arguments === "string"
              ? c.arguments
              : JSON.stringify(c.arguments),  // Always send as string
          },
        }));
      out.push({
        role: "assistant",
        content: extractText(msg.content) || null,
        tool_calls: toolCalls.length ? toolCalls : undefined,
      });
    } else if (msg.role === "tool") {
      out.push({ role: "tool", tool_call_id: msg.toolCallId, content: msg.content });
    }
  }
  return out;
}
```

---

## 5. Multi-Provider Compatibility

Codex/Chat Completions is the **lingua franca** for LLM APIs. The same code
works with:

| Provider | Endpoint | Compatibility |
|---|---|---|
| **OpenAI** | `https://api.openai.com/v1` | Native |
| **TokenRouter** | `https://api.tokenrouter.com/v1` | Full (incl. MiniMax-M3) |
| **vLLM** | `http://localhost:8000/v1` | Open-source models |
| **LiteLLM** | Proxy | Routes to any provider |
| **Ollama** | `http://localhost:11434/v1` | Local models |
| **Azure OpenAI** | `https://{resource}.openai.azure.com/` | Native (different auth) |

### Minimal Config

```typescript
interface OpenAIConfig {
  apiKey: string;       // "sk-..." or TokenRouter key
  model: string;        // "gpt-4o", "MiniMax-M3", "llama-3-70b"
  baseUrl: string;      // "https://api.openai.com/v1"
}
```

---

## 6. Error Handling

### 6.1 Status Codes

| Code | Meaning | Retry? |
|---|---|---|
| 400 | Bad request (malformed) | No — fix request |
| 401 | Invalid API key | No — refresh key |
| 429 | Rate limit / quota | Yes — backoff |
| 500+ | Server error | Yes — backoff |
| 503 | Service unavailable | Yes — backoff |

### 6.2 Retry with Exponential Backoff

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (err.status === 400 || err.status === 401) throw err;  // Don't retry
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 100));
      }
    }
  }
  throw lastErr;
}
```

---

## 7. Token Usage Tracking

Every response includes a `usage` object (only on non-streaming, or in
`stream_options.include_usage: true`):

```typescript
{
  usage: {
    prompt_tokens: 1234,
    completion_tokens: 567,
    total_tokens: 1801
  }
}
```

**Track per-conversation**, not per-message. The full context grows each turn.

```typescript
const totalCost = (response.usage.total_tokens / 1000) * COST_PER_1K_TOKENS;
if (totalCost > budget) {
  return { isError: true, content: [{ type: "text", text: "Budget exceeded" }] };
}
```

---

## 8. Function Calling Best Practices

### 8.1 DO
- ✅ Use clear, verb-led names: `read_file`, `search_code`, `run_command`
- ✅ Write `description` as a one-sentence summary of **when** to use the tool
- ✅ Validate `arguments` server-side (don't trust the LLM)
- ✅ Return errors as `tool` messages, not exceptions
- ✅ Include `required: []` for every field that must be present

### 8.2 DON'T
- ❌ Use ambiguous names like `do_thing`, `process`, `handle`
- ❌ Skip `description` — the LLM needs it to pick the right tool
- ❌ Let unhandled exceptions kill the agent loop
- ❌ Send partial JSON as `arguments` — wait for full string then parse
- ❌ Mix streaming and non-streaming responses in the same conversation

---

## 9. Comparison to Pi/Claude Code

| Aspect | Codex (OpenAI) | Pi Agent | Claude Code |
|---|---|---|---|
| **Message format** | Chat Completions (de facto standard) | Pi's own format | Anthropic Messages |
| **Tool calling** | JSON schema + tool_calls | Pi's `Tool` interface | Anthropic's tool_use blocks |
| **State** | Stateless (client tracks) | Tree-based sessions | Tree-based sessions |
| **Streaming** | SSE deltas | Event stream | Event stream |
| **Multi-provider** | ✅ (any OpenAI-compatible) | ❌ (Pi-specific) | ❌ (Anthropic-only) |
| **Maturity** | High (industry standard) | Medium | High |

**When to use Codex pattern**: When you need multi-provider support, or when
your agent needs to work with both open-source models (vLLM/Ollama) and
commercial APIs.

---

## 10. Verification Checklist

When implementing a Codex-compatible provider:

- [ ] Builds correct message array (system, user, assistant, tool)
- [ ] Tool definitions use JSON Schema for `parameters`
- [ ] Tool call `arguments` handled as string OR pre-parsed dict
- [ ] Streams use SSE parsing, not just JSON.parse
- [ ] `usage` is tracked per conversation
- [ ] 429/5xx errors retry with exponential backoff
- [ ] 400/401 errors fail fast (no retry)
- [ ] Tool results are sent back as `role: "tool"` messages
- [ ] Multiple tool calls in one response execute (parallel if independent)
- [ ] `baseUrl` is configurable for non-OpenAI providers

**Reference implementation**: `examples/full-agent/src/providers/openai-real.ts` (188 lines)
