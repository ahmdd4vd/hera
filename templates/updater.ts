/**
 * updater.ts
 *
 * Self-updater for npm-installed CLI tools. Version check + detached
 * updater process + status reporting + app relaunch.
 *
 * Source: 9router src/lib/updater/updater.js (235 lines) +
 * src/lib/appUpdater.js (200 lines) + src/app/api/version/route.js (45 lines)
 *
 * Usage:
 *   import { Updater, versionChecker, killAppProcesses, spawnUpdater } from "./updater";
 *
 *   // 1. Check for updates
 *   const status = await versionChecker("9router", "2.15.0");
 *   if (status.hasUpdate) {
 *     console.log(`Update available: ${status.latestVersion}`);
 *
 *     // 2. Kill sibling processes (release file locks on Windows)
 *     await killAppProcesses();
 *
 *     // 3. Spawn detached updater + exit
 *     spawnUpdater({
 *       packageName: "9router",
 *       currentVersion: "2.15.0",
 *       relaunchCmd: "npx",
 *       relaunchArgs: ["9router"],
 *     });
 *     process.exit(0);
 *   }
 */

import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, copyFileSync } from "fs";
import { join } from "path";
import { homedir, platform } from "os";
import https from "https";

// ============================================================================
// CONFIG
// ============================================================================

export interface UpdaterConfig {
  packageName: string;                // npm package name (e.g. "9router")
  currentVersion: string;            // current installed version
  dataDir?: string;                  // for state persistence (default ~/.hera/update)
  statusPort?: number;                // HTTP port for status server (default 20129)
  appPort?: number;                   // app's HTTP port to wait for free
  maxRetries?: number;               // npm install retries (default 3)
  retryDelayMs?: number;             // delay between retries (default 5_000)
  lingerAfterDoneMs?: number;        // how long to keep status server alive after done (default 30_000)
  waitForExitMinMs?: number;         // min wait for app to exit (default 5_000)
  waitForExitMaxMs?: number;         // max wait for app port to free up (default 20_000)
  waitCheckMs?: number;              // poll interval for app port (default 500)
  statusLogTailLines?: number;       // how many log lines to keep in status (default 8)
  installCmd?: string;               // override install command (default: "npm i -g <pkg> --prefer-online")
  logFile?: string;                  // path to write logs
  relaunchCmd?: string;              // command to relaunch app after update
  relaunchArgs?: string[];           // args for relaunch
  openBrowserOnReady?: boolean;      // open dashboard when app is ready (default true)
  appUrl?: string;                   // URL to open (default http://localhost:appPort/dashboard)
}

export const DEFAULT_UPDATER_CONFIG: Required<Omit<UpdaterConfig, "relaunchCmd" | "relaunchArgs" | "appUrl">> = {
  packageName: "9router",
  currentVersion: "0.0.0",
  dataDir: "",
  statusPort: 20129,
  appPort: 20128,
  maxRetries: 3,
  retryDelayMs: 5_000,
  lingerAfterDoneMs: 30_000,
  waitForExitMinMs: 5_000,
  waitForExitMaxMs: 20_000,
  waitCheckMs: 500,
  statusLogTailLines: 8,
  installCmd: "",
  logFile: "",
  openBrowserOnReady: true,
};

// ============================================================================
// STATE PERSISTENCE
// ============================================================================

export type UpdatePhase = "starting" | "waitingForExit" | "installing" | "retrying" | "done" | "error";

export interface UpdateState {
  phase: UpdatePhase;
  packageName: string;
  currentVersion: string;
  startedAt: number;
  finishedAt: number | null;
  attempt: number;
  maxRetries: number;
  done: boolean;
  success: boolean;
  exitCode: number | null;
  error: string | null;
  logTail: string[];
}

export function getDefaultDataDir(packageName: string): string {
  if (platform() === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), packageName);
  }
  return join(homedir(), `.${packageName}`);
}

export function getUpdateDir(config: UpdaterConfig): string {
  const dataDir = config.dataDir || getDefaultDataDir(config.packageName);
  return join(dataDir, "update");
}

export function getStatusFile(config: UpdaterConfig): string {
  return join(getUpdateDir(config), "status.json");
}

export function getLogFile(config: UpdaterConfig): string {
  return join(getUpdateDir(config), "install.log");
}

export function loadUpdateState(config: UpdaterConfig): UpdateState | null {
  const file = getStatusFile(config);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as UpdateState;
  } catch {
    return null;
  }
}

export function saveUpdateState(config: UpdaterConfig, state: UpdateState): void {
  const dir = getUpdateDir(config);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = getStatusFile(config);
  writeFileSync(file, JSON.stringify(state, null, 2));
}

