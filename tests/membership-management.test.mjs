import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { membershipDisplayName, parseCurrentMembership, parseMembershipManagementResult } from '../src/api/membership-rules.ts';

const record = {
  package_name: 'ALBATROSS', package_key: 'ALBATROSS', price: '499', discount_price: '399',
  status: 'active', payment_status: 'paid', next_billing_date: '2026-11-01 10:00:00',
  cancel_date: '', revision: 'a'.repeat(64), can_manage: true, period_end: 1793527200,
  scheduled_change: null,
};
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

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
  for (const value of [{}, undefined, { ...record, can_manage: 'yes' }, { ...record, period_end: NaN },
    { ...record, revision: 'invalid' }, { ...record, scheduled_change: { ...scheduled, action: 'upgrade' } },
    { ...record, scheduled_change: { ...scheduled, effective_at: -1 } }]) {
    assert.throws(() => parseCurrentMembership(value));
  }
});

test('management requires a real updated record or HTTPS checkout, never a success-shaped fallback', () => {
  assert.equal(parseMembershipManagementResult({ message: 'Scheduled', membership: record }).membership.package_name, 'EAGLE');
  assert.deepEqual(parseMembershipManagementResult({ bridge_url: 'https://example.test/checkout' }), { bridge_url: 'https://example.test/checkout' });
  for (const value of [null, {}, { message: 'OK', membership: null }, { bridge_url: 'javascript:bad' }]) {
    assert.throws(() => parseMembershipManagementResult(value));
  }
});

test('native controls refresh on focus, confirm changes and block duplicate requests; current state is uncached', () => {
  const screen = read('src/app/membership.tsx');
  assert.match(screen, /useFocusEffect\(useCallback/);
  assert.doesNotMatch(screen, /getCurrentMembership\(\)\.catch/);
  for (const label of ['CANCEL MEMBERSHIP', 'CHANGE PLAN', 'REMOVE SCHEDULED CHANGE', 'REFRESH MEMBERSHIP']) {
    assert.ok(screen.includes(label));
  }
  assert.match(screen, /Alert\.alert\(title, message/);
  assert.match(screen, /mutationInFlight\.current/);
  assert.match(read('src/api/membership.ts'), /cache: 'no-store'/);
  assert.match(read('src/api/account.ts'), /return getCurrentMembership\(\)/);
  assert.match(read('src/components/ProfileHome.tsx'), /useFocusEffect/);
});
