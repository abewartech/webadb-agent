# Backend Emulator (Docker)

Selain HP fisik, bridge bisa mengendalikan **emulator Android di Docker**
pakai [google/android-emulator-container-scripts](https://github.com/google/android-emulator-container-scripts).
Cocok kalau mau "HP di web" tanpa colok HP, atau jalan di server.

## Syarat

- Linux (bare metal / VM dengan nested virtualization), KVM aktif (`/dev/kvm`)
- Docker + Docker Compose
- Project Google butuh Python 3.10+ untuk `emu-docker` (opsional — bisa pakai image jadi)

> Docker Desktop (macOS/Windows) **tidak** didukung untuk akselerasi KVM.

## Cara cepat (image jadi dari Google)

```bash
docker run -d --name emulator \
  -e ADBKEY="$(cat ~/.android/adbkey)" \
  --device /dev/kvm \
  --publish 8554:8554/tcp \
  --publish 5555:5555/tcp \
  us-docker.pkg.dev/android-emulator-268719/images/30-google-x64:30.1.2

adb connect localhost:5555
adb devices   # → localhost:5555 device
```

Lalu jalankan bridge seperti biasa — emulator otomatis kepilih sebagai device:

```bash
node packages/bridge/dist/index.js bridge --port 8080
```

Kalau ada banyak device (HP + emulator), pilih via `--serial localhost:5555`.

## Docker Compose (emulator + bridge)

Lihat `docker/docker-compose.emulator.yml`. Menjalankan emulator; bridge tetap
dijalankan di host (butuh `adb` + Node di host) atau via `docker/Dockerfile.bridge`.

```bash
docker compose -f docker/docker-compose.emulator.yml up -d
adb connect localhost:5555
node packages/bridge/dist/index.js bridge --serial localhost:5555
```

## WebRTC streaming bawaan Google

Project Google juga punya streaming WebRTC (gateway Python + React) untuk
melihat emulator di browser dengan latensi rendah:

```bash
cd <android-emulator-container-scripts>/gateway
./launch_video_demo.sh --discovery_file ~/.android/avd/running/pid_*.ini
```

Itu alternatif viewer-nya Google; webadb-agent tetap berguna sebagai
**lapisan kontrol + API agent** di atasnya (REST/MCP yang sama untuk HP fisik
maupun emulator — agent tidak perlu tahu backend-nya apa).

## Kapan pilih apa

| | HP fisik | Emulator Docker |
|---|---|---|
| Game / sensor / performa real | ✅ | ❌ (lambat tanpa GPU, no sensor) |
| Jalan di server 24/7 | ❌ (harus colok) | ✅ |
| Setup | colok USB + USB debugging | butuh Linux + KVM |
| Cocok untuk | automation game (kasus MLA), device farm pribadi | CI, testing app, farm emulator |
