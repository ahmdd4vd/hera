/**
 * mcp-client.ts
 *
 * Model Context Protocol (MCP) client. Connect to any MCP server
 * (stdio or HTTP+SSE transport), list tools, call tools.
 *
 * Spec: https://spec.modelcontextprotocol.io/
 *
 * Usage:
 *   import { MCPClient, MCPHttpTransport, MCPStdioTransport } from "./mcp-client";
 *
 *   const client = new MCPClient({
 *     name: "my-agent",
 *     version: "1.0.0",
 *   });
 *
 *   // Connect to remote MCP server (SSE transport)
 *   const remote = await client.connect(new MCPHttpTransport("https://mcp.exa.ai/mcp"));
 *
 *   // Connect to local stdio MCP server
 *   const local = await client.connect(new MCPStdioTransport("npx", ["-y", "@browsermcp/mcp@latest"]));
 *
 *   // List tools
 *   const tools = await remote.listTools();
 *
 *   // Call a tool
 *   const result = await remote.callTool("search", { query: "AI news" });
 */

// === JSON-RPC 2.0 types ===
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

// Standard JSON-RPC error codes
export const RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

// === MCP protocol types ===
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    [k: string]: unknown;
  };
}

export interface MCPCallResult {
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string } | { type: "resource"; uri: string; text?: string; mimeType?: string }>;
  isError?: boolean;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion?: string;
  capabilities?: Record<string, unknown>;
}

export interface MCPClientInfo {
  name: string;
  version: string;
}

// === Transport interface ===
export interface MCPTransport {
  // Send JSON-RPC message to server
  send(message: JsonRpcRequest | JsonRpcNotification): Promise<void>;
  // Receive JSON-RPC messages from server (stream)
  onMessage(handler: (msg: JsonRpcResponse | JsonRpcNotification) => void): void;
  // Close connection
  close(): Promise<void>;
  // Optional: is this transport alive?
  isOpen?(): boolean;
}

// === HTTP+SSE Transport (remote MCP servers) ===
// The MCP spec uses HTTP POST for client→server and SSE for server→client
// Some servers also support a pure HTTP mode (POST returns the response directly)
export class MCPHttpTransport implements MCPTransport {
  private url: string;
  private messageHandlers: Array<(msg: JsonRpcResponse | JsonRpcNotification) => void> = [];
  private eventSource: EventSource | null = null;
  private open = false;
  private headers: Record<string, string>;

  constructor(url: string, headers: Record<string, string> = {}) {
    this.url = url;
    this.headers = headers;
  }

