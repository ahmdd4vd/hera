# Token Optimization & Context Compression

Patterns extracted from RTK (Rust Token Killer) and Headroom — tools that reduce LLM token consumption by 60-95%.

---

## The Token Problem

```
Problem: LLM calls are expensive. Every token costs money and time.

Typical coding session:
- System prompt: 2,000 tokens
- Conversation: 10,000 tokens
- File contents: 15,000 tokens
- Tool outputs: 20,000 tokens
- Total: 47,000 tokens per request

Cost at $5/1M input tokens: $0.235 per request
100 requests/day: $23.50/day = $705/month
```

**Solution: Reduce tokens by 60-95% without losing information.**

---

## Strategy 1: Command Output Filtering (RTK Pattern)

Filter and compress command outputs before they reach the LLM.

### The Problem

```
git log --oneline -50
→ 50 lines of git history
→ ~2,000 tokens
→ Most of it irrelevant to current task
```

### The Solution

```python
class CommandFilter:
    """Filter command outputs to keep only relevant information."""
    
    def filter(self, command: str, output: str) -> str:
        """Apply command-specific filtering."""
        filters = {
            "git log": self.filter_git_log,
            "git diff": self.filter_git_diff,
            "npm test": self.filter_test_output,
            "ls": self.filter_ls,
            "grep": self.filter_grep,
        }
        
        # Find matching filter
        for cmd_prefix, filter_fn in filters.items():
            if command.startswith(cmd_prefix):
                return filter_fn(output)
        
        # Default: truncate long output
        return self.truncate(output, max_lines=100)
    
    def filter_git_log(self, output: str) -> str:
        """Keep only recent, relevant commits."""
        lines = output.strip().split('\n')
        # Keep last 10 commits (most relevant)
        return '\n'.join(lines[:10])
    
    def filter_git_diff(self, output: str) -> str:
        """Compress diff output."""
        lines = output.strip().split('\n')
        # Keep file headers and changed lines, trim context
        result = []
        for line in lines:
            if line.startswith('diff --git') or line.startswith('@@') or line.startswith('+') or line.startswith('-'):
                result.append(line)
        return '\n'.join(result)
    
    def filter_test_output(self, output: str) -> str:
        """Keep only failures and summary."""
        lines = output.strip().split('\n')
        result = []
        for line in lines:
            # Keep failures, summary, and errors
            if any(kw in line.lower() for kw in ['fail', 'error', 'pass', 'summary', 'total']):
                result.append(line)
        return '\n'.join(result)
    
    def filter_grep(self, output: str) -> str:
        """Limit grep results."""
        lines = output.strip().split('\n')
        if len(lines) > 20:
            return '\n'.join(lines[:20]) + f'\n... and {len(lines) - 20} more matches'
        return output
```

### Token Savings

```
git log --oneline -50:
  Before: 50 lines, ~2,000 tokens
  After:  10 lines, ~400 tokens
  Savings: 80%

git diff (large):
  Before: 500 lines, ~15,000 tokens
  After:  50 lines, ~1,500 tokens
  Savings: 90%

npm test (failing):
  Before: 200 lines, ~6,000 tokens
  After:  20 lines, ~600 tokens
  Savings: 90%
```

---

## Strategy 2: Hook Interception (RTK Pattern)

Intercept commands before execution and compress their output.

### Auto-Rewrite Hook

```typescript
// Hook intercepts command, rewrites before execution
const autoRewriteHook = {
  name: "rtk-filter",
  point: "before_tool",
  
  async handler(context) {
    if (context.toolName === "bash") {
      const command = context.args.command;
      
      // Check if we have a filter for this command
      if (hasFilter(command)) {
        // Execute command ourselves
        const output = await execute(command);
        
        // Filter output
        const filtered = filterOutput(command, output);
        
        // Return filtered result (skip actual tool execution)
        return {
          skip: true,
          result: filtered,
        };
      }
    }
    
    return { continue: true };
  },
};
```

### Suggest Hook

