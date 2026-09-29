# webadb-agent 📱🌐🤖

HP Android kamu — **di web, bisa dikendalikan AI agent juga.**

Satu service ringan yang bikin HP Android fisik (atau emulator di Docker)
bisa diakses dari browser **dan** dari AI agent, kayak emulator tapi devicenya
punya kamu sendiri.

```
[HP fisik] ──USB/WiFi──┐
                       ├─► adb server ─► webadb-agent bridge ─► Browser (layar live, klik=tap)
[Emulator Docker] ─────┘                          ├─► REST API  (untuk agent remote)
                                                  └─► MCP server (untuk agent lokal)
```

## Gabungan 3 project

| Project | Yang diambil |
|---|---|
| [yume-chan/ya-webadb](https://github.com/yume-chan/ya-webadb) (Tango) | ADB client **murni TypeScript** (`@yume-chan/adb`) — tanpa re-implementasi protokol |
| [callstack/agent-device](https://github.com/callstack/agent-device) | Pola **remote proxy via tunnel** + loop agent *inspect → act → verify* + MCP server |
| [google/android-emulator-container-scripts](https://github.com/google/android-emulator-container-scripts) | **Emulator Android di Docker** sebagai backend alternatif HP fisik |

## Quick start (HP fisik)

```bash
# 1. Di PC: install platform-tools, colok HP, aktifkan USB debugging
adb start-server && adb devices

# 2. Jalankan bridge
cd packages/bridge && npm install && npm run build
node dist/index.js bridge --port 8080
# → catat bearer token yang tercetak

# 3. Buka http://localhost:8080, masukkan token → layar HP live di web,
#    klik = tap, drag = swipe. Ada juga terminal ADB shell.
```

## Quick start (emulator Docker, tanpa HP)

Butuh Linux + KVM + Docker. Lihat `docs/EMULATOR.md`.

```bash
docker compose -f docker/docker-compose.emulator.yml up -d
adb connect localhost:5555
node packages/bridge/dist/index.js bridge --serial localhost:5555
```

## Untuk AI agent

**Remote** (tunnel, pola ala `agent-device proxy`) — lihat `docs/REMOTE-ACCESS.md`:

```bash
cloudflared tunnel --url http://127.0.0.1:8080
curl -H "Authorization: Bearer $TOKEN" $TUNNEL_URL/api/screenshot -o s.png
```

**Lokal** (MCP stdio) — tambah ke config MCP client:

```json
{ "mcpServers": { "webadb-agent": {
  "command": "node", "args": ["/path/to/packages/bridge/dist/index.js", "mcp"] } } }
```

Tools: `screenshot`, `tap`, `swipe`, `key`, `type_text`, `shell`, `open_app`, `device_info`.
Prompt siap pakai: `examples/agent-prompt.md`. Referensi REST: `docs/AGENT-API.md`.
Mau pakai framework agent (OpenManus/OpenHands/agent-zero) sebagai driver? Lihat `docs/AGENT-FRAMEWORKS.md`.

## Struktur

```
packages/bridge/src/  → adb.ts (lapisan ADB) · server.ts (web UI + REST + WS)
                        mcp.ts (MCP stdio) · index.ts (CLI)
packages/web/         → UI web tanpa build step
docs/                 → ARCHITECTURE.md · AGENT-API.md · REMOTE-ACCESS.md · EMULATOR.md
                       AGENT-FRAMEWORKS.md (OpenManus/OpenHands/agent-zero)
docker/               → compose emulator + Dockerfile bridge
examples/             → agent-prompt.md
```

## Roadmap

- [ ] scrcpy/H.264 streaming via `@yume-chan/scrcpy` (ganti screencap polling)
- [ ] Mode WebUSB langsung di browser (tanpa bridge) via `@yume-chan/adb-daemon-webusb`
- [ ] File manager di web UI · [ ] multi-device · [ ] rekam layar

## Lisensi

MIT
