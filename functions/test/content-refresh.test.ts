import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contentRefreshMessage, handleContentVersionWrite, parseContentVersion, PUBLIC_CONTENT_TOPIC } from '../src/content-refresh.ts';
import type { ContentRefreshMessage } from '../src/content-refresh.ts';

function recorder() {
  const sent: ContentRefreshMessage[] = [];
  const logs: string[] = [];
  const log = { info: (m: string) => logs.push(m), warn: (m: string) => logs.push(m), error: (m: string) => logs.push(m) };
  const send = async (message: ContentRefreshMessage) => { sent.push(message); return `msg-${sent.length}`; };
  return { sent, logs, log, send };
}

test('parses whole-number and short-token versions only', () => {
  assert.equal(parseContentVersion(3), '3');
  assert.equal(parseContentVersion(0), '0');
  assert.equal(parseContentVersion(' 2026-11-01.1 '), '2026-11-01.1');
  for (const invalid of [-1, 1.5, Number.NaN, '', 'has space', 'x'.repeat(65), null, undefined, { v: 1 }, true]) {
    assert.equal(parseContentVersion(invalid), null, String(invalid));
  }
});

test('builds a silent, high-priority topic message without a notification payload', () => {
  const message = contentRefreshMessage('7');
  assert.equal(message.topic, PUBLIC_CONTENT_TOPIC);
  assert.deepEqual(message.data, { type: 'content_refresh', version: '7' });
  assert.equal('notification' in message, false);
  assert.equal(message.android.priority, 'high');
  assert.equal(message.apns.headers['apns-push-type'], 'background');
  assert.equal(message.apns.headers['apns-priority'], '5');
  assert.equal(message.apns.payload.aps.contentAvailable, true);
});

test('sends once when the version is created or changed', async () => {
  const r = recorder();
  assert.equal(await handleContentVersionWrite({ before: undefined, after: { version: 1 } }, r.send, r.log), '1');
  assert.equal(await handleContentVersionWrite({ before: { version: 1 }, after: { version: 2, note: 'menu' } }, r.send, r.log), '2');
  assert.deepEqual(r.sent.map((m) => m.data.version), ['1', '2']);
});

test('ignores unrelated edits, deletion and invalid versions', async () => {
  const r = recorder();
  assert.equal(await handleContentVersionWrite({ before: { version: 2 }, after: { version: '2', note: 'x' } }, r.send, r.log), null);
  assert.equal(await handleContentVersionWrite({ before: { version: 2 }, after: undefined }, r.send, r.log), null);
  assert.equal(await handleContentVersionWrite({ before: { version: 2 }, after: { version: 'bad value' } }, r.send, r.log), null);
  assert.equal(r.sent.length, 0);
  assert.ok(r.logs.some((line) => line.includes('Ignoring public content version')));
});

test('propagates send failures so they are visible in function logs', async () => {
  const r = recorder();
  await assert.rejects(
    handleContentVersionWrite({ before: undefined, after: { version: 4 } }, async () => { throw new Error('fcm down'); }, r.log),
    /fcm down/,
  );
});
