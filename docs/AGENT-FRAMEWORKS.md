# Driver Agent: OpenManus · OpenHands · agent-zero

webadb-agent adalah **tangan** (akses HP), framework di bawah adalah **otak**
yang memakainya. Semua integrasi di bawah memakai pola yang sama:
*inspect → act → verify* (screenshot → tap → screenshot lagi).

## Cara universal (berlaku untuk ketiganya): REST API via prompt

Semua framework ini bisa menjalankan shell/Python, jadi cara paling gampang
tanpa setup MCP: beri agent URL + token bridge + prompt di
`examples/agent-prompt.md`.

```
Tugas: mainkan Mobile Legends Adventure di HP.
Bridge:  BASE=https://<tunnel>/  TOKEN=<token>
Aturan:  screenshot dulu sebelum tiap tap (lihat examples/agent-prompt.md).
```

Contoh perintah yang bisa dijalankan agent:

```bash
curl -sk -H "Authorization: Bearer $TOKEN" $BASE/api/screenshot -o s.png
curl -sk -H "Authorization: Bearer $TOKEN" -X POST $BASE/api/tap -d '{"x":540,"y":1200}'
```

## Via MCP (agent-zero & OpenManus)

Bridge menyediakan MCP server stdio (`webadb-agent mcp`) dengan tools:
`screenshot`, `tap`, `swipe`, `key`, `type_text`, `shell`, `open_app`, `device_info`.

**agent-zero** — mendukung MCP server eksternal (lihat *MCP Setup* /
*MCP Configuration* di docs mereka). Format MCP JSON standar:

```json
{
  "mcpServers": {
    "webadb-agent": {
      "command": "node",
      "args": ["/path/ke/packages/bridge/dist/index.js", "mcp"]
    }
  }
}
```

**OpenManus** — mendukung MCP tools (`python run_mcp.py`). Daftarkan
webadb-agent sebagai MCP server stdio dengan command di atas, mengikuti
dokumentasi MCP di repo OpenManus.

> Catatan: MCP stdio = agent & bridge harus di mesin yang sama (atau bridge
> di-expose dan agent pakai REST via tunnel untuk jarak jauh).

## Perbandingan singkat

| Framework | Bintang | Cocok untuk automation HP? |
|---|---|---|
| [agent-zero](https://github.com/agent0ai/agent-zero) | ~19k | **Paling cocok** — agent vision + desktop Linux di Docker, custom tools, MCP, bisa jalan 24/7 headless di server |
| [OpenManus](https://github.com/FoundationAgents/OpenManus) | ~58k | General agent ringan (Python), dukung MCP; bagus untuk script automation terjadwal |
| [OpenHands](https://github.com/OpenHands/OpenHands) (Agent Canvas) | ~89k | Fokus coding agent; pakai via REST/prompt untuk tugas "buka HP, verifikasi build". Canvas-nya bagus untuk orkestrasi & scheduling |

## Rekomendasi

- **Automation game harian (kasus MLA)**: agent-zero (jalan di Docker server,
  prompt + REST API, screenshot tiap loop) atau OpenManus + cron.
- **QA app yang lagi di-develop**: OpenHands — agent coding verifikasi langsung
  di HP fisik via bridge.
- **Hermes/Telegram**: tetap bisa — beri prompt `examples/agent-prompt.md`
  (sudah ada, dibuat untuk MLA).

## Keamanan

Token bridge = kontrol penuh ke HP. Jangan taruh token di repo / chat publik.
Untuk agent remote, putar token setelah sesi selesai
(lihat `docs/REMOTE-ACCESS.md`).
