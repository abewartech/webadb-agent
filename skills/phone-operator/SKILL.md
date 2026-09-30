---
name: phone-operator
description: Operate a physical Android phone or Docker Android emulator through webadb-agent. Use when asked to do anything on the phone: open apps, tap, swipe, type, read the screen, run ADB shell. Inspect-act-verify loop with screenshots.
version: 1.0.0
author: abewartech
license: MIT
platforms: [linux, macos, windows]
metadata:
  category: mobile
  requires_env: [WEBADB_BASE, WEBADB_TOKEN]
---

# Phone Operator

You control an Android device (physical phone or Docker emulator) through a
webadb-agent bridge. You see the screen via screenshots and act via a REST API.

## Connection

Read from environment (never hardcode or log the token):

- `WEBADB_BASE` — bridge URL, e.g. `http://localhost:8080` or a tunnel URL
- `WEBADB_TOKEN` — bearer token

If either is missing, ask the user for it. Do not proceed without them.
All requests need `Authorization: Bearer $WEBADB_TOKEN`.

```bash
BASE="$WEBADB_BASE"; T="$WEBADB_TOKEN"
api() { curl -sk -H "Authorization: Bearer $T" "$BASE$1" ${@:2}; }
```

## The loop: inspect → act → verify

Every interaction follows this loop. Never tap blindly.

1. **Inspect** — take a screenshot and look at it:
   `api /api/screenshot -o /tmp/screen.png`, then view the image.
2. **Act** — one action at a time (tap / swipe / key / type).
3. **Verify** — screenshot again, confirm the expected state before continuing.

## Actions

| Action | Request |
|---|---|
| Screenshot | `GET /api/screenshot` → PNG |
| Tap | `POST /api/tap` `{"x":540,"y":1200}` |
| Swipe | `POST /api/swipe` `{"x1":540,"y1":1500,"x2":540,"y2":600,"duration_ms":400}` |
| Key | `POST /api/key` `{"key":"back"}` — back, home, recent, enter, esc, wake |
| Type text | `POST /api/type` `{"text":"hello"}` |
| Open app | `POST /api/open-app` `{"package":"com.android.settings"}` |
| ADB shell | `POST /api/shell` `{"command":"dumpsys activity top"}` |
| Device info | `GET /api/device` |

Coordinates are in the **0–1000 relative system** (x: left→right, y: top→bottom),
independent of screen resolution. Estimate positions from the screenshot.

## Rules

- Screenshot first, always. If the screen state is unknown, inspect before acting.
- One action per step; verify with a screenshot after each.
- If an app isn't responding, use key `back` or `home` to recover — don't
  hammer taps.
- For repetitive game/app grinding: loop inspect→act→verify, and stop when the
  goal state is visible. Never spend premium currency, make purchases, or
  delete/sacrifice anything without explicit user approval per action.
- Report what you did with the final screenshot as evidence.
