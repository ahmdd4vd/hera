/**
 * mcp-marketplace.ts
 *
 * MCP server marketplace — catalog of public MCP servers with metadata,
 * search, filter, tool preview, and local installation tracking.
 *
 * Extracted from 9router src/shared/constants/coworkPlugins.js +
 * src/shared/components/McpMarketplaceModal.js
 *
 * Usage:
 *   import { MCPMarketplace, DEFAULT_MCP_REGISTRY, type MCPServerEntry } from "./mcp-marketplace";
 *
 *   const marketplace = new MCPMarketplace();
 *   await marketplace.loadRegistry();
 *   const filtered = marketplace.search("search", { authlessOnly: true });
 *   await marketplace.install("exa");  // saves to local config
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// === MCP server catalog entry ===
export interface MCPServerEntry {
  name: string;
  title: string;
  description: string;
  url?: string;                       // For HTTP/SSE transport: full URL. For stdio: empty/undefined.
  transport: "http" | "sse" | "stdio";
  oauth?: boolean;
  toolNames?: string[];              // Known tools (best guess)
  // For stdio plugins
  command?: string;
  args?: string[];
  extensionUrl?: string;             // Chrome extension URL etc.
  // Categorization
  category?: "search" | "browser" | "filesystem" | "database" | "communication" | "developer" | "ai" | "other";
  // Metadata
  homepage?: string;
  author?: string;
  iconUrl?: string;
}

// === Default registry (subset of known public MCP servers) ===
export const DEFAULT_MCP_REGISTRY: MCPServerEntry[] = [
  // === Search ===
  {
    name: "exa",
    title: "Exa",
    description: "Real-time web search and code documentation",
    url: "https://mcp.exa.ai/mcp",
    transport: "http",
    oauth: false,
    toolNames: ["web_search_exa", "web_fetch_exa", "company_research_exa", "crawling_exa"],
    category: "search",
    homepage: "https://exa.ai",
    author: "Exa",
  },
  {
    name: "tavily",
    title: "Tavily",
    description: "Real-time web search optimized for LLM agents",
    url: "https://mcp.tavily.com/mcp",
    transport: "http",
    oauth: true,
    toolNames: ["tavily_search", "tavily_extract", "tavily_crawl", "tavily_map"],
    category: "search",
    homepage: "https://tavily.com",
    author: "Tavily",
  },
  {
    name: "brave-search",
    title: "Brave Search",
    description: "Privacy-focused web search",
    url: "https://api.search.brave.com/mcp",
    transport: "http",
    oauth: false,
    toolNames: ["brave_search", "brave_news", "brave_local"],
    category: "search",
    homepage: "https://brave.com/search/api",
    author: "Brave",
  },
  {
    name: "kagi-search",
    title: "Kagi Search",
    description: "Premium ad-free web search",
    url: "https://kagi.com/mcp",
    transport: "sse",
    oauth: false,
    toolNames: ["kagi_search", "kagi_summarize"],
    category: "search",
    homepage: "https://kagi.com",
    author: "Kagi",
  },
  // === Browser ===
  {
    name: "browsermcp",
    title: "Browser MCP",
    description: "Control your running Chrome (requires Chrome extension)",
    extensionUrl: "https://chromewebstore.google.com/detail/browser-mcp-automate-your/bjfgambnhccakkhmkepdoekmckoijdlc",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@browsermcp/mcp@latest"],
    toolNames: ["browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_screenshot", "browser_get_console_logs", "browser_wait", "browser_press_key", "browser_go_back", "browser_go_forward"],
    category: "browser",
    author: "Browsermcp",
  },
  {
    name: "playwright-mcp",
    title: "Playwright",
    description: "Browser automation via Playwright",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@microsoft/playwright-mcp@latest"],
    toolNames: ["browser_navigate", "browser_click", "browser_type", "browser_screenshot", "browser_evaluate", "browser_pdf"],
    category: "browser",
    author: "Microsoft",
  },
  // === Filesystem ===
  {
    name: "filesystem",
    title: "Filesystem",
    description: "Read/write files and directories on local disk",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem@latest", "/tmp/mcp-workspace"],
    toolNames: ["read_file", "write_file", "list_directory", "create_directory", "move_file", "search_files", "get_file_info"],
    category: "filesystem",
    author: "Model Context Protocol",
  },
  {
    name: "github",
    title: "GitHub",
    description: "GitHub API integration (issues, PRs, repos)",
    url: "https://api.githubcopilot.com/mcp/",
    transport: "http",
    oauth: true,
    toolNames: ["list_repos", "get_repo", "create_issue", "list_pull_requests", "get_pull_request", "create_pull_request", "search_code", "get_file_contents"],
    category: "developer",
    homepage: "https://github.com",
    author: "GitHub",
  },
  {
    name: "gitlab",
    title: "GitLab",
    description: "GitLab API integration (issues, MRs, pipelines)",
    url: "https://gitlab.com/api/mcp",
    transport: "http",
    oauth: true,
    toolNames: ["list_projects", "get_project", "create_issue", "list_merge_requests", "get_merge_request", "create_merge_request", "get_pipeline"],
    category: "developer",
    homepage: "https://gitlab.com",
    author: "GitLab",
  },
  // === Database ===
  {
    name: "postgres",
    title: "PostgreSQL",
    description: "Query PostgreSQL databases (read-only by default)",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres@latest", "postgresql://localhost/mydb"],
    toolNames: ["query", "list_tables", "describe_table", "list_schemas"],
    category: "database",
    author: "Model Context Protocol",
  },
  {
    name: "sqlite",
    title: "SQLite",
    description: "Query SQLite databases",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-sqlite", "--db-path", "/tmp/db.sqlite"],
    toolNames: ["query", "list_tables", "describe_table"],
    category: "database",
    author: "Model Context Protocol",
  },
  // === Communication ===
  {
    name: "slack",
    title: "Slack",
    description: "Slack workspace integration (channels, messages, threads)",
    url: "https://mcp.slack.com/mcp",
    transport: "http",
    oauth: true,
    toolNames: ["list_channels", "post_message", "list_messages", "search_messages", "get_thread", "react_to_message"],
    category: "communication",
    homepage: "https://slack.com",
    author: "Slack",
  },
    // === Communication ===
  {
    name: "slack",
    title: "Slack",
    description: "Slack API (channels, messages, users)",
    url: "https://slack.com/api/mcp",
    transport: "http",
    oauth: true,
    toolNames: ["list_channels", "post_message", "list_users", "get_user", "search_messages", "react_to_message"],
    category: "communication",
    homepage: "https://slack.com",
    author: "Slack",
  },
  {
    name: "notion",
    title: "Notion",
    description: "Notion API (pages, databases, blocks)",
    url: "https://api.notion.com/mcp",
    transport: "http",
    oauth: true,
    toolNames: ["list_pages", "get_page", "create_page", "update_page", "search", "query_database"],
    category: "communication",
    homepage: "https://notion.so",
    author: "Notion",
  },
  // === AI ===
  {
    name: "replicate",
    title: "Replicate",
    description: "Run ML models on Replicate",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-replicate@latest"],
    toolNames: ["list_models", "get_model", "run_model", "list_predictions"],
    category: "ai",
    author: "Replicate",
  },
];

// === Marketplace ===
export interface MCPMarketplaceOptions {
  configPath?: string;               // Where to store installed servers
  registryUrl?: string;              // Optional: fetch remote registry
  registry?: MCPServerEntry[];       // Use custom registry
}

export interface MCPSearchOptions {
  query?: string;
  category?: MCPServerEntry["category"];
  transport?: MCPServerEntry["transport"];
  authlessOnly?: boolean;
  oauthOnly?: boolean;
  installedOnly?: boolean;
}

export class MCPMarketplace {
  private registry: MCPServerEntry[];
  private installed = new Set<string>();
  private configPath: string;
  private registryUrl?: string;

  constructor(opts: MCPMarketplaceOptions = {}) {
    this.registry = opts.registry ?? DEFAULT_MCP_REGISTRY;
    this.configPath = opts.configPath ?? join(process.cwd(), ".hera", "mcp-servers.json");
    this.registryUrl = opts.registryUrl;
    this.loadInstalled();
  }

  private loadInstalled(): void {
    if (!existsSync(this.configPath)) return;
    try {
      const data = JSON.parse(readFileSync(this.configPath, "utf-8")) as { installed?: string[] };
      this.installed = new Set(data.installed ?? []);
    } catch { /* ignore */ }
  }

  private saveInstalled(): void {
    const dir = join(this.configPath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.configPath, JSON.stringify({ installed: Array.from(this.installed) }, null, 2));
  }

  // === Optional: fetch remote registry (merges with default) ===
  async loadRegistry(): Promise<void> {
    if (!this.registryUrl) return;
    try {
      const res = await fetch(this.registryUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const data = (await res.json()) as { servers: MCPServerEntry[] };
      // Merge: remote entries override defaults by name
      const remoteMap = new Map(data.servers.map((s) => [s.name, s]));
      this.registry = this.registry.map((entry) => remoteMap.get(entry.name) ?? entry);
      // Add new entries from remote
      for (const s of data.servers) {
        if (!this.registry.find((e) => e.name === s.name)) this.registry.push(s);
      }
    } catch { /* ignore network errors */ }
  }

  // === Search/filter ===
  search(opts: MCPSearchOptions = {}): MCPServerEntry[] {
    return this.registry.filter((s) => {
      if (opts.query) {
        const q = opts.query.toLowerCase();
        const matches = (s.title ?? "").toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          (s.name ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (opts.category && s.category !== opts.category) return false;
      if (opts.transport && s.transport !== opts.transport) return false;
      if (opts.authlessOnly && s.oauth) return false;
      if (opts.oauthOnly && !s.oauth) return false;
      if (opts.installedOnly && !this.installed.has(s.name)) return false;
      return true;
    });
  }

  get(name: string): MCPServerEntry | undefined {
    return this.registry.find((s) => s.name === name);
  }

  listAll(): MCPServerEntry[] {
    return [...this.registry];
  }

  listInstalled(): MCPServerEntry[] {
    return this.registry.filter((s) => this.installed.has(s.name));
  }

  // === Install/uninstall ===
  install(name: string): MCPServerEntry {
    const entry = this.get(name);
    if (!entry) throw new Error(`Unknown MCP server: ${name}`);
    this.installed.add(name);
    this.saveInstalled();
    return entry;
  }

  uninstall(name: string): boolean {
    const ok = this.installed.delete(name);
    if (ok) this.saveInstalled();
    return ok;
  }

  isInstalled(name: string): boolean {
    return this.installed.has(name);
  }

  // === Build managedMcpServers config (compatible with Claude CLI) ===
  buildManagedConfig(plugins?: MCPServerEntry[]): Array<{ name: string; url?: string; transport?: string; command?: string; args?: string[]; oauth?: boolean; toolPolicy?: Record<string, string> }> {
    const list = plugins ?? this.listInstalled();
    const out: Array<{ name: string; url?: string; transport?: string; command?: string; args?: string[]; oauth?: boolean; toolPolicy?: Record<string, string> }> = [];
    const seen = new Set<string>();
    for (const p of list) {
      if (!p.name || seen.has(p.name)) continue;
      seen.add(p.name);
      const entry: { name: string; url?: string; transport?: string; command?: string; args?: string[]; oauth?: boolean; toolPolicy?: Record<string, string> } = { name: p.name };
      if (p.transport === "stdio") {
        entry.command = p.command;
        entry.args = p.args;
      } else {
        entry.url = p.url;
        entry.transport = p.transport;
      }
      if (p.oauth) entry.oauth = true;
      // Build tool policy (allow all known tools, both bare and prefixed)
      if (p.toolNames && p.toolNames.length > 0) {
        const prefix = `${p.name}-`;
        const bare = new Set<string>();
        for (const raw of p.toolNames) {
          let t = raw;
          while (t.startsWith(prefix)) t = t.slice(prefix.length);
          bare.add(t);
        }
        const policy: Record<string, string> = {};
        for (const t of bare) {
          policy[t] = "allow";
          policy[`${prefix}${t}`] = "allow";
        }
        entry.toolPolicy = policy;
      }
      out.push(entry);
    }
    return out;
  }
}
