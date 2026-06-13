/**
 * Tests for full-agent tools (read, write, bash)
 *
 * Demonstrates how to test the Tool interface pattern from Hera:
 * tools are pure functions that take (args) and return a result.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createReadTool } from "../src/tools/read.js";
import { createWriteTool } from "../src/tools/write.js";
import { createBashTool } from "../src/tools/bash.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hera-tools-test-"));
});

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe("createReadTool", () => {
  it("has a name and description (Hera Tool contract)", () => {
    const tool = createReadTool(tmpDir);
    expect(tool.name).toBe("read");
    expect(tool.description).toBeTypeOf("string");
    expect(tool.description.length).toBeGreaterThan(0);
  });

  it("reads a file with line numbers", async () => {
    const tool = createReadTool(tmpDir);
    fs.writeFileSync(path.join(tmpDir, "hello.txt"), "line one\nline two\nline three");

    const result = (await tool.execute({ path: "hello.txt" })) as string;
    expect(result).toContain("1|line one");
    expect(result).toContain("2|line two");
    expect(result).toContain("3|line three");
  });

  it("respects offset and limit", async () => {
    const tool = createReadTool(tmpDir);
    const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join("\n");
    fs.writeFileSync(path.join(tmpDir, "big.txt"), lines);

    const result = (await tool.execute({
      path: "big.txt",
      offset: 10,
      limit: 3,
    })) as string;
    expect(result).toContain("10|line10");
    expect(result).toContain("11|line11");
    expect(result).toContain("12|line12");
    expect(result).not.toContain("9|line9");
  });

  it("throws on missing file", async () => {
    const tool = createReadTool(tmpDir);
    await expect(tool.execute({ path: "nonexistent.txt" })).rejects.toThrow(
      /File not found/
    );
  });

  it("sandbox: relative paths resolve inside cwd", async () => {
    const tool = createReadTool(tmpDir);
    fs.writeFileSync(path.join(tmpDir, "inside.txt"), "found me");
    const result = (await tool.execute({ path: "inside.txt" })) as string;
    expect(result).toContain("found me");
  });

  // KNOWN LIMITATION: the read tool uses path.resolve(cwd, args.path) which
  // does NOT block absolute paths pointing outside cwd. Reading /etc/passwd
  // succeeds. This is a security gap that hera-validate's "Tool execution
  // sandboxed" check is designed to flag — fix by adding explicit path
  // validation before fs.readFileSync.
  it("KNOWN ISSUE: absolute paths outside cwd are NOT blocked", async () => {
    const tool = createReadTool(tmpDir);
    // Documents the current behavior; fix tracked separately
    const result = await tool.execute({ path: "/etc/hostname" });
    expect(result).toBeTypeOf("string");
    // Should fail when sandbox is properly implemented
  });
});

describe("createWriteTool", () => {
  it("writes a new file", async () => {
    const tool = createWriteTool(tmpDir);
    const result = await tool.execute({
      path: "out.txt",
      content: "hello world",
    });
    expect(result).toContain("out.txt");
    const written = fs.readFileSync(path.join(tmpDir, "out.txt"), "utf-8");
    expect(written).toBe("hello world");
  });

  it("creates intermediate directories", async () => {
    const tool = createWriteTool(tmpDir);
    await tool.execute({
      path: "nested/dir/file.txt",
      content: "deep",
    });
    expect(fs.existsSync(path.join(tmpDir, "nested", "dir", "file.txt"))).toBe(true);
  });

  it("overwrites existing files", async () => {
    const tool = createWriteTool(tmpDir);
    fs.writeFileSync(path.join(tmpDir, "a.txt"), "old");
    await tool.execute({ path: "a.txt", content: "new" });
    const content = fs.readFileSync(path.join(tmpDir, "a.txt"), "utf-8");
    expect(content).toBe("new");
  });
});

describe("createBashTool", () => {
  it("executes a simple command", async () => {
    const tool = createBashTool(tmpDir);
    const result = (await tool.execute({ command: "echo hello" })) as string;
    expect(result.trim()).toBe("hello");
  });

  it("respects cwd (sandboxed)", async () => {
    const tool = createBashTool(tmpDir);
    const result = (await tool.execute({ command: "pwd" })) as string;
    // Real path may have /private prefix on macOS; check suffix
    expect(result.trim()).toContain(path.basename(tmpDir));
  });

  it("handles non-zero exit codes gracefully (no throw)", async () => {
    const tool = createBashTool(tmpDir);
    const result = (await tool.execute({ command: "exit 1" })) as string;
    // Bash tool returns stderr+stdout+exit code, doesn't throw
    expect(result).toContain("Exit code");
    expect(result).toContain("1");
  });

  it("respects timeout", async () => {
    const tool = createBashTool(tmpDir);
    const result = (await tool.execute({
      command: "sleep 5",
      timeout: 100,
    })) as string;
    // Should be killed quickly
    expect(result).toMatch(/Exit code|timeout|killed|signal/i);
  });
});

describe("tool contract compliance", () => {
  it("all tools follow the same interface (name, description, execute)", () => {
    const tools = [createReadTool(tmpDir), createWriteTool(tmpDir), createBashTool(tmpDir)];
    for (const tool of tools) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("execute");
      expect(tool.execute).toBeTypeOf("function");
    }
  });
});
