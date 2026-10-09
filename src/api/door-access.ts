import { apiRequest } from './client';
import { DoorCredentialResponse, parseDoorCredential, parseDoorState } from './door-access-rules';
import { Platform } from 'react-native';
import { withRequestTimeout } from './request-timeout';

export type { DoorAccessState, DoorCredentialResponse } from './door-access-rules';

export async function getDoorAccess(bookingId: number) {
  if (!Number.isSafeInteger(bookingId) || bookingId < 1) throw new Error('Open door access from a reservation in your account.');
  const response = await withRequestTimeout(
    (signal) => apiRequest<unknown>(`/wp-json/ttn/v1/door-access?booking_id=${bookingId}`, { cache: 'no-store', signal }),
    20000,
    'Checking door access timed out. Check your connection and tap Refresh Access to retry.',
  );
  return parseDoorState(response, bookingId);
}

export async function createDoorCredential(bookingId: number) {
  if (!Number.isSafeInteger(bookingId) || bookingId < 1) throw new Error('Open door access from a reservation in your account.');
  return parseDoorCredential(await apiRequest<unknown>('/wp-json/ttn/v1/door-access/credentials', {
    method: 'POST', cache: 'no-store', body: JSON.stringify({ booking_id: bookingId, platform: Platform.OS }),
  }), bookingId);
}

export async function unlockEntrance(access: DoorCredentialResponse, readProof: () => Promise<string>) {
  const state = await getDoorAccess(access.booking_id);
  if (state.status !== 'ready' || state.valid_from !== access.valid_from || state.valid_until !== access.valid_until) {
    throw new Error('Your booking access changed. Enable door access again.');
  }
  const proximityProof = await readProof();
  if (!/^\d+$/.test(proximityProof)) throw new Error('Stand near the entrance reader and retry.');
  const response = await fetch(`https://api.kisi.io/locks/${access.lock_id}/unlock`, {
    method: 'POST', headers: { Authorization: `KISI-LOGIN ${access.credential.secret}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ lock: { proximity_proof: proximityProof } }),
  });
  if (!response.ok) throw new Error(`Kisi could not unlock the entrance (HTTP ${response.status}). Check your booking and stand near the reader.`);
}
