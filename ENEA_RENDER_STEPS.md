# CheckMate sync → Render (for Enea)

**Status:** Not deployed yet from this machine (no Render account login).
**GitHub (ready):** https://github.com/eneanotaro-laflax/checkmate-sync

## Manual deploy (copy these clicks)

1. Open https://dashboard.render.com and sign in with **GitHub** (`eneanotaro-laflax`).
2. Click **New +** → **Blueprint**.
3. Select repository **`eneanotaro-laflax/checkmate-sync`** (authorize Render if asked).
4. Review `render.yaml` and click **Apply**:
   - **Service name:** `checkmate-sync`
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Plan:** Starter (persistent / always-on + disk)
   - **Disk:** mount `/data` (1 GB), env `DATA_DIR=/data`
   - **Port:** do **not** set 8787 — Render injects `PORT` (local default 8787 only)
5. Wait until the service is **Live**.
6. Copy the public HTTPS URL from the service page  
   (expected: `https://checkmate-sync.onrender.com` — use whatever Render shows).
7. Smoke test: open `https://YOUR-URL/health` → `{"ok":true,...}`

### Alternative without Blueprint
**New +** → **Web Service** → same repo → same build/start/plan/disk/env as above.

## Both phones — env

In `~/Desktop/CheckMateWeb/.env` **and** `~/Desktop/CheckMateWeb-secrets/.env`:

```bash
EXPO_PUBLIC_SYNC_URL=https://checkmate-sync.onrender.com
```

Replace with the **exact** URL from Render (no trailing slash).

## Expo restart (required after env change)

```bash
cd ~/Desktop/CheckMateWeb
# Stop Metro with Ctrl+C, then:
npm start
```

Reloading the app alone is not enough.
