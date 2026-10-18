const test = require('node:test');
const assert = require('node:assert');
const { createApp, validate } = require('../src/app');

const fakePool = { query: async (sql, p) => ({ rows: sql.startsWith('INSERT') ? [{ id: 1, title: p[0] }] : [] }) };

async function withServer(fn) {
  const server = createApp(fakePool).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}
const post = (b, body) => fetch(b + '/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

test('validate rejects short title', () => assert.strictEqual(validate({ title: 'ab' }).length, 1));
test('validate accepts good ticket', () => assert.deepStrictEqual(validate({ title: 'Broken door', priority: 'low' }), []));
test('GET /health returns 200', () => withServer(async (b) => assert.strictEqual((await fetch(b + '/health')).status, 200)));
test('POST / creates ticket', () => withServer(async (b) => assert.strictEqual((await post(b, JSON.stringify({ title: 'Need ID reissue' }))).status, 201)));
test('POST / rejects bad ticket', () => withServer(async (b) => assert.strictEqual((await post(b, '{}')).status, 400)));

// ---- Carlo: extra tests ----
const put = (b, id, body) => fetch(`${b}/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });

test('PUT /:id/status rejects invalid status', () => withServer(async (b) =>
  assert.strictEqual((await put(b, 1, JSON.stringify({ status: 'banana' }))).status, 400)));

test('POST / rejects invalid priority', () => withServer(async (b) =>
  assert.strictEqual((await post(b, JSON.stringify({ title: 'Broken door', priority: 'urgent' }))).status, 400)));

test('validate accepts every valid priority', () => {
  for (const priority of ['low', 'medium', 'high']) {
    assert.deepStrictEqual(validate({ title: 'Broken door', priority }), []);
  }
});

test('PUT /:id/status returns 404 for an unknown ticket', () => withServer(async (b) =>
  assert.strictEqual((await put(b, 999, JSON.stringify({ status: 'resolved' }))).status, 404)));

// ---- Chris: id validation, GET /:id, status filter ----
// Paste at the bottom of tickets-api/tests/app.test.js, AFTER Carlo's tests (PR #5) are merged.
// It reuses his helpers: withServer, post, put.
test('PUT /:id/status rejects a non-numeric id', () => withServer(async (b) =>
  assert.strictEqual((await put(b, 'abc', JSON.stringify({ status: 'resolved' }))).status, 400)));

test('PUT /:id/status rejects zero, negative and huge ids', () => withServer(async (b) => {
  for (const id of ['0', '-5', '1.5', '99999999999']) {
    assert.strictEqual((await put(b, id, JSON.stringify({ status: 'resolved' }))).status, 400, id);
  }
}));

test('GET /:id returns 400 for a non-numeric id', () => withServer(async (b) =>
  assert.strictEqual((await fetch(b + '/abc')).status, 400)));

test('GET /:id returns 404 for an unknown ticket', () => withServer(async (b) =>
  assert.strictEqual((await fetch(b + '/999')).status, 404)));

test('GET /:id returns the ticket when it exists', async () => {
  const pool = { query: async () => ({ rows: [{ id: 7, title: 'Wifi down' }] }) };
  const server = createApp(pool).listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/7`);
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).id, 7);
  } finally { server.close(); }
});

test('GET /?status=resolved filters in the database query', async () => {
  let seen;
  const pool = { query: async (sql, p) => { seen = { sql, p }; return { rows: [] }; } };
  const server = createApp(pool).listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/?status=resolved`);
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(seen.p, ['resolved']);
  } finally { server.close(); }
});

test('GET /?status=banana returns 400', () => withServer(async (b) =>
  assert.strictEqual((await fetch(b + '/?status=banana')).status, 400)));

test('a database error returns 500 instead of crashing', async () => {
  const pool = { query: async () => { throw new Error('db down'); } };
  const server = createApp(pool).listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/`);
    assert.strictEqual(r.status, 500);
  } finally { server.close(); }
});

// ---- Delete a finished request ----
const del = (b, id) => fetch(`${b}/${id}`, { method: 'DELETE' });

test('DELETE /:id rejects a non-numeric id', () => withServer(async (b) =>
  assert.strictEqual((await del(b, 'abc')).status, 400)));

test('DELETE /:id returns 404 when there is no finished request with that id', () => withServer(async (b) =>
  assert.strictEqual((await del(b, 999)).status, 404)));

test('DELETE /:id deletes a finished request and its notifications', async () => {
  let seen;
  const pool = { query: async (sql, p) => { seen = { sql, p }; return { rows: [{ id: 7 }] }; } };
  const server = createApp(pool).listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/7`, { method: 'DELETE' });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { deleted: 7 });
    assert.deepStrictEqual(seen.p, [7]);
    assert.ok(/status\s*=\s*'resolved'/.test(seen.sql));    // only finished requests can be deleted
    assert.ok(/DELETE FROM notifications/.test(seen.sql));   // its notification rows go first (foreign key)
  } finally { server.close(); }
});
