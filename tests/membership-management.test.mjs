import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isActivePaidMembership, membershipDisplayName, parseCurrentMembership, parseMembershipManagementResult } from '../src/api/membership-rules.ts';
import { createMembershipStatusCache, MEMBERSHIP_STATUS_CACHE_MS } from '../src/api/membership-status-cache.ts';

const record = {
  package_name: 'ALBATROSS', package_key: 'ALBATROSS', price: '499', discount_price: '399',
  status: 'active', payment_status: 'paid', next_billing_date: '2026-11-01 10:00:00',
  cancel_date: '', revision: 'a'.repeat(64), can_manage: true, period_end: 1793527200,
  scheduled_change: null,
};
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('browsing membership expires at exactly five minutes and manual refresh bypasses it', async () => {
  let now = 0;
  let requests = 0;
  const owner = {};
  const cache = createMembershipStatusCache(async () => {
    requests += 1;
    return parseCurrentMembership(record);
  }, () => now);
  assert.equal(MEMBERSHIP_STATUS_CACHE_MS, 300_000);
  await cache.get(owner);
  now = 299_999;
  await cache.get(owner);
  assert.equal(requests, 1);
  now = 300_000;
  await cache.get(owner);
  assert.equal(requests, 2);
  await cache.get(owner, true);
  assert.equal(requests, 3);
  cache.invalidate(owner);
  await cache.get(owner);
  assert.equal(requests, 4);
});

test('browsing cache isolates login sessions, caches no-membership results and retries failures', async () => {
  let requests = 0;
  let fail = false;
  const cache = createMembershipStatusCache(async () => {
    requests += 1;
    if (fail) throw new Error('offline');
    return null;
  });
  const owner = {};
  const newSession = {};
  assert.equal(await cache.get(owner), null);
  await cache.get(owner);
  assert.equal(requests, 1);
  await cache.get(newSession);
  assert.equal(requests, 2);
  fail = true;
  await assert.rejects(cache.get(owner, true), /offline/);
  await assert.rejects(cache.get(owner), /offline/);
  assert.equal(requests, 4);
  fail = false;
  await cache.get(owner);
  assert.equal(requests, 5);
});

test('in-flight reads are shared and an invalidated response cannot restore the cache', async () => {
  const releases = [];
  const cache = createMembershipStatusCache(() => new Promise((resolve) => releases.push(resolve)));
  const owner = {};
  const first = cache.get(owner);
  assert.equal(cache.get(owner), first);
  cache.invalidate(owner);
  const second = cache.get(owner);
  releases[1](null);
  await second;
  releases[0](parseCurrentMembership(record));
  await first;
  assert.equal(await cache.get(owner), null);
  assert.equal(releases.length, 2);
});

test('browsing cache is bypassed before actions and invalidated for checkout and management', () => {
  const source = read('src/app/membership.tsx');
  assert.match(source, /browsingMembershipStatus\.get\(user, forceRefresh\)/);
  assert.equal((source.match(/browsingMembershipStatus\.get\(user, true\)/g) ?? []).length, 2);
  assert.equal((source.match(/browsingMembershipStatus\.invalidate\(user\)/g) ?? []).length, 2);
  assert.match(source, /current\.revision !== membership\.revision/);
});

