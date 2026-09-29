/**
 * MCP server (stdio) — lets local AI agents (Claude Code, Cursor, …)
 * drive the Android device through the same ADB layer as the bridge.
 *
 * Usage in an MCP client config:
 *   { "command": "node", "args": ["…/bridge/dist/index.js", "mcp"] }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AdbManager } from "./adb.js";

export async function startMcp(adbHost: string, adbPort: number, serial?: string): Promise<void> {
  const adb = new AdbManager(adbHost, adbPort);
  try {
    await adb.connect(serial);
  } catch (e: any) {
    console.error(`[mcp] warning: ${e.message}`);
  }

  const server = new McpServer({ name: "webadb-agent", version: "0.1.0" });

  server.registerTool(
    "device_info",
    { description: "Get connected device info: serial, model, screen size", inputSchema: {} },
    async () => ({ content: [{ type: "text", text: JSON.stringify(await adb.info()) }] })
  );

  server.registerTool(
    "screenshot",
    { description: "Take a screenshot of the device screen (PNG)", inputSchema: {} },
    async () => ({
      content: [{ type: "image" as const, data: (await adb.screenshot()).toString("base64"), mimeType: "image/png" }],
    })
  );

  server.registerTool(
    "tap",
    { description: "Tap at screen coordinates", inputSchema: { x: z.number(), y: z.number() } },
    async ({ x, y }) => {
      await adb.tap(x, y);
      return { content: [{ type: "text", text: `tapped ${x},${y}` }] };
    }
  );

  server.registerTool(
    "swipe",
    {
      description: "Swipe from one point to another",
      inputSchema: {
        x1: z.number(),
        y1: z.number(),
        x2: z.number(),
        y2: z.number(),
        duration_ms: z.number().optional(),
      },
    },
    async (a) => {
      await adb.swipe(a.x1, a.y1, a.x2, a.y2, a.duration_ms ?? 300);
      return { content: [{ type: "text", text: "swiped" }] };
    }
  );

  server.registerTool(
    "key",
    {
      description: "Press a key: KEYCODE name (HOME, BACK, ENTER…) or number (3=home, 4=back, 26=power)",
      inputSchema: { code: z.union([z.string(), z.number()]) },
    },
    async ({ code }) => {
      await adb.key(code);
      return { content: [{ type: "text", text: `pressed ${code}` }] };
    }
  );

  server.registerTool(
    "type_text",
    { description: "Type text into the focused field", inputSchema: { text: z.string() } },
    async ({ text }) => {
      await adb.text(text);
      return { content: [{ type: "text", text: "typed" }] };
    }
  );

  server.registerTool(
    "shell",
    { description: "Run an ADB shell command, returns stdout/stderr/exitCode", inputSchema: { command: z.string() } },
    async ({ command }) => {
      const r = await adb.shell(command);
      return { content: [{ type: "text", text: JSON.stringify(r) }] };
    }
  );

  server.registerTool(
    "open_app",
    { description: "Launch an app by package name", inputSchema: { package: z.string() } },
    async ({ package: pkg }) => {
      await adb.openApp(pkg);
      return { content: [{ type: "text", text: `opened ${pkg}` }] };
    }
  );

  await server.connect(new StdioServerTransport());
  console.error("[mcp] webadb-agent MCP server running on stdio");
}
