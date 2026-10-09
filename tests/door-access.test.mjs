import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseDoorCredential, parseDoorState } from '../src/api/door-access-rules.ts';
import { withRequestTimeout } from '../src/api/request-timeout.ts';
import { waitForReaderProof } from '../modules/kisi-access/src/reader-proof.ts';

const state = {
  booking_id: 42, status: 'ready', message: 'Door access is available.',
  server_time: 1000000, valid_from: 900000, valid_until: 2000000,
};
const access = {
  ...state, lock_id: 123, credential: {
    organizationId: 100, loginId: 999, secret: 'test-only', phoneKey: 'test-only',
    onlineCertificate: 'test-only', validFrom: state.valid_from, validUntil: state.valid_until,
  },
};
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('door window starts inclusively and expires exclusively, using server time', () => {
  assert.equal(parseDoorState({ ...state, server_time: state.valid_from }, 42).status, 'ready');
  assert.throws(() => parseDoorState({ ...state, server_time: state.valid_from - 1 }, 42));
  assert.throws(() => parseDoorState({ ...state, server_time: state.valid_until }, 42));
  assert.equal(parseDoorState({ ...state, status: 'expired', server_time: state.valid_until }, 42).status, 'expired');
  assert.equal(parseDoorState({ ...state, status: 'upcoming', server_time: state.valid_from - 1 }, 42).status, 'upcoming');
});

test('unavailable non-member access needs no fabricated window or credential', () => {
  assert.equal(parseDoorState({ ...state, status: 'unavailable', valid_from: null, valid_until: null }, 42).status, 'unavailable');
  assert.throws(() => parseDoorCredential({ ...access, status: 'unavailable' }, 42));
});

test('malformed states and credentials, incorrect ownership IDs and mismatched windows fail explicitly', () => {
  for (const value of [null, {}, { ...state, booking_id: 43 }, { ...state, status: 'allowed' },
    { ...state, valid_until: '2000000' }, { ...state, valid_from: 3000000 }, { ...state, message: '' },
    { ...state, status: 'upcoming' }, { ...state, status: 'expired' }, { ...state, server_time: NaN }]) {
    assert.throws(() => parseDoorState(value, 42));
  }
  assert.deepEqual(parseDoorCredential(access, 42), access);
  for (const value of [{ ...access, credential: null }, { ...access, lock_id: '123' },
    ...['organizationId', 'loginId', 'secret', 'phoneKey', 'onlineCertificate', 'validFrom', 'validUntil'].map((key) =>
      ({ ...access, credential: { ...access.credential, [key]: key === 'validUntil' ? state.valid_until + 1 : null } }))]) {
    assert.throws(() => parseDoorCredential(value, 42));
  }
});

test('reservation ID is wired through every door access surface and fake access values are gone', () => {
  assert.match(read('src/components/BookingList.tsx'), /bookingId: String\(booking\.ID\)/);
  assert.match(read('src/components/ProfileHome.tsx'), /bookingId: String\(upcomingBooking\.ID\)/);
  assert.match(read('src/app/reservation.tsx'), /bookingId=\{Number\(bookingId\)\}/);
  assert.match(read('src/components/BookingDetails.tsx'), /<DoorAccess bookingId=\{bookingId\}/);
  const door = read('src/components/DoorAccess.tsx');
  assert.doesNotMatch(door, /5327|14 \* 60 \+ 32|accessCode|Door Access Code/);
  assert.match(door, /createDoorCredential\(bookingId\)/);
  assert.match(door, /initializeKisi\(next\.credential\)/);
  assert.match(door, /clearAccess/);
  assert.match(door, /onKisiUnlock/);
  assert.match(door, /AppState\.addEventListener/);
  assert.match(door, /generation\.current/);
});

