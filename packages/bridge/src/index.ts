#!/usr/bin/env node
/**
 * webadb-agent — CLI
 *
 *   webadb-agent bridge [--port 8080] [--token …] [--serial …]
 *       Serve the web UI + agent REST API + screen WebSocket.
 *
 *   webadb-agent mcp [--serial …]
 *       Run the MCP server on stdio for local AI agents.
 */
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startBridge } from "./server.js";
import { startMcp } from "./mcp.js";

function opt(cliName: string, envName: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${cliName}`);
  if (i >= 0 && i + 1 < process.argv.length && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1];
  }
  return process.env[envName] ?? def;
}

function ensureAdbServer(): void {
  const probe = spawnSync("adb", ["start-server"], { stdio: "ignore" });
  if (probe.error) {
    console.warn(
      "[webadb-agent] `adb` not found on PATH. Install Android platform-tools, " +
        "then run `adb start-server` before starting the bridge."
    );
  }
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "bridge";
  // CLI flags win; env vars (WEBADB_*/ADB_*) are the Docker-friendly fallback.
  const adbHost = opt("adb-host", "ADB_HOST", "127.0.0.1")!;
  const adbPort = parseInt(opt("adb-port", "ADB_PORT", "5037")!, 10);
  const serial = opt("serial", "WEBADB_SERIAL");

  if (cmd === "mcp") {
    await startMcp(adbHost, adbPort, serial);
    return;
  }

  if (cmd === "bridge") {
    const localAdb = ["127.0.0.1", "localhost", "::1"].includes(adbHost);
    if (!localAdb) {
      console.log(`[webadb-agent] using adb server at ${adbHost}:${adbPort} (skipping local adb start)`);
    } else if (process.env.WEBADB_SKIP_ADB_START !== "1") {
      ensureAdbServer();
    }
    const port = parseInt(opt("port", "WEBADB_PORT", "8080")!, 10);
    const token = opt("token", "WEBADB_TOKEN") ?? randomBytes(24).toString("hex");
    const here = dirname(fileURLToPath(import.meta.url));
    const webDir = join(here, "..", "..", "web"); // packages/web (dev) — override with --web-dir
    const fps = parseInt(opt("fps", "WEBADB_FPS", "2")!, 10);
    await startBridge({
      port,
      token,
      webDir: opt("web-dir", "WEBADB_WEB_DIR", webDir)!,
      adbHost,
      adbPort,
      serial,
      frameIntervalMs: fps > 0 ? Math.round(1000 / fps) : 500,
    });
    console.log(`[bridge] bearer token: ${token}`);
    console.log(`[bridge] keep this token secret — anyone with it can control your phone.`);
    return;
  }

  console.error("Usage: webadb-agent [bridge|mcp] [options]");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
