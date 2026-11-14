/**
 * Household-Sync smoke test (local or remote).
 *
 * Usage:
 *   node smoke-test.js
 *   SYNC_URL=https://checkmate-sync.onrender.com node smoke-test.js
 *
 * Covers: health, create via PUT, join partner, LWW host PUT must keep joiner.
 */
const BASE = (process.env.SYNC_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const token = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function payload(state, revisedAt) {
  return {
    version: 1,
    exportedAt: revisedAt,
    revisedAt,
    state,
    notifications: [],
    notificationPrefs: {
      assignedTasks: true,
      knockRequests: true,
      knockResolved: true,
    },
  };
}

async function main() {
  console.log(`[smoke] BASE=${BASE}`);
  console.log(`[smoke] token=${token}`);

  const health = await req('GET', '/health');
  assert(health.status === 200 && health.json?.ok === true, 'health failed');
  console.log('[smoke] health OK');

  const t0 = new Date(Date.now() - 60_000).toISOString();
  const host = {
    id: 'google-host-smoke',
    firstName: 'Enea',
    displayName: 'Enea Smoke',
    email: 'enea-smoke@example.com',
    googleSub: 'host-smoke',
    pictureUrl: null,
  };
  const hostState = {
    members: [host],
    currentUserId: host.id,
    inviteToken: token,
    categories: [{ id: 'cat-home', name: 'Haushalt', color: '#0d9488' }],
    tasks: [
      {
        id: 'task-1',
        title: 'Milch',
        categoryId: 'cat-home',
        assigneeId: host.id,
        participantIds: [host.id],
        status: 'open',
        archived: false,
        createdAt: t0,
        knockFromId: null,
        knockStatus: 'none',
        calendarNote: null,
        subtasks: [],
      },
    ],
  };

  const put1 = await req('PUT', `/households/${encodeURIComponent(token)}`, payload(hostState, t0));
  assert(put1.status === 200, `host PUT failed: ${put1.status}`);
  assert(put1.json?.state?.members?.length === 1, 'host PUT should store 1 member');
  console.log('[smoke] host PUT OK');

  const partner = {
    id: 'apple-partner-smoke',
    firstName: 'Partner',
    displayName: 'Partner Smoke',
    email: 'partner-smoke@example.com',
    googleSub: null,
    pictureUrl: null,
  };
  const join = await req('POST', `/households/${encodeURIComponent(token)}/join`, {
    member: partner,
  });
  assert(join.status === 200, `join failed: ${join.status}`);
  assert(
    (join.json?.state?.members || []).some((m) => m.id === partner.id),
    'join response missing partner',
  );
  console.log('[smoke] join OK — members:', join.json.state.members.map((m) => m.id).join(', '));

  // Classic race: host uploads newer revisedAt WITHOUT partner → must keep partner.
  const t2 = new Date().toISOString();
  const staleHostState = {
    ...hostState,
    tasks: [
      {
        ...hostState.tasks[0],
        title: 'Milch + Brot',
      },
    ],
  };
  const put2 = await req(
    'PUT',
    `/households/${encodeURIComponent(token)}`,
    payload(staleHostState, t2),
  );
  assert(put2.status === 200, `race PUT failed: ${put2.status}`);
  const ids = (put2.json?.state?.members || []).map((m) => m.id);
  assert(ids.includes(host.id), 'race PUT dropped host');
  assert(ids.includes(partner.id), 'race PUT dropped partner (member-union broken)');
  assert(
    put2.json.state.tasks[0].title === 'Milch + Brot',
    'race PUT should keep newer task title',
  );
  assert(
    put2.json.state.tasks[0].participantIds.includes(partner.id),
    'partner should be in task participantIds',
  );
  console.log('[smoke] LWW race OK — members preserved:', ids.join(', '));

  const get = await req('GET', `/households/${encodeURIComponent(token)}`);
  assert(get.status === 200, 'GET failed');
  assert(
    (get.json?.state?.members || []).length >= 2,
    'GET should still show both members',
  );
  console.log('[smoke] GET OK');
  console.log('[smoke] ALL PASSED');
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err.message || err);
  process.exit(1);
});
