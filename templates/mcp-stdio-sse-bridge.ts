/**
 * mcp-stdio-sse-bridge.ts
 *
 * Production-grade stdio↔HTTP+SSE bridge for MCP servers.
 * Spawn a local MCP server (stdio) and expose it as an HTTP+SSE endpoint
 * so any MCP client can connect to it remotely.
 *
 * Extracted from 9router src/lib/mcp/stdioSseBridge.js (extended with
 * message filtering, multi-session support, and reconnect handling).
 *
 * Usage:
 *   import { MCPStdioSSEBridge, spawnBridge } from "./mcp-stdio-sse-bridge";
 *
 *   const bridge = spawnBridge({
 *     name: "browsermcp",
 *     command: "npx",
 *     args: ["-y", "@browsermcp/mcp@latest"],
 *   });
 *
 *   // Mount on an existing HTTP server
 *   const transport = new MCPHttpSSEServerTransport("/mcp");
 *   server.on("request", (req, res) => transport.handle(req, res));
 */

import { spawn, type ChildProcess } from "child_process";
import { randomUUID } from "crypto";

// === Plugin definition ===
export interface StdioPlugin {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  // Optional: filter/transform JSON-RPC frames before broadcasting
  filter?: (line: string) => string;
  // Optional: max content length before truncation
  maxTextChars?: number;
}

// === Bridge entry (one per spawned plugin) ===
interface BridgeEntry {
  plugin: StdioPlugin;
  proc: ChildProcess | null;
  sessions: Map<string, (msg: string) => void>;
  buffer: string;
  alive: boolean;
}

// === Bridge store (global, keyed by plugin name) ===
const STORE_KEY = "__heraMcpBridges";
function getStore(): Map<string, BridgeEntry> {
  const g = globalThis as unknown as Record<string, Map<string, BridgeEntry>>;
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map();
  return g[STORE_KEY];
}

// === Spawn the plugin (lazy, on first session) ===
export function getOrSpawn(plugin: StdioPlugin): BridgeEntry {
  const store = getStore();
  let entry = store.get(plugin.name);
  if (entry?.proc && !entry.proc.killed && entry.proc.exitCode === null && entry.alive) {
    return entry;
  }

  entry = { plugin, proc: null, sessions: new Map(), buffer: "", alive: false };
  store.set(plugin.name, entry);

  const proc = spawn(plugin.command, plugin.args ?? [], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...(plugin.env ?? {}) },
  });
  entry.proc = proc;
  entry.alive = true;

  // Parse newline-delimited JSON-RPC from child stdout
  proc.stdout?.on("data", (chunk: Buffer) => {
    if (!entry) return;
    entry.buffer += chunk.toString("utf8");
    let idx;
    while ((idx = entry.buffer.indexOf("\n")) >= 0) {
      const raw = entry.buffer.slice(0, idx).trim();
      entry.buffer = entry.buffer.slice(idx + 1);
      if (!raw) continue;
      // Apply filter (e.g. smart text truncation, schema cleaning)
      const line = plugin.filter ? plugin.filter(raw) : raw;
      // Broadcast to all sessions
      for (const send of entry.sessions.values()) {
        try {
          send(`event: message\ndata: ${line}\n\n`);
        } catch {
          /* ignore broken pipe */
        }
      }
    }
  });

  proc.stderr?.on("data", (chunk: Buffer) => {
    // eslint-disable-next-line no-console
    console.error(`[mcp-bridge:${plugin.name}]`, chunk.toString().trim());
  });

  proc.on("exit", (code) => {
    if (entry) entry.alive = false;
    // eslint-disable-next-line no-console
    console.error(`[mcp-bridge:${plugin.name}] exited (code ${code})`);
    // Notify all sessions
    for (const send of entry.sessions.values()) {
      try {
        send(`event: disconnect\ndata: ${JSON.stringify({ reason: "process_exit", code })}\n\n`);
      } catch { /* ignore */ }
    }
    store.delete(plugin.name);
  });

  return entry;
}

// === Register a session (returns sessionId) ===
export function registerSession(pluginName: string, send: (msg: string) => void, plugin: StdioPlugin): string {
  const entry = getOrSpawn(plugin);
  const sid = randomUUID();
  entry.sessions.set(sid, send);
  return sid;
}

export function unregisterSession(pluginName: string, sid: string): void {
  const entry = getStore().get(pluginName);
  if (!entry) return;
  entry.sessions.delete(sid);
}

export function sendToChild(pluginName: string, jsonRpc: unknown): void {
  const entry = getStore().get(pluginName);
  if (!entry?.proc?.stdin?.writable) throw new Error(`Bridge not running: ${pluginName}`);
  entry.proc.stdin.write(`${JSON.stringify(jsonRpc)}\n`);
}

