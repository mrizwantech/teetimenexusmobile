import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createBookingLeaveGuard } from '../src/navigation/booking-leave-guard.ts';

function setup(source = '/book') {
  const prompts = [];
  const guard = createBookingLeaveGuard((leave, stay) => prompts.push({ leave, stay }));
  let discarded = 0;
  let navigated = 0;
  return {
    guard, prompts,
    register: () => guard.register(source, () => { discarded += 1; }),
    navigate: (path = '/membership') => guard.request(source, path, () => { navigated += 1; }),
    counts: () => ({ discarded, navigated }),
  };
}

test('no warning before selecting a bay type or when targeting Book itself', () => {
  const state = setup();
  state.navigate();
  state.register();
  state.navigate('/book');
  assert.equal(state.prompts.length, 0);
  assert.deepEqual(state.counts(), { discarded: 0, navigated: 2 });
});

test('staying preserves selections and blocks navigation; later confirmation discards once', () => {
  const state = setup();
  state.register();
  state.navigate();
  state.navigate('/');
  assert.equal(state.prompts.length, 1, 'duplicate taps cannot stack alerts');
  assert.deepEqual(state.counts(), { discarded: 0, navigated: 0 });
  state.prompts[0].stay();
  state.navigate();
  state.prompts[1].leave();
  assert.deepEqual(state.counts(), { discarded: 1, navigated: 1 });
  state.navigate();
  assert.equal(state.prompts.length, 2);
});

test('confirmed native back may redispatch without a second prompt', () => {
  const state = setup();
  state.register();
  let completed = 0;
  state.guard.request('/book', null, () => {
    state.guard.request('/book', null, () => { completed += 1; });
  });
  state.prompts[0].leave();
  assert.equal(completed, 1);
  assert.equal(state.prompts.length, 1);
});

test('focus cleanup and stale dialogs cannot discard or navigate a different booking', () => {
  const state = setup();
  const unregister = state.register();
  state.navigate();
  unregister();
  state.register();
  state.prompts[0].leave();
  assert.deepEqual(state.counts(), { discarded: 0, navigated: 0 });
  state.navigate();
  assert.equal(state.prompts.length, 2);
});

test('old focus cleanup does not remove a newer registration', () => {
  const state = setup();
  const unregister = state.register();
  state.register();
  unregister();
  state.navigate();
  assert.equal(state.prompts.length, 1);
});

test('checkout also warns when returning to Book and staying preserves checkout', () => {
  const state = setup('/checkout');
  state.register();
  state.navigate('/book');
  assert.equal(state.prompts.length, 1);
  state.prompts[0].stay();
  assert.equal(state.counts().navigated, 0);
  state.navigate('/book');
  state.prompts[1].leave();
  assert.equal(state.counts().navigated, 1);
});

test('successful checkout unregisters before replacement and stale dialogs cannot navigate', () => {
  const state = setup('/checkout');
  const unregister = state.register();
  state.navigate();
  unregister();
  state.navigate('/confirmation');
  assert.equal(state.counts().navigated, 1);
  state.prompts[0].leave();
  assert.equal(state.counts().navigated, 1);
});

test('checkout protects app exits until success without interfering with website payment', () => {
  const checkout = readFileSync(new URL('../src/app/checkout.tsx', import.meta.url), 'utf8');
  assert.match(checkout, /Boolean\(\(bay && date\) \|\| managementBookingId\)/);
  assert.match(checkout, /register\('\/checkout', \(\) => \{\}\)/);
  assert.match(checkout, /usePreventRemove\(isFocused && bookingCheckout && !checkoutComplete/);
  assert.match(checkout, /onPress=\{closeCheckout\}/);
  assert.match(checkout, /leaveGuard\.request\(null, \(\) => router\.back\(\)\)/);
  assert.match(checkout, /unregisterGuard\.current\?\.\(\)/);
  assert.match(checkout, /finishCheckout\(\(\) => router\.replace\(\{ pathname: '\/confirmation'/);
  assert.match(checkout, /finishCheckout\(\(\) => router\.replace\(\{ pathname: '\/manage-reservation'/);
  assert.doesNotMatch(checkout, /onShouldStartLoadWithRequest|Pay Now|paynow/);
});

test('booking guards native back while global destinations guard before navigation', () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const book = read('src/app/book.tsx');
  assert.match(book, /if \(!user \|\| !bayType\) return/);
  assert.match(book, /usePreventRemove\(Boolean\(isFocused && user && bayType\)/);
  assert.match(book, /leaveGuard\.request\(null, \(\) => navigation\.dispatch\(data\.action\)\)/);
  assert.match(book, /navigation\.canGoBack\(\)/);
  assert.match(book, /BackHandler\.exitApp\(\)/);
  assert.match(book, /setBayType\(null\)/);
  assert.match(book, /setCurrentStep\(0\)/);
  const checkout = book.slice(book.indexOf('async function handleContinue'));
  assert.match(checkout, /router\.push\(\{\s*pathname: '\/checkout'/);
  assert.match(read('src/components/BottomNav.tsx'), /leaveGuard\.request\(path/);
  assert.match(read('src/components/MenuSheet.tsx'), /leaveGuard\.request\(item\.path/);
  assert.match(read('src/context/PushContext.tsx'), /leaveGuard\.request\(pendingOpen\.route/);
  const provider = read('src/context/BookingLeaveContext.tsx');
  assert.match(provider, /Keep your tee time in play/);
  assert.match(provider, /Stay & Finish/);
  assert.match(provider, /Leave Booking/);
  assert.match(provider, /another golfer could book this time/);
  assert.match(provider, /window\.confirm/);
  assert.match(provider, /guard\.request\(pathname, destination, proceed\)/);
  assert.match(provider, /const guard = useMemo\(\(\) => createBookingLeaveGuard/);
  assert.doesNotMatch(provider, /useState/);
  assert.match(read('src/app/_layout.tsx'), /<BookingLeaveProvider>/);
});

test('Booking tab always uses checkout guard even if the underlying booking registers last', () => {
  const state = setup('/checkout');
  state.register();
  let discardedBook = false;
  const cleanupBook = state.guard.register('/book', () => { discardedBook = true; });
  state.navigate('/book');
  assert.equal(state.prompts.length, 1);
  assert.equal(state.counts().navigated, 0);
  state.prompts[0].stay();
  cleanupBook();
  state.navigate('/book');
  assert.equal(state.prompts.length, 2, 'booking cleanup must not clear checkout protection');
  state.prompts[1].leave();
  assert.equal(state.counts().navigated, 1);
  assert.equal(discardedBook, false);
});

test('a mounted checkout guard does not intercept navigation from unrelated screens', () => {
  const state = setup('/checkout');
  state.register();
  let navigated = false;
  state.guard.request('/membership', '/', () => { navigated = true; });
  assert.equal(navigated, true);
  assert.equal(state.prompts.length, 0);
  state.navigate('/book');
  assert.equal(state.prompts.length, 1);
});
