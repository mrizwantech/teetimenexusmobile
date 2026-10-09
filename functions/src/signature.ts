import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_TOLERANCE_SECONDS = 300;
export const MIN_SECRET_LENGTH = 32;

/** Signs `${timestamp}.${rawBody}` exactly like the WordPress client. */
export function signPayload(secret: string, timestamp: number, rawBody: string | Buffer): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(`${timestamp}.`);
  hmac.update(rawBody);
  return `v1=${hmac.digest('hex')}`;
}

export type SignatureCheck =
  | { ok: true; timestamp: number }
  | { ok: false; reason: 'misconfigured' | 'missing' | 'malformed' | 'expired' | 'mismatch' };

export function verifySignature(input: {
  secret: string;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  rawBody: string | Buffer;
  nowSeconds: number;
}): SignatureCheck {
  if (input.secret.length < MIN_SECRET_LENGTH) return { ok: false, reason: 'misconfigured' };
  if (!input.timestampHeader || !input.signatureHeader) return { ok: false, reason: 'missing' };
  if (!/^\d{9,11}$/.test(input.timestampHeader) || !/^v1=[0-9a-f]{64}$/.test(input.signatureHeader)) {
    return { ok: false, reason: 'malformed' };
  }
  const timestamp = Number(input.timestampHeader);
  if (Math.abs(input.nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: 'expired' };

  const expected = Buffer.from(signPayload(input.secret, timestamp, input.rawBody));
  const received = Buffer.from(input.signatureHeader);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false, reason: 'mismatch' };
  }
  return { ok: true, timestamp };
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
