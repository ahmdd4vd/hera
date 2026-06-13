# Session System and Compaction

> **Extracted from** `SKILL.md` §6–7 for focused reading.
> Covers tree-based session storage, context building, and automatic compaction.

Session state is what makes an agent **stateful** across turns. Compaction
is what keeps the context window **sustainable** for long sessions.

## 6. SESSION SYSTEM (`packages/agent/src/harness/session/`)

### 6.1 Tree-Based Storage

Sessions are **append-only trees**, not linear logs. Each entry has an `id` and `parentId`.

```typescript
type SessionTreeEntry =
  | MessageEntry              // role + message content
  | ModelChangeEntry          // provider + modelId change
  | ThinkingLevelChangeEntry  // thinking level change
  | ActiveToolsChangeEntry    // active tool names change
  | CompactionEntry           // compaction summary + retained entry id
  | BranchSummaryEntry        // branch summary after fork
  | CustomEntry               // arbitrary custom data
  | CustomMessageEntry        // custom message type
  | LabelEntry                // label for an entry
  | SessionInfoEntry          // session name
  | LeafEntry;                // pointer to current leaf
```

### 6.2 Session Class

```typescript
class Session<TMetadata extends SessionMetadata> {
  getMetadata(): Promise<TMetadata>;
  getLeafId(): Promise<string | null>;
  getEntry(id: string): Promise<SessionTreeEntry | undefined>;
  getEntries(): Promise<SessionTreeEntry[]>;
  getBranch(fromId?: string): Promise<SessionTreeEntry[]>;  // Path from root to leaf
  buildContext(): Promise<SessionContext>;  // Rebuild messages from tree

  appendMessage(message: AgentMessage): Promise<string>;
  appendModelChange(provider: string, modelId: string): Promise<string>;
  appendThinkingLevelChange(thinkingLevel: string): Promise<string>;
  appendActiveToolsChange(activeToolNames: string[]): Promise<string>;
  appendCompaction(summary: string, tokensBefore: number, firstKeptEntryId: string,
                   details?: unknown): Promise<string>;
  appendBranchSummary(summary: string, fromId: string): Promise<string>;
  appendCustomEntry(customType: string, data: unknown): Promise<string>;
  appendLabel(targetId: string, label: string): Promise<string>;
  appendSessionName(name: string): Promise<string>;
}
```

### 6.3 Context Building

```typescript
function buildSessionContext(pathEntries: SessionTreeEntry[]): SessionContext {
  // Walk entries from root to leaf
  // Track: thinkingLevel, model, activeToolNames, compaction
  // If compaction found:
  //   - Add compaction summary message
  //   - Skip entries before firstKeptEntryId
  //   - Include entries after compaction
  // Else: include all entries
  return { messages, thinkingLevel, model, activeToolNames };
}
```

### 6.4 InMemorySessionStorage

```typescript
class InMemorySessionStorage<TMetadata> implements SessionStorage<TMetadata> {
  private entries: SessionTreeEntry[];
  private byId: Map<string, SessionTreeEntry>;
  private labelsById: Map<string, string>;
  private leafId: string | null;

  appendEntry(entry: SessionTreeEntry): void;
  getPathToRoot(leafId: string): SessionTreeEntry[];
  setLeafId(leafId: string): void;  // Create LeafEntry, change branch
  findEntries<TType>(type: string): Extract<SessionTreeEntry, { type: TType }>[];
}
```

---

## 7. COMPACTION SYSTEM (`packages/agent/src/harness/compaction/`)

### 7.1 Purpose

Auto-summarize old messages when context gets too long, keeping recent messages intact.

### 7.2 Settings

```typescript
interface CompactionSettings {
  enabled: boolean;
  reserveTokens: number;    // Default: 16384 (for summary prompt + output)
  keepRecentTokens: number; // Default: 20000 (recent context to keep)
}
```

### 7.3 Flow

```
prepareCompaction(entries, settings, model)
  1. Calculate context tokens from last assistant message usage
  2. Check if compaction needed: totalTokens > contextWindow - reserveTokens
  3. Find previous compaction entry (if any)
  4. Serialize conversation to text
  5. Extract file operations (read/modified files)
  6. Find split point: keep ~keepRecentTokens of recent messages
  7. Generate summary via LLM call
  8. Return CompactionResult { summary, firstKeptEntryId, tokensBefore, details }

compact(session, preparation)
  1. Append CompactionEntry to session
  2. Session rebuilds context using compaction markers
```

### 7.4 Summary Format

```
The conversation history before this point was compacted into the following summary:

<summary>
[LLM-generated summary of old messages]
</summary>
```

---