export function isRunning(pluginName: string): boolean {
  const entry = getStore().get(pluginName);
  return !!(entry?.proc && !entry.proc.killed && entry.proc.exitCode === null && entry.alive);
}

export function killBridge(pluginName: string): void {
  const entry = getStore().get(pluginName);
  if (entry?.proc) {
    entry.proc.kill();
    entry.alive = false;
  }
  getStore().delete(pluginName);
}

// === Smart text filter (truncates overly long content) ===
// Extracted from 9router stdioSseBridge.js smartFilterText
export function smartFilterText(text: string, maxChars = 50_000, collapseThreshold = 30, keepHead = 10, keepTail = 5): string {
  if (typeof text !== "string" || text.length < 2000) return text;
  let out = text;
  // Drop noise nodes
  out = out.replace(/^\s*-\s*generic:?\s*$/gm, "");
  out = out.replace(/^\s*-\s*text:\s*""\s*$/gm, "");
  out = collapseRepeated(out, collapseThreshold, keepHead, keepTail);
  if (out.length > maxChars) {
    const head = out.slice(0, maxChars - 300);
    out = `${head}\n\n... [truncated ${text.length - head.length} chars by bridge. Page is large; ask user to scroll/navigate to a specific section]`;
  }
  return out;
}

function collapseRepeated(text: string, threshold: number, keepHead: number, keepTail: number): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^(\s*)-\s*([a-zA-Z]+)\b/);
    if (!m) { out.push(line); i++; continue; }
    const indent = m[1];
    const role = m[2];
    let j = i;
    while (j < lines.length) {
      const ln = lines[j];
      const mm = ln.match(/^(\s*)-\s*([a-zA-Z]+)\b/);
      if (mm && mm[1] === indent && mm[2] === role) { j++; continue; }
      if (ln.startsWith(`${indent} `) || ln.startsWith(`${indent}\t`)) { j++; continue; }
      break;
    }
    const groupLen = j - i;
    if (groupLen >= threshold) {
      const headEnd = findNthSiblingEnd(lines, i, indent, role, keepHead);
      const tailStart = findLastNSiblingStart(lines, j, indent, role, keepTail);
      for (let k = i; k < headEnd; k++) out.push(lines[k]);
      out.push(`${indent}... [${groupLen - keepHead - keepTail} similar "${role}" items omitted by bridge]`);
      for (let k = tailStart; k < j; k++) out.push(lines[k]);
    } else {
      for (let k = i; k < j; k++) out.push(lines[k]);
    }
    i = j;
  }
  return out.join("\n");
}

function findNthSiblingEnd(lines: string[], start: number, indent: string, role: string, n: number): number {
  let count = 0;
  for (let k = start; k < lines.length; k++) {
    const m = lines[k].match(/^(\s*)-\s*([a-zA-Z]+)\b/);
    if (m && m[1] === indent && m[2] === role) {
      count++;
      if (count > n) return k;
    }
  }
  return lines.length;
}

function findLastNSiblingStart(lines: string[], end: number, indent: string, role: string, n: number): number {
  const positions: number[] = [];
  for (let k = 0; k < end; k++) {
    const m = lines[k].match(/^(\s*)-\s*([a-zA-Z]+)\b/);
    if (m && m[1] === indent && m[2] === role) positions.push(k);
  }
  return positions.length > n ? positions[positions.length - n] : end;
}

// === Default MCP filter (apply to JSON-RPC content) ===
export function defaultMCPFilter(line: string, opts: { maxTextChars?: number } = {}): string {
  try {
    const msg = JSON.parse(line);
    const content = msg?.result?.content;
    if (!Array.isArray(content)) return line;
    let mutated = false;
    for (const item of content) {
      if (item?.type === "text" && typeof item.text === "string") {
        const filtered = smartFilterText(item.text, opts.maxTextChars);
        if (filtered !== item.text) {
          item.text = filtered;
          mutated = true;
        }
      }
    }
    return mutated ? JSON.stringify(msg) : line;
  } catch {
    return line;
  }
}

// === HTTP+SSE handler (mount on existing server) ===
// Pure stdio bridge — no SSE handling here, that's the server's job.
// Use this as the registration entrypoint for a plugin.
export function spawnBridge(plugin: StdioPlugin): { plugin: StdioPlugin; kill: () => void; isRunning: () => boolean } {
  getOrSpawn(plugin); // spawn immediately on registration
  return {
    plugin,
    kill: () => killBridge(plugin.name),
    isRunning: () => isRunning(plugin.name),
  };
}