test('membership browsing keeps package cards visible while checking fresh account status', () => {
  const source = read('src/app/membership.tsx');
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /getMembershipPackages\(forceRefresh\)\.then/);
  assert.match(source, /retry !== handledRetry\.current/);
  assert.match(source, /handledRetry\.current = retry/);
  assert.doesNotMatch(source, /getMembershipPackages\(retry > 0\)/);
  assert.match(source, /\{packages\.map/);
  assert.doesNotMatch(source, /!loading && packages\.map/);
  assert.match(source, /setMembership\(null\)/);
  assert.match(source, /disabled=\{loading \|\| Boolean\(loadingPackage\)/);
  assert.match(read('src/api/membership.ts'), /membership\/current', \{ cache: 'no-store' \}/);
});

test('Profile and Home show membership only for active paid members without fabricated labels', () => {
  assert.equal(isActivePaidMembership(null), false);
  for (const status of ['pending', 'cancelled', 'expired', 'inactive', '']) {
    assert.equal(isActivePaidMembership(parseCurrentMembership({ ...record, status })), false);
  }
  for (const payment_status of ['pending', 'unpaid', 'failed', 'refunded', '']) {
    assert.equal(isActivePaidMembership(parseCurrentMembership({ ...record, payment_status })), false);
  }
  assert.equal(isActivePaidMembership(parseCurrentMembership(record)), true);
  assert.equal(isActivePaidMembership(parseCurrentMembership({ ...record, scheduled_change: {
    action: 'cancel', package_name: 'ALBATROSS', effective_at: record.period_end,
  } })), true);
  for (const path of ['src/components/ProfileScreen.tsx', 'src/components/ProfileHome.tsx']) {
    const source = read(path);
    assert.match(source, /isActivePaidMembership\(membership\)/);
    assert.match(source, /membership\.package_name/);
    assert.match(source, /useFocusEffect/);
    assert.match(source, /setMembership\(null\)/);
    assert.doesNotMatch(source, /Founding Member|Your membership is ready/);
  }
});

test('EAGLE is a display rename, not a change to the paid tier identifier', () => {
  assert.equal(membershipDisplayName('albatross'), 'EAGLE');
  assert.equal(membershipDisplayName('EAGLE'), 'EAGLE');
  assert.equal(membershipDisplayName('BIRDIE'), 'BIRDIE');
  const parsed = parseCurrentMembership(record);
  assert.equal(parsed.package_name, 'EAGLE');
  assert.equal(parsed.package_key, 'ALBATROSS');
  assert.equal(parsed.discount_price, '399');
});

test('legacy current-membership responses remain readable without offering unsupported management', () => {
  const { package_key, revision, can_manage, period_end, scheduled_change, ...legacy } = record;
  const parsed = parseCurrentMembership(legacy);
  assert.equal(parsed.package_name, 'EAGLE');
  assert.equal(parsed.can_manage, undefined);
  assert.equal(parseCurrentMembership(null), null);
});

test('scheduled cancellation/downgrade use explicit server timestamps and reject invalid states', () => {
  const scheduled = { action: 'downgrade', package_name: 'ALBATROSS', effective_at: record.period_end };
  assert.equal(parseCurrentMembership({ ...record, scheduled_change: scheduled }).scheduled_change.package_name, 'EAGLE');
  for (const value of [{}, undefined, { ...record, package_name: null }, { ...record, package_name: ' ' }]) {
    assert.throws(() => parseCurrentMembership(value));
  }
  for (const value of [{ ...record, can_manage: 'yes' }, { ...record, period_end: NaN },
    { ...record, revision: 'invalid' }, { ...record, scheduled_change: { ...scheduled, action: 'upgrade' } },
    { ...record, scheduled_change: { ...scheduled, effective_at: -1 } }]) {
    const parsed = parseCurrentMembership(value);
    assert.equal(parsed.package_name, 'EAGLE');
    assert.equal(parsed.can_manage, false);
    assert.equal(parsed.revision, undefined);
  }
});

test('raw legacy database rows with nulls and numbers still display', () => {
  const parsed = parseCurrentMembership({
    id: '3', user_id: 7, package_name: 'albatross', price: 499, discount_price: null, status: 'Active',
    payment_status: 'PAID', next_billing_date: '0000-00-00 00:00:00', cancel_date: null,
  });
  assert.equal(parsed.package_name, 'EAGLE');
  assert.equal(parsed.price, '499');
  assert.equal(parsed.discount_price, '');
  assert.equal(parsed.status, 'active');
  assert.equal(parsed.payment_status, 'paid');
  assert.equal(parsed.next_billing_date, null);
  assert.equal(parsed.can_manage, undefined);
});

test('management requires a real updated record or HTTPS checkout, never a success-shaped fallback', () => {
  assert.equal(parseMembershipManagementResult({ message: 'Scheduled', membership: record }).membership.package_name, 'EAGLE');
  assert.deepEqual(parseMembershipManagementResult({ bridge_url: 'https://example.test/checkout' }), { bridge_url: 'https://example.test/checkout' });
  for (const value of [null, {}, { message: 'OK', membership: null }, { bridge_url: 'javascript:bad' }]) {
    assert.throws(() => parseMembershipManagementResult(value));
  }
});

test('native controls check status on focus, confirm changes and block duplicate requests; status API is uncached', () => {
  const screen = read('src/app/membership.tsx');
  assert.match(screen, /useFocusEffect\(useCallback/);
  assert.doesNotMatch(screen, /getCurrentMembership\(\)\.catch/);
  for (const label of ['CANCEL MEMBERSHIP', 'CHANGE PLAN', 'REMOVE SCHEDULED CHANGE', 'REFRESH MEMBERSHIP']) {
    assert.ok(screen.includes(label));
  }
  assert.match(screen, /Alert\.alert\(title, message/);
  assert.match(screen, /mutationInFlight\.current/);
  const api = read('src/api/membership.ts');
  assert.match(api, /cache: 'no-store'/);
  assert.match(api, /parseCurrentMembership\(value === undefined \? null : value\)/);
  assert.match(read('src/api/account.ts'), /return getCurrentMembership\(\)/);
  assert.match(read('src/components/ProfileHome.tsx'), /useFocusEffect/);
});
