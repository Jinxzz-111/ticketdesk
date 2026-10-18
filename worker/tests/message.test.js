const test = require('node:test');
const assert = require('node:assert');
const { formatMessage } = require('../src/message');
test('formatMessage includes id, priority and title', () => {
  const m = formatMessage({ id: 7, priority: 'high', requester: 'Ana', title: 'No wifi' });
  assert.ok(m.includes('#7') && m.includes('high') && m.includes('No wifi'));
});

test('formatMessage includes the requester name', () => {
  const m = formatMessage({ id: 1, priority: 'low', requester: 'Ben', title: 'Lost key' });
  assert.ok(m.includes('Ben'));
});
