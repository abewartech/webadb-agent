/**
 * HTTP server: serves the web UI, exposes the agent REST API,
 * and streams live screen frames over WebSocket.
 *
 * Auth: `Authorization: Bearer <token>` for /api/*.
 *       `?token=` query param for /ws/screen (browsers can't set WS headers).
 */
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { AdbManager } from "./adb.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

export interface BridgeOptions {
  port: number;
  token: string;
  webDir: string;
  adbHost: string;
  adbPort: number;
  serial?: string;
  frameIntervalMs: number;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  return raw ? JSON.parse(raw) : {};
}

export async function startBridge(opts: BridgeOptions): Promise<void> {
  const adb = new AdbManager(opts.adbHost, opts.adbPort);

  // Best effort: auto-connect on boot so the UI/API works immediately.
  try {
    await adb.checkServer();
    const dev = await adb.connect(opts.serial);
    console.log(`[bridge] connected to ${dev.serial}`);
  } catch (e: any) {
    console.warn(`[bridge] no device yet: ${e.message}`);
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      // ---- static web UI (no auth: token is entered in the page) ----
      if (!url.pathname.startsWith("/api/") && !url.pathname.startsWith("/ws/")) {
        let file = url.pathname === "/" ? "/index.html" : url.pathname;
        const safe = normalize(file).replace(/^(\.\.[/\\])+/, "");
        try {
          const data = await readFile(join(opts.webDir, safe));
          res.writeHead(200, { "Content-Type": MIME[extname(safe)] ?? "application/octet-stream" });
          res.end(data);
        } catch {
          json(res, 404, { error: "not found" });
        }
        return;
      }

      // ---- auth for API ----
      const auth = req.headers.authorization ?? "";
      if (auth !== `Bearer ${opts.token}`) {
        json(res, 401, { error: "unauthorized: bad or missing bearer token" });
        return;
      }

      // ---- REST API ----
      if (url.pathname === "/api/health" && req.method === "GET") {
        return json(res, 200, { ok: true, device: adb.connectedSerial });
      }
      if (url.pathname === "/api/devices" && req.method === "GET") {
        return json(res, 200, { devices: await adb.listDevices() });
      }
      if (url.pathname === "/api/connect" && req.method === "POST") {
        const body = await readBody(req);
        return json(res, 200, { device: await adb.connect(body.serial) });
      }
      if (url.pathname === "/api/info" && req.method === "GET") {
        return json(res, 200, await adb.info());
      }
      if (url.pathname === "/api/screenshot" && req.method === "GET") {
        const png = await adb.screenshot();
        res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length });
        return res.end(png);
      }
      if (url.pathname === "/api/tap" && req.method === "POST") {
        const { x, y } = await readBody(req);
        if (typeof x !== "number" || typeof y !== "number") return json(res, 400, { error: "x, y required" });
        await adb.tap(x, y);
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/swipe" && req.method === "POST") {
        const { x1, y1, x2, y2, duration_ms } = await readBody(req);
        await adb.swipe(x1, y1, x2, y2, duration_ms ?? 300);
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/key" && req.method === "POST") {
        const { code } = await readBody(req);
        if (code === undefined) return json(res, 400, { error: "code required" });
        await adb.key(code);
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/text" && req.method === "POST") {
        const { text } = await readBody(req);
        if (typeof text !== "string") return json(res, 400, { error: "text required" });
        await adb.text(text);
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/shell" && req.method === "POST") {
        const { command } = await readBody(req);
        if (typeof command !== "string" || !command.trim()) return json(res, 400, { error: "command required" });
        return json(res, 200, await adb.shell(command));
      }
      if (url.pathname === "/api/open" && req.method === "POST") {
        const { package: pkg } = await readBody(req);
        if (typeof pkg !== "string") return json(res, 400, { error: "package required" });
        return json(res, 200, await adb.openApp(pkg));
      }
      return json(res, 404, { error: "unknown endpoint" });
    } catch (e: any) {
      json(res, 500, { error: e.message ?? String(e) });
    }
  });

  // ---- live screen over WebSocket ----
  const wss = new WebSocketServer({ server, path: "/ws/screen" });
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const token = new URL(req.url ?? "/", "http://localhost").searchParams.get("token");
    if (token !== opts.token) {
      ws.close(4401, "unauthorized");
      return;
    }
    let alive = true;
    ws.on("close", () => (alive = false));
    (async () => {
      while (alive && ws.readyState === WebSocket.OPEN) {
        try {
          const frame = await adb.screenshot();
          if (ws.bufferedAmount < 2 * 1024 * 1024) ws.send(frame);
        } catch {
          /* device may be temporarily busy; keep streaming */
        }
        await new Promise((r) => setTimeout(r, opts.frameIntervalMs));
      }
    })();
  });

  server.listen(opts.port, () => {
    console.log(`[bridge] web UI  → http://localhost:${opts.port}/`);
    console.log(`[bridge] REST    → http://localhost:${opts.port}/api/*`);
    console.log(`[bridge] screen  → ws://localhost:${opts.port}/ws/screen?token=…`);
  });
}
