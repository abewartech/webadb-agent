# Akses Remote (untuk AI agent di luar mesin)

Pola ini meniru `agent-device proxy`: bridge jalan di mesin yang punya akses ke
HP/emulator, lalu di-expose via tunnel. Siapa pun yang pegang **URL + token**
bisa mengendalikan device — jaga keduanya seperti password.

## 1. Jalankan bridge di PC/server

```bash
cd packages/bridge && npm install && npm run build
node dist/index.js bridge --port 8080 --token RAHASIAKUAT
# catat token yang tercetak
```

## 2. Expose via tunnel

```bash
# cloudflared (tanpa akun)
cloudflared tunnel --url http://127.0.0.1:8080
# atau ngrok
ngrok http 8080
```

Dapat URL publik, mis. `https://abc-123.trycloudflare.com`.

## 3. Agent remote pakai REST API

```bash
B=https://abc-123.trycloudflare.com; TOKEN=RAHASIAKUAT
curl -sk -H "Authorization: Bearer $TOKEN" $B/api/screenshot -o layar.png
curl -sk -H "Authorization: Bearer $TOKEN" -X POST $B/api/tap -d '{"x":540,"y":1200}'
```

Lihat `docs/AGENT-API.md` untuk daftar endpoint lengkap dan
`examples/agent-prompt.md` untuk prompt siap pakai.

Manusia juga bisa buka `$B/` di browser (masukkan token di halaman) untuk
melihat & mengendalikan layar HP dari mana saja.

## Keamanan

- Jangan commit token ke repo. Pakai `--token` dari secret/ENV di mesin sendiri.
- Tunnel publik = device bisa dikendalikan siapa pun yang tahu URL+token.
  Putar token (`--token` baru) setelah sesi remote selesai.
- Untuk pemakaian tetap, batasi via firewall / Cloudflare Access / Tailscale
  alih-alih URL publik polos.
