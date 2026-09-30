# Menjalankan webadb-agent di Docker

## Quickstart

```bash
cd webadb-agent
cp .env.example .env
# edit .env — isi WEBADB_TOKEN dengan string acak yang panjang

# di HOST (bukan container): pastikan adb server jalan
adb start-server
adb devices          # HP harus muncul di sini

docker compose up -d --build
```

Buka http://localhost:8080 — login pakai token dari `.env`.

Bridge di container bicara ke **adb server di host** via `host.docker.internal`
(otomatis di-map oleh compose). Jadi HP fisik (USB / wireless ADB) maupun
emulator yang sudah `adb connect` di host akan terlihat oleh bridge tanpa
setup tambahan. Lihat `docs/EMULATOR.md` untuk emulator Docker.

## Konfigurasi (env di `.env`)

| Variabel | Default | Keterangan |
|---|---|---|
| `WEBADB_TOKEN` | acak | **Wajib diisi** — bearer token untuk API & web UI |
| `WEBADB_PORT` | 8080 | Port bridge di dalam container |
| `ADB_HOST` | host.docker.internal | Host adb server |
| `ADB_PORT` | 5037 | Port adb server |
| `WEBADB_SERIAL` | (kosong) | Kunci ke satu device bila ada >1 |
| `WEBADB_FPS` | 2 | Frame screenshot per detik (web UI) |

## Linux: alternatif `network_mode: host`

Di Linux, sebagai ganti `extra_hosts` bisa pakai network host supaya
`ADB_HOST=127.0.0.1` (adb server host) langsung terjangkau:

```yaml
services:
  bridge:
    network_mode: "host"
    # hapus blok ports: dan extra_hosts:
```

## Akses remote

Jangan expose port 8080 ke internet langsung — pakai tunnel
(lihat `docs/REMOTE-ACCESS.md`), mis. dari host:

```bash
cloudflared tunnel --url http://localhost:8080
```

## Update

```bash
git pull
docker compose up -d --build
```

## Troubleshooting

- **Web UI 401 / API 401** — token salah. Samakan dengan `WEBADB_TOKEN` di `.env`,
  lalu `docker compose up -d` (tanpa --build cukup untuk ganti env).
- **"no device yet" di log** — adb server di host belum jalan atau HP belum
  terdaftar. Cek di host: `adb devices`. Di container, bridge menjangkau
  `ADB_HOST:ADB_PORT` — pastikan firewall host mengizinkan.
- **Container unhealthy** — healthcheck memakai `WEBADB_TOKEN` dari env;
  kalau token di-override via argumen, healthcheck akan gagal (tidak fatal).
- **Di Mac/Windows** — pastikan Docker Desktop versi terbaru agar
  `host-gateway` didukung.
