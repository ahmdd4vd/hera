# OpenCode — Deep Architecture Analysis

> **Source**: [github.com/opencode-ai/opencode](https://github.com/opencode-ai/opencode)
> **Stars**: 20K+
> **Language**: Go (backend) + TypeScript (frontend)
> **License**: MIT

---

## 1. Architecture Overview

OpenCode is a Go-based AI coding agent with a clean, modular architecture.

### Core Design
- **Go backend** — High-performance, concurrent
- **Pub/sub pattern** — Event-driven communication
- **Provider abstraction** — Multi-provider support
- **Permission system** — File/bash permission checking
- **Session management** — SQLite-backed sessions

---

## 2. Agent Loop (internal/llm/agent/agent.go — 758 lines)

### Loop Structure

```go
func (a *agent) processGeneration(ctx context.Context, sessionID, content string, attachmentParts []message.ContentPart) AgentEvent {
    // Create user message
    userMsg, _ := a.createUserMessage(ctx, sessionID, content, attachmentParts)
    msgHistory := append(msgs, userMsg)

    for {
        // Check cancellation
        select {
        case <-ctx.Done():
            return a.err(ctx.Err())
        default:
        }

        // Stream and handle events
        agentMessage, toolResults, err := a.streamAndHandleEvents(ctx, sessionID, msgHistory)

        // If tool use, continue loop
        if agentMessage.FinishReason() == message.FinishReasonToolUse {
            msgHistory = append(msgHistory, agentMessage, *toolResults)
            continue
        }

        // Done
        return AgentEvent{Type: AgentEventTypeResponse, Message: agentMessage, Done: true}
    }
}
```

### Tool Execution

```go
func (a *agent) streamAndHandleEvents(ctx context.Context, sessionID string, msgHistory []message.Message) (message.Message, *message.Message, error) {
    // Stream from provider
    eventChan := a.provider.StreamResponse(ctx, msgHistory, a.tools)

    // Create assistant message
    assistantMsg, _ := a.messages.Create(ctx, sessionID, message.CreateMessageParams{
        Role: message.Assistant,
    })

    // Process events
    for event := range eventChan {
        a.processEvent(ctx, sessionID, &assistantMsg, event)
    }

    // Execute tool calls
    toolCalls := assistantMsg.ToolCalls()
    for i, toolCall := range toolCalls {
        // Find tool
        var tool tools.BaseTool
        for _, availableTool := range a.tools {
            if availableTool.Info().Name == toolCall.Name {
                tool = availableTool
                break
            }
        }

        // Execute tool
        toolResult, toolErr := tool.Run(ctx, tools.ToolCall{
            ID:    toolCall.ID,
            Name:  toolCall.Name,
            Input: toolCall.Input,
        })

        // Handle permission denied
        if errors.Is(toolErr, permission.ErrorPermissionDenied) {
            toolResults[i] = message.ToolResult{
                ToolCallID: toolCall.ID,
                Content:    "Permission denied",
                IsError:    true,
            }
            // Cancel remaining tool calls
            for j := i + 1; j < len(toolCalls); j++ {
                toolResults[j] = message.ToolResult{
                    ToolCallID: toolCalls[j].ID,
                    Content:    "Tool execution canceled by user",
                    IsError:    true,
                }
            }
            break
        }

        toolResults[i] = message.ToolResult{
            ToolCallID: toolCall.ID,
            Content:    toolResult.Content,
            IsError:    toolResult.IsError,
        }
    }

    return assistantMsg, &msg, err
}
```

---

## 3. Provider System (internal/llm/provider/)

### Supported Providers

| Provider | File |
|----------|------|
| Anthropic | anthropic.go |
| OpenAI | openai.go |
| Gemini | gemini.go |
| Azure | azure.go |
| Bedrock | bedrock.go |
| Vertex AI | vertexai.go |
| Copilot | copilot.go |
| Groq | groq.go |
| xAI | xai.go |
| OpenRouter | openrouter.go |
| Local | local.go |

### Provider Interface

```go
type Provider interface {
    Model() models.Model
    StreamResponse(ctx context.Context, messages []message.Message, tools []tools.BaseTool) <-chan ProviderEvent
}

type ProviderEvent struct {
    Type     ProviderEventType
    Content  string
    ToolCall *message.ToolCall
    Response *ProviderResponse
    Error    error
}
```

---

## 4. Tool System (internal/llm/tools/)

### Built-in Tools

| Tool | File | Purpose |
|------|------|---------|
| `file` | file.go | Read files |
| `edit` | edit.go | Edit files (search/replace) |
| `write` | write.go | Write files |
| `bash` | bash.go | Execute shell commands |
| `grep` | grep.go | Search code |
| `glob` | glob.go | Find files |
| `patch` | patch.go | Apply patches |
| `fetch` | fetch.go | Fetch web content |
| `sourcegraph` | sourcegraph.go | Code search |
| `diagnostics` | diagnostics.go | Get diagnostics |

### Tool Interface

```go
type BaseTool interface {
    Info() ToolInfo
    Run(ctx context.Context, call ToolCall) (ToolResult, error)
}

type ToolInfo struct {
    Name        string
    Description string
    Parameters  json.RawMessage
}

type ToolCall struct {
    ID    string
    Name  string
    Input json.RawMessage
}

type ToolResult struct {
    Content  string
    Metadata map[string]interface{}
    IsError  bool
}
```

---

## 5. Permission System (internal/permission/)

### Permission Flow

```
Tool call → Check permission → Allow/Deny/Ask
```

### Permission Types

```go
var ErrorPermissionDenied = errors.New("permission denied")

type PermissionChecker interface {
    Check(toolName string, input map[string]interface{}) error
}
```

---

## 6. Session Management (internal/session/)

### Session Structure

```go
type Session struct {
    ID                string
    Title             string
    SummaryMessageID  string
    Cost              float64
    CompletionTokens  int
    PromptTokens      int
}
```

### Cost Tracking

```go
func (a *agent) TrackUsage(ctx context.Context, sessionID string, model models.Model, usage provider.TokenUsage) error {
    cost := model.CostPer1MInCached/1e6*float64(usage.CacheCreationTokens) +
        model.CostPer1MOutCached/1e6*float64(usage.CacheReadTokens) +
        model.CostPer1MIn/1e6*float64(usage.InputTokens) +
        model.CostPer1MOut/1e6*float64(usage.OutputTokens)

    sess.Cost += cost
    sess.CompletionTokens = usage.OutputTokens + usage.CacheReadTokens
    sess.PromptTokens = usage.InputTokens + usage.CacheCreationTokens

    return nil
}
```

---

## 7. Key Patterns

### Pattern 1: Go Concurrency
```go
go func() {
    defer logging.RecoverPanic("agent.Run", func() {
        events <- a.err(fmt.Errorf("panic while running the agent"))
    })
    result := a.processGeneration(genCtx, sessionID, content, attachmentParts)
    events <- result
}()
```

### Pattern 2: Pub/Sub Events
```go
type Broker[T any] struct {
    subscribers map[EventType][]chan T
}

func (b *Broker[T]) Publish(event EventType, data T) {
    for _, ch := range b.subscribers[event] {
        ch <- data
    }
}
```

### Pattern 3: Cancellation
```go
genCtx, cancel := context.WithCancel(ctx)
a.activeRequests.Store(sessionID, cancel)

// Cancel on user request
if cancelFunc, exists := a.activeRequests.LoadAndDelete(sessionID); exists {
    cancel()
}
```

### Pattern 4: Streaming Events
```go
for event := range eventChan {
    switch event.Type {
    case provider.EventContentDelta:
        assistantMsg.AppendContent(event.Content)
    case provider.EventToolUseStart:
        assistantMsg.AddToolCall(*event.ToolCall)
    case provider.EventComplete:
        assistantMsg.SetToolCalls(event.Response.ToolCalls)
    }
}
```

---

## 8. Lessons for Agent Builders

1. **Go is great for agents** — Concurrency, performance, type safety
2. **Pub/sub pattern** — Clean event-driven communication
3. **Provider abstraction** — Easy to add new providers
4. **Permission checking** — Block dangerous operations
5. **Cost tracking** — Monitor token usage per session
6. **Cancellation support** — Users can cancel long-running operations
7. **Streaming** — Process events as they arrive
8. **Session management** — Track conversations and costs

---

*Last updated: 2026-06-13*
*Verified from OpenCode source code (Go)*
