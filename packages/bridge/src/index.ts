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

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
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
  const adbHost = arg("adb-host", "127.0.0.1")!;
  const adbPort = parseInt(arg("adb-port", "5037")!, 10);
  const serial = arg("serial");

  if (cmd === "mcp") {
    await startMcp(adbHost, adbPort, serial);
    return;
  }

  if (cmd === "bridge") {
    ensureAdbServer();
    const port = parseInt(arg("port", "8080")!, 10);
    const token = arg("token") ?? randomBytes(24).toString("hex");
    const here = dirname(fileURLToPath(import.meta.url));
    const webDir = join(here, "..", "..", "web"); // packages/web (dev) — override with --web-dir
    await startBridge({
      port,
      token,
      webDir: arg("web-dir", webDir)!,
      adbHost,
      adbPort,
      serial,
      frameIntervalMs: parseInt(arg("fps", "2")!, 10) > 0 ? Math.round(1000 / parseInt(arg("fps", "2")!, 10)) : 500,
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