export function appendLogLine(config: UpdaterConfig, line: string): void {
  const trimmed = line.replace(/\r?\n$/, "");
  if (!trimmed) return;
  const file = getLogFile(config);
  try {
    if (!existsSync(getUpdateDir(config))) mkdirSync(getUpdateDir(config), { recursive: true });
  } catch { /* ignore */ }
  try {
    // Use appendFileSync
    require("fs").appendFileSync(file, `${trimmed}\n`);
  } catch { /* ignore */ }
}

// ============================================================================
// VERSION CHECK
// ============================================================================

export interface VersionStatus {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  error?: string;
}

/**
 * Fetch latest version from npm registry
 * Uses native https module for zero-dep version check.
 */
export function fetchLatestVersion(packageName: string, timeoutMs = 4_000): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(`https://registry.npmjs.org/${packageName}/latest`, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.version ?? null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

/**
 * Compare two semver strings ("1.2.3" format).
 * Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

/**
 * Check if update is available
 */
export async function versionChecker(packageName: string, currentVersion: string): Promise<VersionStatus> {
  const latest = await fetchLatestVersion(packageName);
  if (!latest) {
    return { currentVersion, latestVersion: null, hasUpdate: false, error: "Failed to fetch latest version" };
  }
  return {
    currentVersion,
    latestVersion: latest,
    hasUpdate: compareVersions(latest, currentVersion) > 0,
  };
}

// ============================================================================
// PROCESS KILLER (release file locks before update)
// ============================================================================

/**
 * Kill all app-related processes to release file locks (especially on Windows).
 * Adapted from 9router appUpdater.js killAppProcesses.
 */
export async function killAppProcesses(appName = "hera"): Promise<{ killed: string[] }> {
  const pids = collectAppPids(appName);
  const isWin = platform() === "win32";

  for (const pid of pids) {
    try {
      if (isWin) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: "ignore", windowsHide: true, timeout: 3_000 } as any);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        execSync(`kill -9 ${pid} 2>/dev/null`, { stdio: "ignore", timeout: 3_000 } as any);
      }
    } catch { /* already dead */ }
  }

  if (pids.length > 0) {
    await new Promise((r) => setTimeout(r, 1_500));
  }
  return { killed: pids };
}

function collectAppPids(appName: string): string[] {
  const pids: string[] = [];
  const isWin = platform() === "win32";
  const appLower = appName.toLowerCase();

  try {
    if (isWin) {
      // PowerShell: get all node processes with command line
      const cmd = `powershell -NoProfile -NonInteractive -Command "Get-WmiObject Win32_Process -Filter 'Name=\\\"node.exe\\\"' | Select-Object ProcessId,CommandLine | ConvertTo-Csv -NoTypeInformation"`;
      const out = execSync(cmd, { encoding: "utf-8", windowsHide: true, timeout: 5_000 });
      for (const line of out.split("\n").slice(1)) {
        const lower = line.toLowerCase();
        if (lower.includes(appLower) || lower.includes("next-server") || lower.includes("cli.js")) {
          const m = line.match(/^"(\d+)"/);
          if (m && m[1] && m[1] !== process.pid.toString()) pids.push(m[1]);
        }
      }
    } else {
      const out = execSync("ps aux 2>/dev/null", { encoding: "utf-8", timeout: 5_000 });
      for (const line of out.split("\n")) {
        if (line.includes(appLower) || line.includes("next-server") || line.includes("/bin/app/") || line.includes("cli.js")) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[1];
          if (pid && !isNaN(Number(pid)) && pid !== process.pid.toString()) pids.push(pid);
        }
      }
    }
  } catch { /* no processes or ps error */ }
  return pids;
}

// ============================================================================
// SPAWN DETACHED UPDATER
// ============================================================================

/**
 * Spawn a detached updater process that runs `npm i -g <pkg>@latest` after
 * the current app exits. Then exit the current process.
 *
 * The updater process is the `runUpdater` function below, exported as a
 * standalone script via `getUpdaterScript()`.
 */
