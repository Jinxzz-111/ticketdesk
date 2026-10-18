const test = require('node:test');
const assert = require('node:assert');
const { formatMessage } = require('../src/message');
test('formatMessage includes id, priority and title', () => {
  const m = formatMessage({ id: 7, priority: 'high', requester: 'Ana', title: 'No wifi' });
  assert.ok(m.includes('#7') && m.includes('high') && m.includes('No wifi'));
});