```typescript
// Hook emits hint, agent decides autonomously
const suggestHook = {
  name: "rtk-suggest",
  point: "after_tool",
  
  async handler(context) {
    if (context.toolName === "bash") {
      const output = context.result;
      const tokens = countTokens(output);
      
      if (tokens > 1000) {
        // Suggest using rtk filter
        return {
          hint: `This output is ${tokens} tokens. Consider using 'rtk ${context.args.command}' to filter it.`,
        };
      }
    }
    
    return { continue: true };
  },
};
```

---

## Strategy 3: Diff Compression (Headroom Pattern)

Compress git diff output intelligently.

### Diff Compressor

```python
class DiffCompressor:
    """Compress unified-diff output."""
    
    def __init__(self, max_files=10, max_hunks=5, max_context=3):
        self.max_files = max_files
        self.max_hunks = max_hunks
        self.max_context = max_context
    
    def compress(self, diff: str) -> str:
        """Compress diff output."""
        # 1. Parse into files + hunks
        files = self.parse_diff(diff)
        
        # 2. Cap file count (keep heaviest)
        if len(files) > self.max_files:
            files = sorted(files, key=lambda f: f.change_count, reverse=True)
            files = files[:self.max_files]
        
        # 3. Cap hunks per file
        for file in files:
            if len(file.hunks) > self.max_hunks:
                file.hunks = self.select_best_hunks(file.hunks)
        
        # 4. Trim context lines
        for file in files:
            for hunk in file.hunks:
                hunk.context = hunk.context[:self.max_context]
        
        # 5. Reconstruct
        return self.format_diff(files)
    
    def select_best_hunks(self, hunks):
        """Select most important hunks."""
        # Keep first + last + highest-change-density hunks
        selected = [hunks[0], hunks[-1]]
        
        # Score middle hunks by change density
        middle = hunks[1:-1]
        scored = [(h, self.score_hunk(h)) for h in middle]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Add top-scored middle hunks
        remaining = self.max_hunks - len(selected)
        selected.extend(h for h, _ in scored[:remaining])
        
        return sorted(selected, key=lambda h: h.start_line)
    
    def score_hunk(self, hunk):
        """Score hunk by importance."""
        changes = hunk.additions + hunk.deletions
        total_lines = len(hunk.context) + changes
        density = changes / total_lines if total_lines > 0 else 0
        return density
```

---

## Strategy 4: Search Results Compression (Headroom Pattern)

Compress grep/ripgrep output — one of the most common tool outputs.

### Search Compressor

```python
class SearchCompressor:
    """Compress grep/ripgrep output."""
    
    def __init__(self, max_results=20, max_context=1):
        self.max_results = max_results
        self.max_context = max_context
    
    def compress(self, output: str) -> str:
        """Compress search results."""
        # 1. Parse into matches
        matches = self.parse_matches(output)
        
        # 2. Score by relevance
        scored = [(m, self.score_match(m)) for m in matches]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # 3. Keep top N
        top = scored[:self.max_results]
        
        # 4. Format
        result = []
        for match, score in top:
            result.append(f"{match.file}:{match.line}: {match.content}")
        
        if len(matches) > self.max_results:
            result.append(f"\n... {len(matches) - self.max_results} more matches hidden")
        
        return '\n'.join(result)
    
    def score_match(self, match):
        """Score match by relevance."""
        score = 0.0
        
        # Prefer matches in source files (not tests, docs)
        if match.file.endswith(('.ts', '.py', '.rs', '.go')):
            score += 0.3
        
        # Prefer function/class definitions
        if any(kw in match.content for kw in ['def ', 'class ', 'function ', 'fn ']):
            score += 0.4
        
        # Prefer matches with more context
        if len(match.content) > 50:
            score += 0.1
        
        return score
```

---

## Strategy 5: Log Compression (Headroom Pattern)

Compress verbose log output.

### Log Compressor

```python
class LogCompressor:
    """Compress log output."""
    
    def __init__(self, max_lines=50):
        self.max_lines = max_lines
    
    def compress(self, output: str) -> str:
        """Compress log output."""
        lines = output.strip().split('\n')
        
        if len(lines) <= self.max_lines:
            return output
        
        # Keep: first 10, last 10, and errors/warnings in between
        result = lines[:10]
        
        middle = lines[10:-10]
        important = [l for l in middle if any(kw in l.lower() for kw in ['error', 'warn', 'fail', 'critical'])]
        result.extend(important[:20])
        
        result.append(f"\n... {len(lines) - len(result)} lines compressed ...")
        result.extend(lines[-10:])
        
        return '\n'.join(result)
```

