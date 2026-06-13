# AI Layer — Provider Abstraction

> **Extracted from** `SKILL.md` §11 for focused reading.
> Covers the unified provider interface, streaming, tool calls, and
> multi-provider support.

The AI layer is the **only part of the agent that talks to LLMs**. By
isolating it behind a clean abstraction, the rest of the agent can stay
provider-agnostic.

## 11. AI LAYER (`packages/ai/`)

### 11.1 Provider System

**CRITICAL: Your agent MUST support multiple providers. Never hardcode to one provider.**

Pi supports 20+ providers. OpenCode supports custom providers. Hermes supports any OpenAI-compatible endpoint. Your agent should too.

#### Provider Interface (The Abstraction Layer)

```typescript
// Every provider implements this interface
interface Provider {
  name: string;
  chat(messages: Message[], tools?: Tool[]): Promise<LLMResponse>;
  chatStream(messages: Message[], tools?: Tool[]): AsyncIterator<StreamChunk>;
  listModels(): Promise<Model[]>;
  isAvailable(): Promise<boolean>;
}

// Provider configuration
interface ProviderConfig {
  name: string;           // "openai", "anthropic", "custom"
  apiKey: string;         // API key
  baseUrl?: string;       // Custom endpoint URL
  model?: string;         // Default model
  maxTokens?: number;     // Default max tokens
  timeout?: number;       // Request timeout in seconds
  headers?: Record<string, string>;  // Custom headers
}
```

#### Built-in Providers

```typescript
// OpenAI provider
class OpenAIProvider implements Provider {
  name = "openai";
  
  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || "https://api.openai.com/v1",
    });
  }
  
  async chat(messages, tools) {
    const response = await this.client.chat.completions.create({
      model: this.config.model || "gpt-4o",
      messages,
      tools,
    });
    return this.parseResponse(response);
  }
}

// Anthropic provider
class AnthropicProvider implements Provider {
  name = "anthropic";
  
  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }
  
  async chat(messages, tools) {
    // Anthropic uses system as separate param
    const { system, chatMessages } = this.extractSystem(messages);
    const response = await this.client.messages.create({
      model: this.config.model || "claude-sonnet-4-20250514",
      system,
      messages: chatMessages,
      tools,
    });
    return this.parseResponse(response);
  }
}

// Google provider
class GoogleProvider implements Provider {
  name = "google";
  
  async chat(messages, tools) {
    // Google uses different message format
    const contents = this.convertMessages(messages);
    const response = await this.client.generateContent({
      model: this.config.model || "gemini-2.0-flash",
      contents,
      tools,
    });
    return this.parseResponse(response);
  }
}
```

#### Custom Provider (User-Defined)

**This is what makes your agent flexible. Users can add their own providers.**

```typescript
// Custom provider for any OpenAI-compatible endpoint
class CustomProvider implements Provider {
  name: string;
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  
  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.model = config.model || "default";
  }
  
  async chat(messages, tools) {
    // Use OpenAI-compatible API (works with vLLM, LiteLLM, Ollama, etc.)
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...this.config.headers,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools,
      }),
    });
    return this.parseResponse(await response.json());
  }
}

// Usage:
const ollama = new CustomProvider({
  name: "ollama",
  baseUrl: "http://localhost:11434/v1",
  apiKey: "ollama",  // Ollama doesn't need real key
  model: "llama3",
});

const vllm = new CustomProvider({
  name: "vllm",
  baseUrl: "http://localhost:8000/v1",
  apiKey: "vllm",
  model: "meta-llama/Llama-3-70B",
});

const litellm = new CustomProvider({
  name: "litellm",
  baseUrl: "http://localhost:4000/v1",
  apiKey: "sk-...",
  model: "gpt-4o",  // LiteLLM routes to actual provider
});
```

#### Provider Registry

```typescript
// Central registry for all providers
class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();
  
  // Register a provider
  register(provider: Provider): void {
    this.providers.set(provider.name, provider);
  }
  
  // Get a provider by name
  get(name: string): Provider | undefined {
    return this.providers.get(name);
  }
  
  // List all registered providers
  list(): string[] {
    return Array.from(this.providers.keys());
  }
  
  // Get default provider
  getDefault(): Provider {
    return this.providers.values().next().value;
  }
  
  // Check if provider exists
  has(name: string): boolean {
    return this.providers.has(name);
  }
}

// Usage:
const registry = new ProviderRegistry();

// Register built-in providers
registry.register(new OpenAIProvider({ apiKey: "sk-...", model: "gpt-4o" }));
registry.register(new AnthropicProvider({ apiKey: "sk-ant-...", model: "claude-sonnet-4" }));
registry.register(new GoogleProvider({ apiKey: "AIza...", model: "gemini-2.0-flash" }));

// Register custom providers
registry.register(new CustomProvider({
  name: "ollama",
  baseUrl: "http://localhost:11434/v1",
  apiKey: "ollama",
  model: "llama3",
}));

// Use any provider
const provider = registry.get("ollama");
const response = await provider.chat(messages);
```

#### Provider Fallback Chain

```typescript
// Try providers in order until one succeeds
class FallbackChain {
  constructor(private providers: Provider[]) {}
  
  async chat(messages, tools): Promise<LLMResponse> {
    const errors: Error[] = [];
    
    for (const provider of this.providers) {
      try {
        return await provider.chat(messages, tools);
      } catch (error) {
        errors.push(error);
        console.warn(`Provider ${provider.name} failed: ${error.message}`);
        continue;
      }
    }
    
    throw new Error(`All providers failed: ${errors.map(e => e.message).join(", ")}`);
  }
}

// Usage:
const chain = new FallbackChain([
  registry.get("openai"),      // Try OpenAI first
  registry.get("anthropic"),   // Then Anthropic
  registry.get("ollama"),      // Then local Ollama
]);

const response = await chain.chat(messages);  // Uses first that works
```

