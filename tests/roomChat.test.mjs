import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoomChat, validText, validMessage } from '../src/lib/roomChat.mjs';

test('chat validates untrusted text and message fields', () => {
  assert.equal(validText(' hello '), true);
  assert.equal(validText(' '.repeat(300)), false);
  assert.equal(validText('x'.repeat(301)), false);
  assert.equal(validText({ text: 'hello' }), false);
  const message = { id: 'id', uid: 'uid', author: 'player', text: 'hello', timestamp: 1 };
  assert.equal(validMessage(message), true);
  assert.equal(validMessage({ ...message, text: 'x'.repeat(301) }), false);
  assert.equal(validMessage({ ...message, timestamp: '1' }), false);
  assert.equal(validMessage({ ...message, timestamp: 1e100 }), false);
  assert.equal(validMessage({ ...message, timestamp: -1 }), false);
  assert.equal(validMessage({ ...message, timestamp: 8640000000000000 }), true);
  assert.equal(validMessage({ ...message, author: 'x'.repeat(101) }), false);
});

 test('unsupported WebRTC degrades without accessing Firebase', () => {
  let status;
  const chat = createRoomChat({ initialMessages: [], onStatus: value => { status = value; } });
  assert.equal(status.state, 'unavailable');
  assert.equal(chat.send('hello'), false);
  chat.retry(); chat.updateMembers([]); chat.close();
});
