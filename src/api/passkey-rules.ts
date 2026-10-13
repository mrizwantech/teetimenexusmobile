import type { PasskeyCreateRequest, PasskeyGetRequest } from 'react-native-passkey';
import type { AuthUser, TokenPair } from './auth';

const RP_ID = 'teetimenexus.com';
const INVALID_RESPONSE = 'The server returned invalid passkey data. Please try again.';

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(INVALID_RESPONSE);
    return value as Record<string, unknown>;
}

function text(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) throw new Error(INVALID_RESPONSE);
    return value;
}

function binary(value: unknown, max = 2048): string {
    const result = text(value);
    if (result.length > max || !/^[A-Za-z0-9_-]+$/.test(result)) throw new Error(INVALID_RESPONSE);
    return result;
}

function ceremony(value: unknown) {
    const data = record(value);
    const challengeId = binary(data.challenge_id, 43);
    const options = record(data.publicKey);
    if (challengeId.length !== 43 || binary(options.challenge, 128).length < 32 ||
        options.timeout !== 60000) throw new Error(INVALID_RESPONSE);
    return { challengeId, options };
}

export function parsePasskeyLoginOptions(value: unknown): { challengeId: string; request: PasskeyGetRequest } {
    const { challengeId, options } = ceremony(value);
    if (options.rpId !== RP_ID || options.userVerification !== 'required' ||
        (options.allowCredentials !== undefined && (!Array.isArray(options.allowCredentials) || options.allowCredentials.length))) {
        throw new Error(INVALID_RESPONSE);
    }
    return { challengeId, request: {
        challenge: binary(options.challenge), rpId: RP_ID, userVerification: 'required', timeout: 60000,
    } };
}

export function parsePasskeyCreateOptions(value: unknown): { challengeId: string; request: PasskeyCreateRequest } {
    const { challengeId, options } = ceremony(value);
    const rp = record(options.rp);
    const user = record(options.user);
    const selection = record(options.authenticatorSelection);
    if (rp.id !== RP_ID || selection.userVerification !== 'required' ||
        selection.residentKey !== 'required' || selection.requireResidentKey !== true ||
        selection.authenticatorAttachment !== 'platform' || options.attestation !== 'none' ||
        !Array.isArray(options.pubKeyCredParams) || options.pubKeyCredParams.length !== 1 ||
        record(options.pubKeyCredParams[0]).alg !== -7 || record(options.pubKeyCredParams[0]).type !== 'public-key' ||
        !Array.isArray(options.excludeCredentials) || options.excludeCredentials.length > 10) {
        throw new Error(INVALID_RESPONSE);
    }
    const excludeCredentials = options.excludeCredentials.map((value) => {
        const item = record(value);
        if (item.type !== 'public-key') throw new Error(INVALID_RESPONSE);
        return { type: 'public-key' as const, id: binary(item.id) };
    });
    return { challengeId, request: {
        challenge: binary(options.challenge),
        rp: { id: RP_ID, name: text(rp.name) },
        user: { id: binary(user.id, 86), name: text(user.name), displayName: text(user.displayName) },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 60000, excludeCredentials, attestation: 'none',
        authenticatorSelection: {
            authenticatorAttachment: 'platform', requireResidentKey: true,
            residentKey: 'required', userVerification: 'required',
        },
    } };
}

export function parsePasskeySession(value: unknown): TokenPair & { user: AuthUser } {
    const data = record(value);
    const user = record(data.user);
    if (data.token_type !== 'Bearer' || typeof data.expires_in !== 'number' ||
        !Number.isSafeInteger(data.expires_in) || data.expires_in <= 0 ||
        typeof user.id !== 'number' || !Number.isSafeInteger(user.id) || user.id <= 0) {
        throw new Error(INVALID_RESPONSE);
    }
    return {
        access_token: text(data.access_token), refresh_token: text(data.refresh_token),
        expires_in: data.expires_in, token_type: 'Bearer',
        user: { id: user.id, email: text(user.email), display_name: text(user.display_name) },
    };
}

export type AccountPasskey = { id: string; label: string; created_at: string; last_used_at: string | null };

export function parseAccountPasskeys(value: unknown): AccountPasskey[] {
    const data = record(value);
    if (!Array.isArray(data.passkeys) || data.passkeys.length > 10) throw new Error(INVALID_RESPONSE);
    const seen = new Set<string>();
    return data.passkeys.map((value) => {
        const item = record(value);
        const id = text(item.id);
        const created = text(item.created_at);
        const used = item.last_used_at === null ? null : text(item.last_used_at);
        if (!/^[a-f0-9]{64}$/.test(id) || seen.has(id) ||
            !Number.isFinite(Date.parse(created)) || (used !== null && !Number.isFinite(Date.parse(used)))) {
            throw new Error(INVALID_RESPONSE);
        }
        seen.add(id);
        return { id, label: text(item.label), created_at: created, last_used_at: used };
    });
}

export function passkeyErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'error' in error) {
        switch (error.error) {
            case 'UserCancelled': return 'Passkey request cancelled. You can try again or use another sign-in method.';
            case 'NoCredentials': return 'No passkey was found. Sign in with your password or Apple, then add a passkey in Settings.';
            case 'CredentialAlreadyExists': return 'A passkey for this account already exists on this device.';
            case 'NotSupported':
            case 'NoCreateOption': return 'Passkeys are not available on this device. Use another sign-in method.';
            case 'BadConfiguration': return 'Passkeys are not configured for this app build. Please use another sign-in method.';
            case 'TimedOut':
            case 'Interrupted': return 'Passkey verification was interrupted or timed out. Please try again.';
        }
        const code = typeof error.error === 'string' ? error.error : 'Unknown';
        const detail = 'message' in error && typeof error.message === 'string' ? error.message.trim() : '';
        if (detail) {
            return `Passkey request failed (${code}): ${detail} Check that this app build supports passkeys and try again from Settings.`;
        }
        return `Passkey request failed (${code}). Please try again from Settings or use another sign-in method.`;
    }
    if (error instanceof Error) return error.message;
    return 'The passkey request failed. Please try again or use another sign-in method.';
}
