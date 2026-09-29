# Agent REST API

Base URL: `http://localhost:8080` (atau URL tunnel). Semua request butuh header:

```
Authorization: Bearer <token>
```

## Endpoints

| Method & path | Body | Balikan |
|---|---|---|
| `GET /api/health` | — | `{ ok, device }` |
| `GET /api/devices` | — | `{ devices: [{ serial, state }] }` |
| `POST /api/connect` | `{ serial? }` | `{ device }` |
| `GET /api/info` | — | `{ serial, model, product, width, height }` |
| `GET /api/screenshot` | — | PNG layar saat ini |
| `POST /api/tap` | `{ x, y }` | `{ ok }` |
| `POST /api/swipe` | `{ x1, y1, x2, y2, duration_ms? }` | `{ ok }` |
| `POST /api/key` | `{ code }` — nama (`"HOME"`,`"BACK"`) atau angka (`3`=home, `4`=back, `26`=power) | `{ ok }` |
| `POST /api/text` | `{ text }` | `{ ok }` |
| `POST /api/shell` | `{ command }` | `{ stdout, stderr, exitCode }` |
| `POST /api/open` | `{ package }` | hasil `monkey` |
| `WS /ws/screen?token=…` | — | frame PNG beruntun (~2 fps) |

Koordinat tap/swipe dalam **piksel layar device** (lihat `width`/`height` dari `/api/info`).

## Contoh (curl)

```bash
TOKEN=xxx; B=http://localhost:8080
curl -s -H "Authorization: Bearer $TOKEN" $B/api/health
curl -s -H "Authorization: Bearer $TOKEN" $B/api/screenshot -o layar.png
curl -s -H "Authorization: Bearer $TOKEN" -X POST $B/api/tap \
  -d '{"x":540,"y":1200}'
curl -s -H "Authorization: Bearer $TOKEN" -X POST $B/api/shell \
  -d '{"command":"dumpsys battery | grep level"}'
curl -s -H "Authorization: Bearer $TOKEN" -X POST $B/api/open \
  -d '{"package":"com.mobile.legends"}'
```

## Pola pakai untuk agent (ala agent-device)

`inspect → act → verify`: screenshot dulu, tentukan koordinat dari gambar,
kirim tap/swipe, screenshot lagi untuk verifikasi. Jangan menebak koordinat
tanpa melihat screenshot terbaru. Lihat `examples/agent-prompt.md`.
