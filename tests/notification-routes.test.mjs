import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getNotificationRoute } from '../src/notifications/routes.ts';

test('allows only known internal notification destinations', () => {
  for (const route of ['/', '/book', '/membership', '/reservations', '/account', '/notifications']) {
    assert.equal(getNotificationRoute(route), route);
  }
});

test('rejects external, malformed and parameterized notification destinations', () => {
  for (const route of [null, undefined, 1, {}, ['/', '/account'], '', 'https://example.com', '//example.com', 'javascript:alert(1)', '/checkout', '/book?token=private', '/reservations/123']) {
    assert.equal(getNotificationRoute(route), null);
  }
});