export function spawnUpdater(config: UpdaterConfig, opts: { exitDelayMs?: number } = {}): ChildProcess | null {
  const exitDelayMs = opts.exitDelayMs ?? 500;
  const updaterScript = getUpdaterScript();
  const isWin = platform() === "win32";

  // Write updater script to runtime dir (so npm can overwrite safely)
  const dataDir = config.dataDir || getDefaultDataDir(config.packageName);
  const runtimeDir = join(dataDir, "runtime", "updater");
  if (!existsSync(runtimeDir)) mkdirSync(runtimeDir, { recursive: true });
  const runtimePath = join(runtimeDir, "updater.js");
  writeFileSync(runtimePath, updaterScript);

  // Spawn detached
  const child = spawn(process.execPath, [runtimePath], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      UPDATER_PKG_NAME: config.packageName,
      UPDATER_PORT: String(config.statusPort ?? DEFAULT_UPDATER_CONFIG.statusPort),
      UPDATER_APP_PORT: String(config.appPort ?? DEFAULT_UPDATER_CONFIG.appPort),
      UPDATER_RETRIES: String(config.maxRetries ?? DEFAULT_UPDATER_CONFIG.maxRetries),
      UPDATER_RETRY_DELAY_MS: String(config.retryDelayMs ?? DEFAULT_UPDATER_CONFIG.retryDelayMs),
      UPDATER_LINGER_MS: String(config.lingerAfterDoneMs ?? DEFAULT_UPDATER_CONFIG.lingerAfterDoneMs),
      UPDATER_WAIT_MIN_MS: String(config.waitForExitMinMs ?? DEFAULT_UPDATER_CONFIG.waitForExitMinMs),
      UPDATER_WAIT_MAX_MS: String(config.waitForExitMaxMs ?? DEFAULT_UPDATER_CONFIG.waitForExitMaxMs),
      UPDATER_WAIT_CHECK_MS: String(config.waitCheckMs ?? DEFAULT_UPDATER_CONFIG.waitCheckMs),
      UPDATER_TAIL_LINES: String(config.statusLogTailLines ?? DEFAULT_UPDATER_CONFIG.statusLogTailLines),
      UPDATER_DATA_DIR: dataDir,
      UPDATER_RELAUNCH: config.relaunchCmd ? "1" : "",
      UPDATER_RELAUNCH_CMD: config.relaunchCmd ?? "",
      UPDATER_RELAUNCH_ARGS: JSON.stringify(config.relaunchArgs ?? []),
      UPDATER_APP_URL: config.appUrl ?? `http://localhost:${config.appPort ?? 20128}`,
      UPDATER_OPEN_BROWSER: config.openBrowserOnReady !== false ? "1" : "",
    },
  });
  child.unref();

  // Schedule exit
  setTimeout(() => process.exit(0), exitDelayMs);
  return child;
}

// ============================================================================
// DETACHED UPDATER PROCESS
// ============================================================================

import type { ChildProcess } from "child_process";

/**
 * Generate the standalone updater script. This script is spawned detached
 * and survives after the parent app exits. It:
 *   1. Starts HTTP status server (so browser can poll progress)
 *   2. Waits for app to fully exit
 *   3. Runs `npm i -g <pkg>@latest` (with retries)
 *   4. Optionally relaunches the app
 *   5. Lingers for status polling, then exits
 */