---

## Strategy 6: Live Zone Compression (Headroom Pattern)

Only compress the "live zone" — the part of context that's actively relevant.

### What is Live Zone

```
Context window:
┌─────────────────────────────────────┐
│ System Prompt (static)              │ ← Don't touch
├─────────────────────────────────────┤
│ Old Messages (summarized)           │ ← Can compress
├─────────────────────────────────────┤
│ LIVE ZONE (current focus)           │ ← Keep intact
│ - Current task context              │
│ - Recent messages                   │
│ - Active file contents              │
├─────────────────────────────────────┤
│ Tool Results (can be compressed)    │ ← Can compress
└─────────────────────────────────────┘
```

### Live Zone Detection

```python
class LiveZoneDetector:
    """Detect the live zone in context."""
    
    def detect(self, messages: list) -> tuple[int, int]:
        """Return (start, end) indices of live zone."""
        # Live zone = last N messages that are actively referenced
        recent = messages[-10:]  # Last 10 messages
        
        # Find the earliest reference to current task
        task_start = len(messages)
        for i, msg in enumerate(recent):
            if self.is_task_reference(msg):
                task_start = min(task_start, len(messages) - 10 + i)
        
        return (task_start, len(messages))
    
    def is_task_reference(self, message):
        """Check if message references current task."""
        content = message.get("content", "")
        # Look for task-related keywords
        return any(kw in content.lower() for kw in [
            "current task", "working on", "implementing", "fixing"
        ])
```

---

## Strategy 7: Adaptive Compression (Headroom Pattern)

Automatically choose compression ratio based on context pressure.

### Adaptive Sizer

```python
class AdaptiveSizer:
    """Choose compression ratio based on context pressure."""
    
    def compute_ratio(self, current_tokens: int, max_tokens: int) -> float:
        """Return compression ratio (0.0 = no compression, 1.0 = max compression)."""
        pressure = current_tokens / max_tokens
        
        if pressure < 0.5:
            return 0.0  # No compression needed
        elif pressure < 0.7:
            return 0.2  # Light compression
        elif pressure < 0.85:
            return 0.5  # Medium compression
        elif pressure < 0.95:
            return 0.8  # Heavy compression
        else:
            return 0.95  # Maximum compression (keep only essentials)
    
    def compress_with_ratio(self, content: str, ratio: float) -> str:
        """Compress content by given ratio."""
        if ratio == 0.0:
            return content
        
        lines = content.split('\n')
        keep_count = max(10, int(len(lines) * (1 - ratio)))
        
        # Keep first and last, compress middle
        first = lines[:keep_count // 2]
        last = lines[-(keep_count // 2):]
        
        return '\n'.join(first) + f'\n\n... {len(lines) - keep_count} lines compressed ...\n\n' + '\n'.join(last)
```

---

## Combining Strategies

```
FULL TOKEN OPTIMIZATION PIPELINE:

1. Command Output Filtering (RTK)
   → Filter git, npm, test outputs before they reach LLM
   → Savings: 60-90%

2. Diff Compression (Headroom)
   → Compress git diff to essential changes
   → Savings: 70-90%

3. Search Compression (Headroom)
   → Compress grep/ripgrep results
   → Savings: 50-80%

4. Log Compression (Headroom)
   → Compress verbose logs
   → Savings: 60-80%

5. Live Zone Detection (Headroom)
   → Only keep active context intact
   → Savings: 30-50%

6. Adaptive Compression (Headroom)
   → Auto-adjust based on context pressure
   → Savings: Variable

COMBINED SAVINGS: 60-95% token reduction
```

---

## Implementation Checklist

- [ ] Command output filter for git commands
- [ ] Command output filter for test commands
- [ ] Command output filter for build commands
- [ ] Diff compressor with file/hunk caps
- [ ] Search results compressor with relevance scoring
- [ ] Log compressor with error/warning priority
- [ ] Live zone detector
- [ ] Adaptive compression ratio calculator
- [ ] Token tracking per request
- [ ] Compression ratio reporting