test('fallback uses a fresh reader proof and user credential after website eligibility, with no public cache', () => {
  const api = read('src/api/door-access.ts');
  assert.match(api, /cache: 'no-store'/);
  assert.ok(api.indexOf('await getDoorAccess(access.booking_id)') < api.indexOf('await readProof()'));
  assert.match(api, /KISI-LOGIN \$\{access\.credential\.secret\}/);
  assert.match(api, /proximity_proof: proximityProof/);
  assert.doesNotMatch(api, /TTN_KISI_API_KEY|public-content|localStorage|console\.log/);
  const kotlin = read('modules/kisi-access/android/src/main/java/expo/modules/kisiaccess/KisiAccessModule.kt');
  assert.match(kotlin, /SystemClock\.elapsedRealtime\(\) - snapshot\.first < 5000/);
  assert.match(kotlin, /it\.lockId == lockId/);
  const swift = read('modules/kisi-access/ios/KisiAccessModule.swift');
  assert.match(swift, /ReaderManager\.shared\.proximityProofForLock\(lockId\)/);
  assert.match(swift, /requestWhenInUseAuthorization/);
});

test('refresh shows progress, reports unchanged eligibility, and prevents overlapping requests', () => {
  const door = read('src/components/DoorAccess.tsx');
  assert.match(door, /if \(checking\.current\) return/);
  assert.match(door, /setRefreshing\(true\)/);
  assert.match(door, /setRefreshing\(false\)/);
  assert.match(door, /void refresh\(true\)/);
  assert.match(door, /refreshing \? 'Checking Access\.\.\.' : 'Refresh Access'/);
  assert.match(door, /disabled=\{busy \|\| refreshing\}/);
  assert.match(door, /accessibilityLiveRegion="polite" style=\{styles\.instruction\}>\{refreshMessage\}/);
  assert.match(door, /Refresh does not unlock the door/);
  const api = read('src/api/door-access.ts');
  assert.match(api, /withRequestTimeout/);
  assert.match(api, /20000/);
  assert.match(api, /cache: 'no-store', signal/);
});

test('request timeout returns successful data and preserves server errors', async () => {
  let signal;
  assert.equal(await withRequestTimeout(async (value) => {
    signal = value;
    return 'ready';
  }, 50, 'Timed out'), 'ready');
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(signal.aborted, false, 'Successful completion clears the timeout.');
  const failure = new Error('Booking unavailable');
  await assert.rejects(withRequestTimeout(async () => { throw failure; }, 50, 'Timed out'), (error) => error === failure);
});

test('hung access checks reject explicitly and abort the fetch even when authentication has not finished', async () => {
  let signal;
  await assert.rejects(withRequestTimeout((value) => {
    signal = value;
    return new Promise(() => {});
  }, 10, 'Checking door access timed out'), /Checking door access timed out/);
  assert.equal(signal.aborted, true);
});

test('reader discovery retries only missing signals and returns the fresh proof', async () => {
  let attempts = 0;
  const proof = await waitForReaderProof(async () => {
    attempts++;
    if (attempts === 1) throw new Error('UnexpectedException: The entrance reader is not nearby.');
    return '123456';
  }, 10);
  assert.equal(proof, '123456');
  assert.equal(attempts, 2);
});

test('missing reader signal ends with a clean actionable error, not an Expo stack', async () => {
  await assert.rejects(waitForReaderProof(async () => {
    throw new Error('UnexpectedException: The entrance reader is not nearby. (at ExpoModulesCore/AsyncFunctionDefinition.swift:126)');
  }, 5), (error) => error.message.includes('No signal detected from the configured entrance reader')
    && !error.message.includes('UnexpectedException') && !error.message.includes('ExpoModulesCore'));
});

test('reader discovery never suppresses permission errors or cancellation', async () => {
  for (const message of ['Door access was closed.', 'Bluetooth permission denied', 'Native module missing']) {
    const error = new Error(message);
    let attempts = 0;
    await assert.rejects(waitForReaderProof(async () => {
      attempts++;
      throw error;
    }), (failure) => failure === error);
    assert.equal(attempts, 1);
  }
});
