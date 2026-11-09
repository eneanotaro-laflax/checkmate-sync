# Deploy CheckMate sync on Render (Enea)

GitHub repo (already created & pushed):
**https://github.com/eneanotaro-laflax/checkmate-sync**

Expected public URL after deploy (Render may add a random suffix if the name is taken):
**https://checkmate-sync.onrender.com**

## Exact clicks

1. Open **https://dashboard.render.com/register** (or log in).
2. Sign up with **GitHub** → authorize Render → select account **eneanotaro-laflax**.
3. **New +** → **Blueprint**.
4. Connect repository **`eneanotaro-laflax/checkmate-sync`** (grant access if asked).
5. Render reads `render.yaml`. Confirm:
   - Service name: `checkmate-sync`
   - Plan: **Starter** (always-on + disk; Free spins down and cannot keep data)
   - Region: Frankfurt
   - Disk: `/data` (1 GB)
6. Click **Apply** / **Create** and wait until status is **Live**.
7. Open the service → copy the public URL (HTTPS), e.g. `https://checkmate-sync.onrender.com`.
8. Smoke-test in a browser: `https://YOUR-URL/health` → should show `{"ok":true,...}`.

### Alternative: Web Service (no Blueprint)

1. **New +** → **Web Service** → repo `checkmate-sync`.
2. Settings:
   - **Runtime:** Node
   - **Build:** `npm install`
   - **Start:** `npm start`
   - **Instance:** Starter (for persistence)
3. **Disks** → add disk, mount path `/data`, size 1 GB.
4. Env vars: `DATA_DIR=/data`, `NODE_VERSION=22`.
5. Deploy → copy HTTPS URL.

> Render sets `PORT` itself. Do **not** force 8787 on Render; the app already uses `process.env.PORT`.

## App env (both phones)

In `CheckMateWeb/.env` **and** `CheckMateWeb-secrets/.env`:

```bash
EXPO_PUBLIC_SYNC_URL=https://checkmate-sync.onrender.com
```

Use the **exact** URL from the Render dashboard (no trailing slash).

Then **fully restart Expo** (stop the Metro process, run `npm start` again). Reloading the app alone is not enough — `EXPO_PUBLIC_*` is baked in at bundler start.

## Cost note

Starter + 1 GB disk is a paid Render plan. Free Web Service works for a quick test but **sleeps when idle** (~30–60s cold start) and **loses household JSON on redeploy** without a disk.