export function getUpdaterScript(): string {
  return `// Auto-generated updater process — DO NOT EDIT
// Generated from hera/templates/updater.ts
const { spawn, execSync } = require("child_process");
const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");
const os = require("os");

const packageName = process.env.UPDATER_PKG_NAME || "app";
const port = parseInt(process.env.UPDATER_PORT || "20129", 10);
const appPort = parseInt(process.env.UPDATER_APP_PORT || "20128", 10);
const tailLines = parseInt(process.env.UPDATER_TAIL_LINES || "8", 10);
const maxRetries = parseInt(process.env.UPDATER_RETRIES || "3", 10);
const retryDelayMs = parseInt(process.env.UPDATER_RETRY_DELAY_MS || "5000", 10);
const lingerMs = parseInt(process.env.UPDATER_LINGER_MS || "30000", 10);
const waitMinMs = parseInt(process.env.UPDATER_WAIT_MIN_MS || "5000", 10);
const waitMaxMs = parseInt(process.env.UPDATER_WAIT_MAX_MS || "20000", 10);
const waitCheckMs = parseInt(process.env.UPDATER_WAIT_CHECK_MS || "500", 10);
const dataDir = process.env.UPDATER_DATA_DIR || (process.platform === "win32" ? path.join(process.env.APPDATA || os.homedir(), packageName) : path.join(os.homedir(), "." + packageName));
const updateDir = path.join(dataDir, "update");
try { fs.mkdirSync(updateDir, { recursive: true }); } catch {}
const statusFile = path.join(updateDir, "status.json");
const logFile = path.join(updateDir, "install.log");

const state = {
  phase: "starting",
  packageName,
  currentVersion: process.env.UPDATER_CURRENT_VERSION || "unknown",
  startedAt: Date.now(),
  finishedAt: null,
  attempt: 0,
  maxRetries,
  done: false,
  success: false,
  exitCode: null,
  error: null,
  logTail: [],
};

function pushLog(line) {
  const trimmed = line.replace(/\\r?\\n$/, "");
  if (!trimmed) return;
  state.logTail.push(trimmed);
  if (state.logTail.length > tailLines) state.logTail = state.logTail.slice(-tailLines);
  try { fs.appendFileSync(logFile, trimmed + "\\n"); } catch {}
}

function persistStatus() {
  try { fs.writeFileSync(statusFile, JSON.stringify(state, null, 2)); } catch {}
}

function setPhase(phase) { state.phase = phase; persistStatus(); }

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.url === "/update/status" || req.url === "/") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(state));
    return;
  }
  res.statusCode = 404; res.end("not found");
});

server.on("error", (e) => { state.error = "status server error: " + e.message; persistStatus(); });

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function isAppPortBusy() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (busy) => { socket.destroy(); resolve(busy); };
    socket.setTimeout(300);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(appPort, "127.0.0.1");
  });
}

async function waitForAppExit() {
  setPhase("waitingForExit");
  pushLog("[updater] waiting for app to exit...");
  await sleep(waitMinMs);
  const deadline = Date.now() + (waitMaxMs - waitMinMs);
  while (Date.now() < deadline) {
    const busy = await isAppPortBusy();
    if (!busy) { pushLog("[updater] app port free, proceeding"); return; }
    await sleep(waitCheckMs);
  }
  pushLog("[updater] timeout waiting for app, proceeding anyway");
}

function runInstall() {
  state.attempt += 1;
  setPhase("installing");
  pushLog("[updater] attempt " + state.attempt + "/" + maxRetries + " — npm i -g " + packageName + " --prefer-online");
  const isWin = process.platform === "win32";
  const cmd = isWin ? "npm.cmd" : "npm";
  const args = ["i", "-g", packageName, "--prefer-online"];
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, shell: isWin });
  child.stdout.on("data", (buf) => { buf.toString().split(/\\r?\\n/).forEach(pushLog); persistStatus(); });
  child.stderr.on("data", (buf) => { buf.toString().split(/\\r?\\n/).forEach(pushLog); persistStatus(); });
  child.on("error", (e) => { pushLog("[updater] spawn error: " + e.message); finalize(false, null, e.message); });
  child.on("close", (code) => {
    pushLog("[updater] npm exited with code " + code);
    if (code === 0) { finalize(true, code, null); return; }
    if (state.attempt < maxRetries) {
      pushLog("[updater] retrying in " + Math.round(retryDelayMs / 1000) + "s...");
      setPhase("retrying");
      setTimeout(runInstall, retryDelayMs);
      return;
    }
    finalize(false, code, "Install failed after " + maxRetries + " attempts");
  });
}

function openBrowser(url) {
  const p = process.platform;
  const cmd = p === "darwin" ? \`open "\${url}"\` : p === "win32" ? \`start "" "\${url}"\` : \`xdg-open "\${url}"\`;
  try { spawn(cmd, { shell: true, detached: true, stdio: "ignore" }).unref(); } catch {}
}

async function waitForAppAndOpenBrowser() {
  if (process.env.UPDATER_OPEN_BROWSER !== "1") return;
  const url = process.env.UPDATER_APP_URL || \`http://localhost:\${appPort}/dashboard\`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const busy = await isAppPortBusy();
    if (busy) { openBrowser(url); pushLog("[updater] app ready, opened " + url); return; }
    await sleep(1000);
  }
  pushLog("[updater] app not responding within 30s, skip browser open");
}

function relaunchApp() {
  if (process.env.UPDATER_RELAUNCH !== "1") return;
  const cmd = process.env.UPDATER_RELAUNCH_CMD;
  if (!cmd) return;
  let args = [];
  try { args = JSON.parse(process.env.UPDATER_RELAUNCH_ARGS || "[]"); } catch {}
  const isWin = process.platform === "win32";
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true, shell: isWin });
    child.unref();
    pushLog("[updater] relaunched: " + cmd + " " + args.join(" ") + " (pid=" + child.pid + ")");
    waitForAppAndOpenBrowser();
  } catch (e) { pushLog("[updater] relaunch failed: " + e.message); }
}

function finalize(success, exitCode, error) {
  state.done = true;
  state.success = success;
  state.exitCode = exitCode;
  state.error = error;
  state.finishedAt = Date.now();
  setPhase(success ? "done" : "error");
  if (success) relaunchApp();
  setTimeout(() => { try { server.close(); } catch {} process.exit(success ? 0 : 1); }, lingerMs);
}

server.listen(port, "127.0.0.1", () => { persistStatus(); waitForAppExit().then(runInstall); });
`;
}

// ============================================================================
// HIGH-LEVEL API
// ============================================================================

/**
 * One-call update: check version, kill processes if needed, spawn updater.
 * The caller should call process.exit(0) after this returns (the updater
 * is detached and survives the parent process).
 */
export async function performUpdate(config: UpdaterConfig): Promise<{ hasUpdate: boolean; updaterSpawned: boolean; status: VersionStatus }> {
  const status = await versionChecker(config.packageName, config.currentVersion);
  if (!status.hasUpdate) {
    return { hasUpdate: false, updaterSpawned: false, status };
  }
  await killAppProcesses(config.packageName);
  spawnUpdater(config);
  return { hasUpdate: true, updaterSpawned: true, status };
}