#### Provider Routing (Task-Based)

```typescript
// Select provider based on task type
class ProviderRouter {
  constructor(private registry: ProviderRegistry) {}
  
  select(taskType: string, preferences?: { cost?: "low" | "medium" | "high" }): Provider {
    const routes: Record<string, string> = {
      "simple": "ollama",           // Local, free
      "coding": "anthropic",        // Best for code
      "research": "openai",         // Good all-round
      "planning": "ollama",         // Cheap for planning
      "complex": "anthropic",       // Best reasoning
    };
    
    // Override with cost preference
    if (preferences?.cost === "low") {
      return this.registry.get("ollama") || this.registry.getDefault();
    }
    
    return this.registry.get(routes[taskType]) || this.registry.getDefault();
  }
}

// Usage:
const router = new ProviderRouter(registry);

// Simple task → local Ollama (free)
const simpleProvider = router.select("simple");

// Coding task → Anthropic (best for code)
const codingProvider = router.select("coding");

// Budget-conscious → local Ollama
const cheapProvider = router.select("coding", { cost: "low" });
```

#### OpenAI-Compatible Endpoints

Most custom LLM servers use OpenAI-compatible API. This is the key to supporting ANY provider:

```typescript
// Works with:
// - Ollama (http://localhost:11434/v1)
// - vLLM (http://localhost:8000/v1)
// - LiteLLM (http://localhost:4000/v1)
// - LM Studio (http://localhost:1234/v1)
// - Text Generation WebUI (http://localhost:5000/v1)
// - Any OpenAI-compatible server

class OpenAICompatibleProvider implements Provider {
  async chat(messages, tools) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        tools: tools?.map(t => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        stream: false,
      }),
    });
    
    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      toolCalls: data.choices[0].message.tool_calls,
      usage: data.usage,
    };
  }
}
```

#### Provider Configuration (YAML/JSON)

```yaml
# providers.yaml — user configures their providers
providers:
  - name: openai
    type: openai
    api_key: ${OPENAI_API_KEY}
    model: gpt-4o
    max_tokens: 4096
    
  - name: anthropic
    type: anthropic
    api_key: ${ANTHROPIC_API_KEY}
    model: claude-sonnet-4-20250514
    
  - name: ollama
    type: openai-compatible
    base_url: http://localhost:11434/v1
    api_key: ollama
    model: llama3
    
  - name: vllm
    type: openai-compatible
    base_url: http://localhost:8000/v1
    api_key: vllm
    model: meta-llama/Llama-3-70B

  - name: custom
    type: openai-compatible
    base_url: https://my-server.com/v1
    api_key: ${CUSTOM_API_KEY}
    model: my-model
    headers:
      X-Custom-Header: value

routing:
  simple: ollama
  coding: anthropic
  research: openai
  default: openai

fallback:
  - openai
  - anthropic
  - ollama
```

**NEVER hardcode to one provider. Always support:**
1. Built-in providers (OpenAI, Anthropic, Google)
2. Custom providers (user-defined OpenAI-compatible endpoints)
3. Provider registry (register, get, list)
4. Fallback chain (try multiple providers)
5. Task-based routing (select provider by task type)
6. Configuration file (providers.yaml)

### 11.2 Model Definition

```typescript
interface Model<Api> {
  id: string;
  name: string;
  api: Api;
  provider: string;
  baseUrl: string;
  reasoning: boolean;
  input: ("text" | "image" | "audio")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
}
```

### 11.3 Streaming

```typescript
// Main streaming function
function streamSimple(
  model: Model<any>,
  context: Context,
  options: SimpleStreamOptions,
): AssistantMessageEventStream;

// Event types:
type AssistantMessageEvent =
  | { type: "start"; partial: AssistantMessage }
  | { type: "text_start" | "text_delta" | "text_end"; partial: AssistantMessage }
  | { type: "thinking_start" | "thinking_delta" | "thinking_end"; partial: AssistantMessage }
  | { type: "toolcall_start" | "toolcall_delta" | "toolcall_end"; partial: AssistantMessage }
  | { type: "done"; message: AssistantMessage }
  | { type: "error"; error: AssistantMessage };
```

### 11.4 EventStream

```typescript
class EventStream<T, R> implements AsyncIterable<T> {
  push(event: T): void;
  end(result?: R): void;
  result(): Promise<R>;
  [Symbol.asyncIterator](): AsyncIterator<T>;
}
```

### 11.5 Stream Options

```typescript
interface SimpleStreamOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  apiKey?: string;
  transport?: Transport;           // "sse" | "websocket" | "auto"
  cacheRetention?: CacheRetention; // "none" | "short" | "long"
  sessionId?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  maxRetryDelayMs?: number;
  reasoning?: ThinkingLevel;
  thinkingBudgets?: ThinkingBudgets;
  metadata?: Record<string, unknown>;
  onPayload?: (payload: unknown, model: Model<Api>) => unknown | undefined;
  onResponse?: (response: ProviderResponse, model: Model<Api>) => void;
}
```

### 11.6 Provider Registration

```typescript
function registerApiProvider<Api extends string>(
  api: Api,
  handler: (
    model: Model<Api>,
    context: Context,
    options: SimpleStreamOptions,
  ) => AssistantMessageEventStream,
): void;
```

---

