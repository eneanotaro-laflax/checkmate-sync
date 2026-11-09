/**
 * CheckMate household sync server
 *
 * Households are keyed by inviteToken (shared secret in the invite link).
 * Conflict strategy: last-write-wins on payload.revisedAt.
 *
 * Endpoints (base URL = EXPO_PUBLIC_SYNC_URL):
 *   GET  /health
 *   GET  /households/:inviteToken
 *   PUT  /households/:inviteToken
 *   POST /households/:inviteToken/join   { member }
 *   POST /households                     optional bootstrap { inviteToken?, state? }
 */

const cors = require('cors');
const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8787;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'households.json');

/** @typedef {{ version: 1, exportedAt: string, revisedAt: string, state: object, notifications?: unknown[], notificationPrefs?: object }} BackendSyncPayload */

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ households: {} }, null, 2));
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.households) {
      return { households: {} };
    }
    return parsed;
  } catch {
    return { households: {} };
  }
}

function writeStore(store) {
  ensureStore();
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_FILE);
}

function isValidPayload(raw) {
  return (
    raw &&
    typeof raw === 'object' &&
    raw.version === 1 &&
    raw.state &&
    typeof raw.state === 'object' &&
    typeof raw.revisedAt === 'string'
  );
}

function normalizeMember(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.displayName !== 'string' || !raw.displayName.trim()) return null;
  return {
    id: raw.id.trim(),
    firstName:
      typeof raw.firstName === 'string' && raw.firstName.trim()
        ? raw.firstName.trim()
        : raw.displayName.trim().split(/\s+/)[0],
    displayName: raw.displayName.trim(),
    email: typeof raw.email === 'string' ? raw.email : null,
    googleSub: typeof raw.googleSub === 'string' ? raw.googleSub : null,
    pictureUrl: typeof raw.pictureUrl === 'string' ? raw.pictureUrl : null,
  };
}

function mergeMemberIntoState(state, member) {
  const members = Array.isArray(state.members) ? [...state.members] : [];
  const tasks = Array.isArray(state.tasks) ? [...state.tasks] : [];
  const idx = members.findIndex(
    (m) =>
      m.id === member.id ||
      (m.email &&
        member.email &&
        String(m.email).toLowerCase() === String(member.email).toLowerCase()),
  );

  if (idx === -1) {
    members.push(member);
    for (let i = 0; i < tasks.length; i += 1) {
      const task = tasks[i];
      const participantIds = Array.isArray(task.participantIds)
        ? [...task.participantIds]
        : [];
      if (!participantIds.includes(member.id)) {
        participantIds.push(member.id);
      }
      tasks[i] = { ...task, participantIds };
    }
  } else {
    members[idx] = { ...members[idx], ...member };
  }

  return {
    ...state,
    members,
    tasks,
    inviteToken: state.inviteToken || undefined,
    currentUserId: member.id,
  };
}

function emptyPayload(inviteToken) {
  const now = new Date().toISOString();
  return {
    version: 1,
    exportedAt: now,
    revisedAt: now,
    state: {
      members: [],
      currentUserId: null,
      inviteToken,
      categories: [
        { id: 'cat-home', name: 'Haushalt', color: '#0d9488' },
        { id: 'cat-shop', name: 'Einkaufen', color: '#115e59' },
        { id: 'cat-admin', name: 'Organisation', color: '#134e4a' },
        { id: 'cat-fun', name: 'Gemeinsam', color: '#0f766e' },
      ],
      tasks: [],
    },
    notifications: [],
    notificationPrefs: {
      assignedTasks: true,
      knockRequests: true,
      knockResolved: true,
    },
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'checkmate-sync', time: new Date().toISOString() });
});

app.get('/households/:inviteToken', (req, res) => {
  const token = String(req.params.inviteToken || '').trim();
  if (!token) {
    res.status(400).json({ error: 'inviteToken required' });
    return;
  }
  const store = readStore();
  const payload = store.households[token];
  if (!payload) {
    res.status(404).json({ error: 'household not found' });
    return;
  }
  res.json(payload);
});

app.put('/households/:inviteToken', (req, res) => {
  const token = String(req.params.inviteToken || '').trim();
  if (!token) {
    res.status(400).json({ error: 'inviteToken required' });
    return;
  }
  if (!isValidPayload(req.body)) {
    res.status(400).json({ error: 'invalid BackendSyncPayload (version 1)' });
    return;
  }

  /** @type {BackendSyncPayload} */
  const incoming = {
    version: 1,
    exportedAt:
      typeof req.body.exportedAt === 'string'
        ? req.body.exportedAt
        : new Date().toISOString(),
    revisedAt: req.body.revisedAt,
    state: {
      ...req.body.state,
      inviteToken: token,
    },
    notifications: Array.isArray(req.body.notifications)
      ? req.body.notifications
      : undefined,
    notificationPrefs: req.body.notificationPrefs,
  };

  const store = readStore();
  const existing = store.households[token];
  if (existing) {
    const remoteTs = new Date(existing.revisedAt).getTime();
    const localTs = new Date(incoming.revisedAt).getTime();
    if (remoteTs > localTs) {
      // Server wins — return current household so client can adopt it.
      res.status(200).json(existing);
      return;
    }
  }

  store.households[token] = incoming;
  writeStore(store);
  res.status(200).json(incoming);
});

app.post('/households/:inviteToken/join', (req, res) => {
  const token = String(req.params.inviteToken || '').trim();
  if (!token) {
    res.status(400).json({ error: 'inviteToken required' });
    return;
  }
  const member = normalizeMember(req.body?.member);
  if (!member) {
    res.status(400).json({ error: 'member { id, displayName } required' });
    return;
  }

  const store = readStore();
  let payload = store.households[token];
  if (!payload) {
    // Host has not uploaded yet — create empty household so join still works,
    // then host's next PUT with older/newer revisedAt merges via LWW.
    payload = emptyPayload(token);
  }

  const now = new Date().toISOString();
  const nextState = mergeMemberIntoState(
    { ...payload.state, inviteToken: token },
    member,
  );
  // Keep joiner's currentUserId local-only semantics: store household with
  // currentUserId null so each device sets its own after download.
  const storedState = { ...nextState, currentUserId: null };
  const nextPayload = {
    version: 1,
    exportedAt: now,
    revisedAt: now,
    state: storedState,
    notifications: Array.isArray(payload.notifications)
      ? payload.notifications
      : [],
    notificationPrefs: payload.notificationPrefs,
  };

  store.households[token] = nextPayload;
  writeStore(store);

  // Return payload with joiner as currentUserId for convenience on client.
  res.status(200).json({
    ...nextPayload,
    state: { ...storedState, currentUserId: member.id },
  });
});

app.post('/households', (req, res) => {
  const token =
    (typeof req.body?.inviteToken === 'string' && req.body.inviteToken.trim()) ||
    `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const store = readStore();
  if (store.households[token]) {
    res.status(409).json({ error: 'household already exists', inviteToken: token });
    return;
  }
  let payload;
  if (isValidPayload(req.body?.payload)) {
    payload = {
      ...req.body.payload,
      state: { ...req.body.payload.state, inviteToken: token },
    };
  } else {
    payload = emptyPayload(token);
  }
  store.households[token] = payload;
  writeStore(store);
  res.status(201).json({ inviteToken: token, payload });
});

app.listen(PORT, () => {
  ensureStore();
  console.log(`[checkmate-sync] listening on :${PORT}`);
  console.log(`[checkmate-sync] data → ${STORE_FILE}`);
});
