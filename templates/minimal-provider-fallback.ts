/**
 * Minimal Provider with Fallback — Hera Architecture Reference (TypeScript)
 *
 * Pattern: primary provider with automatic fallback to a secondary on failure.
 * Useful for: cost optimization (cheap first, expensive fallback), reliability
 * (different vendors for resilience), or local+cloud hybrid.
 *
 * Based on patterns from OpenCode (provider plugins) and Hermes (credential
 * pooling with auto-failover).
 */

// ============================================================================
// Inline types (self-contained, no external imports)
// ============================================================================

interface AgentContext {
  systemPrompt: string;
  messages: Array<{ role: string; content: unknown }>;
}

interface ContentBlock {
  type: "text" | "toolCall";
  text?: string;
  id?: string;
  name?: string;
  arguments?: unknown;
}

interface CallResult {
  content: ContentBlock[];
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LLMProvider {
  name: string;
  call(ctx: AgentContext): Promise<CallResult>;
}

export interface FallbackConfig {
  /** Providers in priority order. First one is tried first. */
  providers: LLMProvider[];
  /** Max attempts across all providers (default: 3). */
  maxAttempts?: number;
  /** Backoff base in ms (default: 100). Actual delay = base * 2^attempt. */
  backoffMs?: number;
  /** Errors that should NOT trigger fallback (e.g., 400 bad request). */
  nonRetryableStatuses?: number[];
}

// ============================================================================
// FallbackProvider
// ============================================================================

export class FallbackProvider implements LLMProvider {
  name = "fallback";

  constructor(private config: FallbackConfig) {}

  async call(ctx: AgentContext): Promise<CallResult> {
    const maxAttempts = this.config.maxAttempts ?? 3;
    const backoffMs = this.config.backoffMs ?? 100;
    const nonRetryable = new Set(this.config.nonRetryableStatuses ?? [400, 401, 403]);

    let lastError: unknown;
    let attempt = 0;

    for (const provider of this.config.providers) {
      // Try this provider up to maxAttempts times
      while (attempt < maxAttempts) {
        attempt++;
        try {
          return await provider.call(ctx);
        } catch (err: any) {
          lastError = err;

          // Non-retryable error: skip to next provider immediately
          const status = err?.status ?? err?.response?.status;
          if (status && nonRetryable.has(status)) {
            console.warn(`[fallback] ${provider.name} returned ${status} — skipping`);
            break;
          }

          // Retryable: backoff and try again
          if (attempt < maxAttempts) {
            const delay = backoffMs * 2 ** (attempt - 1);
            console.warn(
              `[fallback] ${provider.name} attempt ${attempt} failed: ${err?.message ?? err}. ` +
                `Retrying in ${delay}ms...`
            );
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
    }

    throw new Error(
      `All ${this.config.providers.length} providers failed. Last error: ${
        (lastError as any)?.message ?? lastError
      }`
    );
  }
}

// ============================================================================
// Example usage
// ============================================================================

// const provider = new FallbackProvider({
//   providers: [
//     new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, model: "gpt-4o-mini" }),
//     new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, model: "gpt-4o" }),
//   ],
//   maxAttempts: 2,
//   backoffMs: 200,
//   nonRetryableStatuses: [400, 401],
// });
//
// const result = await provider.call(ctx);
