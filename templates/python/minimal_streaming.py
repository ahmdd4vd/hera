"""
Minimal Streaming Response — Hera Architecture Reference (Python)

Async generator-based streaming for LLM responses.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import AsyncIterator


# ============================================================================
# Types
# ============================================================================

@dataclass
class StreamChunk:
    type: str  # "text" | "toolCall" | "usage" | "done"
    text: str | None = None
    tool_call: dict | None = None
    usage: dict | None = None


# ============================================================================
# Mock streaming provider
# ============================================================================

async def stream_from_provider(ctx: dict, signal: asyncio.Event | None = None) -> AsyncIterator[StreamChunk]:
    """Mock provider that yields text chunks, a tool call, then done."""
    text = "Let me read that file for you."
    for word in text.split(" "):
        if signal and signal.is_set():
            return
        yield StreamChunk(type="text", text=word + " ")
        await asyncio.sleep(0.05)

    yield StreamChunk(
        type="toolCall",
        tool_call={
            "id": "call_1",
            "name": "read_file",
            "arguments": {"path": "/repo/src/index.ts"},
        },
    )
    yield StreamChunk(type="usage", usage={"input_tokens": 100, "output_tokens": 12})
    yield StreamChunk(type="done")


# ============================================================================
# Consumer
# ============================================================================

async def consume_stream(
    stream: AsyncIterator[StreamChunk],
    on_text,
    on_tool_call,
    signal: asyncio.Event | None = None,
) -> dict:
    """Consume a stream, calling callbacks for each chunk."""
    tool_calls: list[dict] = []
    usage: dict | None = None

    async for chunk in stream:
        if signal and signal.is_set():
            break

        if chunk.type == "text" and chunk.text:
            on_text(chunk.text)
        elif chunk.type == "toolCall" and chunk.tool_call:
            tool_calls.append(chunk.tool_call)
            on_tool_call(chunk.tool_call)
        elif chunk.type == "usage":
            usage = chunk.usage
        elif chunk.type == "done":
            return {"tool_calls": tool_calls, "usage": usage}

    return {"tool_calls": tool_calls, "usage": usage}
