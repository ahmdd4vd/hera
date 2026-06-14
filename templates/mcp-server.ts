/**
 * mcp-server.ts
 *
 * Model Context Protocol (MCP) server. Expose your own tools as an MCP-compatible
 * endpoint that any MCP client (Claude Desktop, GPT, 9router, etc.) can connect to.
 *
 * Spec: https://spec.modelcontextprotocol.io/
 *
 * Usage:
 *   import { MCPServer, MCPHttpSSEServerTransport, MCPStdioServerTransport } from "./mcp-server";
 *
 *   const server = new MCPServer({ name: "my-tools", version: "1.0.0" });
 *
 *   server.registerTool({
 *     name: "get_weather",
 *     description: "Get current weather for a city",
 *     inputSchema: {
 *       type: "object",
 *       properties: { city: { type: "string", description: "City name" } },
 *       required: ["city"],
 *     },
 *     handler: async ({ city }) => ({ content: [{ type: "text", text: `Weather in ${city}: sunny, 72°F` }] }),
 *   });
 *
 *   // Expose via HTTP+SSE
 *   const httpTransport = new MCPHttpSSEServerTransport(server, { port: 3001 });
 *   await httpTransport.start();
 *
 *   // Or via stdio (for CLI tools)
 *   const stdioTransport = new MCPStdioServerTransport(server);
 *   await stdioTransport.start();
 */

import type { IncomingMessage, ServerResponse } from "http";

// === Tool definition ===
export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    [k: string]: unknown;
  };
  handler: (args: Record<string, unknown>) => Promise<MCPCallResult> | MCPCallResult;
}

export interface MCPCallResult {
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string } | { type: "resource"; uri: string; text?: string; mimeType?: string }>;
  isError?: boolean;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: { tools?: Record<string, unknown>; resources?: Record<string, unknown>; prompts?: Record<string, unknown> };
}

// === JSON-RPC types ===
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

// === Server ===
export class MCPServer {
  private info: MCPServerInfo;
  private tools = new Map<string, MCPToolDefinition>();
  private requestHandlers = new Map<string, (params: unknown) => Promise<unknown> | unknown>();

  constructor(info: Partial<MCPServerInfo> & { name: string; version: string }) {
    this.info = {
      name: info.name,
      version: info.version,
      protocolVersion: info.protocolVersion ?? "2024-11-05",
      capabilities: info.capabilities ?? { tools: {} },
    };

    // Built-in handlers
    this.requestHandlers.set("initialize", () => ({
      protocolVersion: this.info.protocolVersion,
      capabilities: this.info.capabilities,
      serverInfo: { name: this.info.name, version: this.info.version },
    }));

    this.requestHandlers.set("tools/list", () => ({
      tools: Array.from(this.tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }));

    this.requestHandlers.set("tools/call", async (params) => {
      const p = params as { name: string; arguments?: Record<string, unknown> };
      if (!p?.name) throw this.makeError(RPC_ERRORS.INVALID_PARAMS, "Missing tool name");
      const tool = this.tools.get(p.name);
      if (!tool) throw this.makeError(RPC_ERRORS.METHOD_NOT_FOUND, `Unknown tool: ${p.name}`);
      try {
        const result = await tool.handler(p.arguments ?? {});
        return result;
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    });

    this.requestHandlers.set("ping", () => ({}));
  }

  registerTool(tool: MCPToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  // === Handle a single JSON-RPC request ===
  async handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
      return { jsonrpc: "2.0", id: req.id, error: { code: RPC_ERRORS.INVALID_REQUEST, message: "Invalid JSON-RPC 2.0 request" } };
    }
    const handler = this.requestHandlers.get(req.method);
    if (!handler) {
      return { jsonrpc: "2.0", id: req.id, error: { code: RPC_ERRORS.METHOD_NOT_FOUND, message: `Unknown method: ${req.method}` } };
    }
    try {
      const result = await handler(req.params);
      return { jsonrpc: "2.0", id: req.id, result };
    } catch (err) {
      const e = err as { code?: number; message?: string; data?: unknown };
      if (typeof e.code === "number") {
        return { jsonrpc: "2.0", id: req.id, error: { code: e.code, message: e.message ?? "Error", data: e.data } };
      }
      return { jsonrpc: "2.0", id: req.id, error: { code: RPC_ERRORS.INTERNAL_ERROR, message: (err as Error).message ?? "Internal error" } };
    }
  }

  private makeError(code: number, message: string): { code: number; message: string } {
    return { code, message };
  }
}

// === Stdio Server Transport (for CLI tools) ===
export class MCPStdioServerTransport {
  private server: MCPServer;
  private buffer = "";

