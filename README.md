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

## Deploy (Render — persistent)

GitHub (ready to connect): **https://github.com/eneanotaro-laflax/checkmate-sync**

Step-by-step clicks: see **[RENDER_DEPLOY.md](./RENDER_DEPLOY.md)**.

Summary: Render → **New → Blueprint** → repo `checkmate-sync` → apply `render.yaml` (Starter + `/data` disk) → copy HTTPS URL → set:

```bash
EXPO_PUBLIC_SYNC_URL=https://checkmate-sync.onrender.com
```

Then **restart Expo** (`npm start`). Free plan works for a quick test but sleeps when idle and cannot keep a disk.

## Env vars (server)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8787` | Listen port (Render sets this) |
| `DATA_DIR` | `./data` | Directory for `households.json` |
