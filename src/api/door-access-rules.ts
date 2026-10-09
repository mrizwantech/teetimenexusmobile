import type { KisiDeviceCredential } from '../../modules/kisi-access/src/KisiAccess.types';

export type DoorAccessState = {
  status: 'ready' | 'upcoming' | 'expired' | 'unavailable';
  message: string;
  booking_id: number;
  server_time: number;
  valid_from: number | null;
  valid_until: number | null;
};

export type DoorCredentialResponse = DoorAccessState & {
  lock_id: number;
  credential: KisiDeviceCredential;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isDoorStatus(value: unknown): value is DoorAccessState['status'] {
  return value === 'ready' || value === 'upcoming' || value === 'expired' || value === 'unavailable';
}

export function parseDoorState(value: unknown, bookingId: number): DoorAccessState {
  if (!isRecord(value) || !isDoorStatus(value.status)
    || typeof value.message !== 'string' || !value.message.trim()
    || !positiveInteger(value.booking_id) || value.booking_id !== bookingId || !positiveInteger(value.server_time)
    || !(value.valid_from === null || positiveInteger(value.valid_from))
    || !(value.valid_until === null || positiveInteger(value.valid_until))) {
    throw new Error('The website returned invalid door access details. Please retry or contact support.');
  }
  if (value.status !== 'unavailable' && (!positiveInteger(value.valid_from) || !positiveInteger(value.valid_until)
    || value.valid_from >= value.valid_until
    || (value.status === 'ready' && (value.server_time < value.valid_from || value.server_time >= value.valid_until))
    || (value.status === 'upcoming' && value.server_time >= value.valid_from)
    || (value.status === 'expired' && value.server_time < value.valid_until))) {
    throw new Error('The website returned an invalid door access window.');
  }
  return {
    status: value.status, message: value.message,
    booking_id: value.booking_id, server_time: value.server_time,
    valid_from: value.valid_from, valid_until: value.valid_until,
  };
}

export function parseDoorCredential(value: unknown, bookingId: number): DoorCredentialResponse {
  const state = parseDoorState(value, bookingId);
  if (!isRecord(value) || state.status !== 'ready' || !positiveInteger(value.lock_id) || !isRecord(value.credential)) {
    throw new Error('The website did not provide a valid door credential.');
  }
  const credential = value.credential;
  if (!positiveInteger(credential.organizationId) || !positiveInteger(credential.loginId)
    || typeof credential.secret !== 'string' || !credential.secret.trim()
    || typeof credential.phoneKey !== 'string' || !credential.phoneKey.trim()
    || typeof credential.onlineCertificate !== 'string' || !credential.onlineCertificate.trim()
    || !positiveInteger(credential.validFrom) || !positiveInteger(credential.validUntil)
    || credential.validFrom !== state.valid_from || credential.validUntil !== state.valid_until) {
    throw new Error('The website returned invalid member device credentials.');
  }
  return { ...state, lock_id: value.lock_id, credential: {
    organizationId: credential.organizationId, loginId: credential.loginId, secret: credential.secret,
    phoneKey: credential.phoneKey, onlineCertificate: credential.onlineCertificate,
    validFrom: credential.validFrom, validUntil: credential.validUntil,
  } };
}
