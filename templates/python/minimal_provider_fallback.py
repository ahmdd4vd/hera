"""
Minimal Provider with Fallback — Hera Architecture Reference (Python)

Pattern: primary provider with automatic fallback to a secondary on failure.
Useful for: cost optimization (cheap first, expensive fallback), reliability
(different vendors for resilience), or local+cloud hybrid.

Based on patterns from OpenCode (provider plugins) and Hermes (credential
pooling with auto-failover).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Protocol


# ============================================================================
# Types
# ============================================================================

class LLMProvider(Protocol):
    name: str

    async def call(self, ctx: dict) -> dict:
        """Returns {content: [...], usage: {input_tokens, output_tokens}}"""
        ...


@dataclass
class FallbackConfig:
    providers: list[LLMProvider]
    max_attempts: int = 3
    backoff_ms: int = 100
    non_retryable_statuses: set[int] = field(default_factory=lambda: {400, 401, 403})


# ============================================================================
# FallbackProvider
# ============================================================================

class FallbackProvider:
    def __init__(self, config: FallbackConfig):
        self.config = config
        self.name = "fallback"

    async def call(self, ctx: dict) -> dict:
        last_error: Exception | None = None
        attempt = 0

        for provider in self.config.providers:
            while attempt < self.config.max_attempts:
                attempt += 1
                try:
                    return await provider.call(ctx)
                except Exception as err:
                    last_error = err
                    status = getattr(err, "status", None) or getattr(err, "response_status", None)

                    # Non-retryable: skip to next provider
                    if status in self.config.non_retryable_statuses:
                        print(f"[fallback] {provider.name} returned {status} - skipping")
                        break

                    # Retryable: backoff
                    if attempt < self.config.max_attempts:
                        delay_ms = self.config.backoff_ms * (2 ** (attempt - 1))
                        print(
                            f"[fallback] {provider.name} attempt {attempt} failed: {err}. "
                            f"Retrying in {delay_ms}ms..."
                        )
                        await asyncio.sleep(delay_ms / 1000)

        raise RuntimeError(
            f"All {len(self.config.providers)} providers failed. "
            f"Last error: {last_error}"
        )