  constructor(server: MCPServer) {
    this.server = server;
  }

  async start(): Promise<void> {
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", async (chunk: string) => {
      this.buffer += chunk;
      let idx;
      while ((idx = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const req = JSON.parse(line) as JsonRpcRequest;
          // Notifications (no id) — don't reply
          if (req.id === undefined) {
            // Just call the handler, no response
            try { await this.server.handleRequest({ ...req, id: 0 }); } catch { /* ignore */ }
            continue;
          }
          const res = await this.server.handleRequest(req);
          process.stdout.write(`${JSON.stringify(res)}\n`);
        } catch (err) {
          const errRes: JsonRpcResponse = { jsonrpc: "2.0", id: 0, error: { code: RPC_ERRORS.PARSE_ERROR, message: (err as Error).message } };
          process.stdout.write(`${JSON.stringify(errRes)}\n`);
        }
      }
    });
    process.stdin.on("end", () => process.exit(0));
  }
}

// === HTTP+SSE Server Transport ===
// Mounts on an existing HTTP server (you bring the server)
export class MCPHttpSSEServerTransport {
  private server: MCPServer;
  private path: string;
  private sessions = new Map<string, { res: ServerResponse }>();

  constructor(server: MCPServer, opts: { path?: string } = {}) {
    this.server = server;
    this.path = opts.path ?? "/mcp";
  }

  // Returns true if this request was handled (caller should not respond further)
  async handleRequest(req: IncomingMessage, res: ServerResponse, url: string): Promise<boolean> {
    if (!url.startsWith(this.path)) return false;
    const subPath = url.slice(this.path.length).replace(/^\//, "");

    // GET /mcp → SSE stream (server-to-client)
    if (req.method === "GET" && (subPath === "" || subPath === "sse")) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      const sessionId = Math.random().toString(36).slice(2);
      this.sessions.set(sessionId, { res });
      // Tell client where to POST
      res.write(`event: endpoint\ndata: /mcp/message?sessionId=${sessionId}\n\n`);
      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
      }, 30_000);
      req.on("close", () => {
        clearInterval(heartbeat);
        this.sessions.delete(sessionId);
      });
      return true;
    }

    // POST /mcp/message?sessionId=XXX → client-to-server
    if (req.method === "POST" && subPath.startsWith("message")) {
      const urlObj = new URL(url, "http://localhost");
      const sessionId = urlObj.searchParams.get("sessionId");
      if (!sessionId) {
        res.writeHead(400);
        res.end("Missing sessionId");
        return true;
      }
      const session = this.sessions.get(sessionId);
      if (!session) {
        res.writeHead(404);
        res.end("Session not found");
        return true;
      }
      // Read body
      const body = await this.readBody(req);
      try {
        const rpcReq = JSON.parse(body) as JsonRpcRequest;
        const rpcRes = await this.server.handleRequest(rpcReq);
        // Send response as SSE event to that session
        session.res.write(`event: message\ndata: ${JSON.stringify(rpcRes)}\n\n`);
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ accepted: true }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
      return true;
    }

    return false;
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk: Buffer) => body += chunk.toString("utf8"));
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });
  }
}
