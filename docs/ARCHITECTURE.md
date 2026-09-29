# Arsitektur webadb-agent

```
┌──────────────┐   USB / Wi-Fi ADB      ┌──────────────┐
│ HP Android   │ ◄────────────────────── │ adb server   │
│ (fisik)      │                        │ :5037 (PC)   │
└──────────────┘                        └──────┬───────┘
                                               │  @yume-chan/adb-server-node-tcp
┌──────────────┐   adb connect                  │  (ADB murni TypeScript)
│ Emulator     │ ◄──────────────────────────────┘
│ (Docker)     │   localhost:5555
└──────────────┘
                        ┌─────────────────────────┐
                        │  webadb-agent bridge    │
                        │  (packages/bridge)      │
                        │                         │
                        │  AdbManager (adb.ts)    │
                        │   screenshot/tap/swipe/ │
                        │   key/text/shell/open   │
                        └────┬────────┬──────┬────┘
                             │        │      │
              ┌──────────────┘        │      └──────────────┐
              ▼                     ▼                      ▼
     Web UI (packages/web)   REST API (/api/*)      MCP stdio
     - live screen (WS)      - screenshot PNG       (mcp.ts)
     - klik = tap            - tap/swipe/key        untuk agent
     - drag = swipe          - shell/open           lokal
     - shell, kirim teks            │
                                    │  tunnel (cloudflared/ngrok)
                                    ▼
                          ┌──────────────────┐
                          │  Remote AI agent │
                          │  (Muse, dsb.)    │
                          └──────────────────┘
```

## Gabungan 3 project

| Konsep | Sumber | Dipakai sebagai |
|---|---|---|
| ADB client murni TypeScript (jalan di Node & browser) | [yume-chan/ya-webadb](https://github.com/yume-chan/ya-webadb) (Tango) — `@yume-chan/adb`, `@yume-chan/adb-server-node-tcp` | Seluruh komunikasi ADB di bridge, tanpa re-implementasi protokol |
| Remote proxy via tunnel + pola inspect→act→verify untuk agent | [callstack/agent-device](https://github.com/callstack/agent-device) — `agent-device proxy` + `connect proxy` | Pola akses remote: bridge di-expose via cloudflared/ngrok, agent kendalikan dari mana saja; MCP server sebagai interface agent |
| Emulator Android di Docker + WebRTC streaming | [google/android-emulator-container-scripts](https://github.com/google/android-emulator-container-scripts) | Backend alternatif: emulator sebagai "device", bridge connect via `adb connect` (lihat `docs/EMULATOR.md`) |

## Komponen

- **`packages/bridge/src/adb.ts`** — `AdbManager`: konek ke adb server, pilih device, operasi
  (screenshot, tap, swipe, key, text, shell, open app, info). Satu-satunya file yang
  tahu soal ADB; ganti transport di sini kalau mau mode lain (mis. WebUSB langsung).
- **`packages/bridge/src/server.ts`** — HTTP server: serve web UI statis, REST API
  (`/api/*`, auth bearer token), WebSocket `/ws/screen` untuk frame layar live
  (loop `screencap -p`, ~2 fps default, bisa `--fps`).
- **`packages/bridge/src/mcp.ts`** — MCP server (stdio): tools `screenshot`, `tap`,
  `swipe`, `key`, `type_text`, `shell`, `open_app`, `device_info` untuk agent lokal
  (Claude Code, Cursor, dsb).
- **`packages/bridge/src/index.ts`** — CLI: `webadb-agent bridge` / `webadb-agent mcp`.
- **`packages/web/`** — UI web tanpa build step (HTML+JS+CSS murni): layar live,
  klik/drag = tap/swipe, tombol navigasi, kirim teks, buka app, terminal ADB shell.

## Keputusan desain

1. **Bridge ngomong ke `adb server`, bukan USB langsung.** Satu kode melayani HP fisik
   (USB), HP via Wi-Fi (`adb connect`), dan emulator Docker — semua terlihat sama
   sebagai "device" oleh adb server.
2. **Screen pakai `screencap` polling, bukan scrcpy/H.264 (v1).** Tanpa dependensi
   native, cukup untuk agent (screenshot) dan monitoring manusia. Upgrade ke
   `@yume-chan/scrcpy` ada di roadmap.
3. **Token auth sederhana.** Satu bearer token untuk API + WS. Jangan expose tanpa
   tunnel + token; token tercetak sekali saat bridge start (atau via `--token`).
4. **REST untuk remote, MCP untuk lokal.** Agent jarak jauh (seperti Muse via tunnel)
   paling gampang pakai REST + curl; agent di mesin yang sama pakai MCP stdio.
