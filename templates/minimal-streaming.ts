/**
 * Minimal Streaming Response — Hera Architecture Reference (TypeScript)
 *
 * Pattern: AsyncIterable-based streaming for LLM responses. Enables progressive
 * UI updates, early cancellation, and lower time-to-first-token.
 *
 * Based on Pi Agent's streamAssistantResponse() and Hermes's agent_loop streamFn.
 */

// ============================================================================
// Inline types (self-contained)
// ============================================================================

interface AgentContext {
  systemPrompt: string;
  messages: Array<{ role: string; content: unknown }>;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface StreamChunk {
  type: "text" | "toolCall" | "usage" | "done";
  text?: string;
  toolCall?: Partial<ToolCall>;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface StreamFn {
  (ctx: AgentContext, signal?: AbortSignal): AsyncIterable<StreamChunk>;
}

// ============================================================================
// Mock streaming provider (replace with real API call)
// ============================================================================

export async function* streamFromProvider(
  ctx: AgentContext,
  signal?: AbortSignal
): AsyncIterable<StreamChunk> {
  // Real implementation: fetch SSE from OpenAI/Anthropic/etc.
  // This is a mock that yields 3 text chunks, 1 tool call, then done.

  const text = "Let me read that file for you.";
  for (const word of text.split(" ")) {
    if (signal?.aborted) return;
    yield { type: "text", text: word + " " };
    await new Promise((r) => setTimeout(r, 50));
  }

  yield {
    type: "toolCall",
    toolCall: {
      id: "call_1",
      name: "read_file",
      arguments: { path: "/repo/src/index.ts" },
    },
  };

  yield { type: "usage", usage: { inputTokens: 100, outputTokens: 12 } };
  yield { type: "done" };
}

// ============================================================================
// Streaming consumer
// ============================================================================

export async function consumeStream(
  stream: AsyncIterable<StreamChunk>,
  onText: (text: string) => void,
  onToolCall: (tc: Partial<ToolCall>) => void,
  signal?: AbortSignal
): Promise<{ toolCalls: Partial<ToolCall>[]; usage?: { inputTokens: number; outputTokens: number } }> {
  const toolCalls: Partial<ToolCall>[] = [];
  let usage: { inputTokens: number; outputTokens: number } | undefined;

  for await (const chunk of stream) {
    if (signal?.aborted) break;

    switch (chunk.type) {
      case "text":
        if (chunk.text) onText(chunk.text);
        break;
      case "toolCall":
        if (chunk.toolCall) {
          toolCalls.push(chunk.toolCall);
          onToolCall(chunk.toolCall);
        }
        break;
      case "usage":
        usage = chunk.usage;
        break;
      case "done":
        return { toolCalls, usage };
    }
  }

  return { toolCalls, usage };
}