  async send(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...this.headers },
      body: JSON.stringify(message),
    });
    if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${await res.text()}`);
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      // SSE response — parse and emit each event as a message
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
          if (dataLine) {
            try {
              const msg = JSON.parse(dataLine.slice(6));
              for (const h of this.messageHandlers) h(msg);
            } catch { /* ignore */ }
          }
        }
      }
    } else {
      // JSON response
      try {
        const msg = await res.json();
        for (const h of this.messageHandlers) h(msg);
      } catch { /* ignore */ }
    }
  }

  onMessage(handler: (msg: JsonRpcResponse | JsonRpcNotification) => void): void {
    this.messageHandlers.push(handler);
  }

  async close(): Promise<void> {
    this.open = false;
    if (this.eventSource) this.eventSource.close();
  }

  isOpen(): boolean {
    return this.open;
  }
}

// === stdio Transport (local MCP servers) ===
// Spawn a child process and communicate via stdin/stdout (newline-delimited JSON-RPC)
export class MCPStdioTransport implements MCPTransport {
  private command: string;
  private args: string[];
  private env?: Record<string, string>;
  private proc: ReturnType<typeof import("child_process").spawn> | null = null;
  private messageHandlers: Array<(msg: JsonRpcResponse | JsonRpcNotification) => void> = [];
  private buffer = "";

  constructor(command: string, args: string[] = [], env?: Record<string, string>) {
    this.command = command;
    this.args = args;
    this.env = env;
  }

  async start(): Promise<void> {
    const { spawn } = await import("child_process");
    this.proc = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.env },
    });
    this.proc.stdout?.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString("utf8");
      let idx;
      while ((idx = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          for (const h of this.messageHandlers) h(msg);
        } catch { /* ignore parse error */ }
      }
    });
    this.proc.stderr?.on("data", (chunk: Buffer) => {
      // Forward stderr to console for debugging
      // eslint-disable-next-line no-console
      console.error(`[mcp-stdio:${this.command}]`, chunk.toString().trim());
    });
    this.proc.on("exit", (code) => {
      // eslint-disable-next-line no-console
      console.error(`[mcp-stdio:${this.command}] exited with code ${code}`);
    });
  }

  async send(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    if (!this.proc?.stdin?.writable) {
      if (!this.proc) await this.start();
      if (!this.proc?.stdin?.writable) throw new Error("stdio process not running");
    }
    this.proc!.stdin.write(`${JSON.stringify(message)}\n`);
  }

  onMessage(handler: (msg: JsonRpcResponse | JsonRpcNotification) => void): void {
    this.messageHandlers.push(handler);
  }

  async close(): Promise<void> {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }
}

// === Connected MCP session (one per server) ===
export class MCPSession {
  private transport: MCPTransport;
  private clientInfo: MCPClientInfo;
  private nextId = 1;
  private pending = new Map<number | string, { resolve: (v: unknown) => void; reject: (e: Error) => void; method: string }>();
  private serverInfo: MCPServerInfo | null = null;

  constructor(transport: MCPTransport, clientInfo: MCPClientInfo) {
    this.transport = transport;
    this.clientInfo = clientInfo;
    this.transport.onMessage((msg) => this.handleMessage(msg));
  }

  private handleMessage(msg: JsonRpcResponse | JsonRpcNotification): void {
    if ("id" in msg && msg.id !== undefined) {
      // Response to a request
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`MCP ${p.method} failed: ${msg.error.message} (code ${msg.error.code})`));
        else p.resolve(msg.result);
      }
    } else {
      // Notification (no id) — server-pushed
      // For now, ignore. Could be `notifications/tools/list_changed` etc.
    }
  }

  private request<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, method });
      this.transport
        .send({ jsonrpc: "2.0", id, method, params })
        .catch((err) => {
          this.pending.delete(id);
          reject(err);
        });
    });
  }

  // === Initialize the MCP session (MUST be called first) ===
  async initialize(): Promise<MCPServerInfo> {
    const result = await this.request<MCPServerInfo>("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: this.clientInfo,
    });
    this.serverInfo = result;
    // Send initialized notification
    await this.transport.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    return result;
  }

  // === List available tools ===
  async listTools(): Promise<MCPTool[]> {
    const result = await this.request<{ tools: MCPTool[] }>("tools/list");
    return result.tools;
  }

  // === Call a tool ===
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<MCPCallResult> {
    return this.request<MCPCallResult>("tools/call", { name, arguments: args });
  }

  // === Optional: list resources / prompts ===
  async listResources(): Promise<Array<{ uri: string; name: string; description?: string; mimeType?: string }>> {
    const result = await this.request<{ resources: Array<{ uri: string; name: string; description?: string; mimeType?: string }> }>("resources/list");
    return result.resources;
  }

  async listPrompts(): Promise<Array<{ name: string; description?: string; arguments?: unknown[] }>> {
    const result = await this.request<{ prompts: Array<{ name: string; description?: string; arguments?: unknown[] }> }>("prompts/list");
    return result.prompts;
  }

  getServerInfo(): MCPServerInfo | null {
    return this.serverInfo;
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}

// === Multi-server client ===
export class MCPClient {
  private clientInfo: MCPClientInfo;
  private sessions = new Map<string, MCPSession>();

  constructor(clientInfo: MCPClientInfo = { name: "hera-mcp-client", version: "1.0.0" }) {
    this.clientInfo = clientInfo;
  }

  async connect(transport: MCPTransport, name?: string): Promise<MCPSession> {
    // Auto-start stdio transport if needed
    if (transport instanceof MCPStdioTransport) {
      await transport.start();
    }
    const session = new MCPSession(transport, this.clientInfo);
    await session.initialize();
    const key = name ?? `session-${this.sessions.size}`;
    this.sessions.set(key, session);
    return session;
  }

  async disconnect(name: string): Promise<void> {
    const session = this.sessions.get(name);
    if (session) {
      await session.close();
      this.sessions.delete(name);
    }
  }

  getSession(name: string): MCPSession | undefined {
    return this.sessions.get(name);
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  async closeAll(): Promise<void> {
    await Promise.all(Array.from(this.sessions.values()).map((s) => s.close()));
    this.sessions.clear();
  }
}
