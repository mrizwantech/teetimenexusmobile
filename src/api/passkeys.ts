import { apiRequest } from './client';
import { createNativePasskey, passkeyPlatform } from './passkey-native';
import { parseAccountPasskeys, parsePasskeyCreateOptions } from './passkey-rules';

const PATH = '/wp-json/ttn/v1/auth/passkeys';

export async function getAccountPasskeys() {
    return parseAccountPasskeys(await apiRequest<unknown>(PATH));
}

export async function addAccountPasskey(label: string) {
    const platform = passkeyPlatform();
    const options = parsePasskeyCreateOptions(await apiRequest<unknown>(`${PATH}/register/options`, {
        method: 'POST', body: JSON.stringify({ platform }),
    }));
    const credential = await createNativePasskey(options.request);
    const response = await apiRequest<{ registered?: boolean }>(`${PATH}/register/verify`, {
        method: 'POST', body: JSON.stringify({ challenge_id: options.challengeId, credential, label: label.trim() }),
    });
    if (response?.registered !== true) throw new Error('The server did not confirm that your passkey was saved.');
}

export async function removeAccountPasskey(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid passkey ID. Reload your passkeys.');
    const response = await apiRequest<{ removed?: boolean }>(`${PATH}/${id}`, { method: 'DELETE' });
    if (response?.removed !== true) throw new Error('The server did not confirm that your passkey was removed.');
}
