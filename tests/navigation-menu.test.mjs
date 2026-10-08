import assert from 'node:assert/strict';
import test from 'node:test';

import { bookingPolicyUrl, getMenuItems, primaryNavigation } from '../src/navigation/menu.ts';

test('bottom navigation contains only Booking, Membership, and Menu', () => {
  assert.deepEqual(primaryNavigation.map(({ label, path }) => ({ label, path })), [
    { label: 'Booking', path: '/book' },
    { label: 'Membership', path: '/membership' },
    { label: 'Menu', path: '/menu' },
  ]);
});

test('menu preserves published links and exposes native competitions browsing', () => {
  assert.deepEqual(getMenuItems(false).slice(0, 6), [
    { label: 'Home', path: '/', kind: 'app' },
    { label: 'Membership', path: '/membership', kind: 'app' },
    { label: '24/7 Hours & Access', path: 'https://teetimenexus.com/hours/', kind: 'website' },
    { label: 'Experience', path: '/technology', kind: 'app' },
    { label: 'Leagues & Tournaments', path: '/competitions', kind: 'app' },
    { label: 'About Us', path: 'https://teetimenexus.com/about-us/', kind: 'website' },
  ]);
});

test('guests and members link to the same published booking policies', () => {
  assert.equal(bookingPolicyUrl, 'https://teetimenexus.com/book-a-bay/#ttn-terms-open');
  for (const signedIn of [false, true]) {
    assert.ok(getMenuItems(signedIn).some((item) => item.path === bookingPolicyUrl && item.kind === 'website'));
  }
});

test('account actions follow authentication without hiding notifications', () => {
  const guest = getMenuItems(false);
  const member = getMenuItems(true);
  assert.equal(guest.some((item) => item.path === '/reservations'), false);
  assert.ok(member.some((item) => item.path === '/reservations'));
  assert.equal(guest.find((item) => item.path === '/account').label, 'Login / Sign Up');
  assert.equal(member.find((item) => item.path === '/account').label, 'My Account');
  for (const items of [guest, member]) {
    assert.ok(items.some((item) => item.path === '/notifications'));
    assert.equal(new Set(items.map((item) => item.path)).size, items.length);
  }
});
