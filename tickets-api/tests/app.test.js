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
