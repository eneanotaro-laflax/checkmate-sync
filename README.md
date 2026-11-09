# CheckMate Sync Server

Minimal household sync API for CheckMate. Households are keyed by **invite token** (the secret in the invite link). Conflict strategy: **last-write-wins** on `revisedAt`.

## Local run

```bash
cd server
npm install
npm start
# → http://localhost:8787
```

Point the app at it:

```bash
# in CheckMateWeb/.env
EXPO_PUBLIC_SYNC_URL=http://localhost:8787
```

For physical phones on the same Wi‑Fi, use your Mac’s LAN IP instead of `localhost`, e.g. `http://192.168.1.20:8787`.

## API

| Method | Path | Body | Result |
|--------|------|------|--------|
| `GET` | `/health` | — | `{ ok: true }` |
| `GET` | `/households/:inviteToken` | — | `BackendSyncPayload` or 404 |
| `PUT` | `/households/:inviteToken` | `BackendSyncPayload` | Stored payload (or newer server copy) |
| `POST` | `/households/:inviteToken/join` | `{ member }` | Payload with member merged |
| `POST` | `/households` | optional `{ inviteToken, payload }` | Create household |

## Deploy (Render — free web service)

1. Create a [Render](https://render.com) account.
2. **New → Web Service** → connect this Git repo (or deploy from local with the Render CLI).
3. Settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance:** Free
4. After deploy, copy the public URL (e.g. `https://checkmate-sync.onrender.com`).
5. Set in `CheckMateWeb/.env` and `CheckMateWeb-secrets/.env`:

```bash
EXPO_PUBLIC_SYNC_URL=https://checkmate-sync.onrender.com
```

6. Restart Expo (`npm start`).

**Note:** Free Render services spin down after idle time; the first request can take ~30–60s. For always-on, use a paid instance or another host (Fly.io, Railway, a cheap VPS).

Optional persistent disk on Render: set `DATA_DIR=/data` and attach a disk mounted at `/data` so households survive redeploys. Without a disk, data lives on the ephemeral filesystem.

## Env vars (server)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8787` | Listen port (Render sets this) |
| `DATA_DIR` | `./data` | Directory for `households.json` |
