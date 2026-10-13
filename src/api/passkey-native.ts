import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { PasskeyCreateRequest, PasskeyGetRequest } from 'react-native-passkey';

import { passkeyErrorMessage } from './passkey-rules';

export function passkeyPlatform(): 'ios' | 'android' {
    if ((Platform.OS !== 'ios' && Platform.OS !== 'android') ||
        Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        throw new Error('Passkeys require the installed iOS or Android app, not Expo Go or a web browser.');
    }
    return Platform.OS;
}

export function isPasskeySupported(): boolean {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
    return true;
}

export async function isPasskeyAvailable(): Promise<boolean> {
    if (!isPasskeySupported()) return false;
    try {
        const module = await import('react-native-passkey');
        return module.Passkey.isSupported();
    } catch {
        return false;
    }
}

async function nativePasskey() {
    passkeyPlatform();
    let module: typeof import('react-native-passkey');
    try {
        module = await import('react-native-passkey');
    } catch {
        throw new Error('This app build does not include passkeys. Update or rebuild the app and use another sign-in method for now.');
    }
    if (!module.Passkey.isSupported()) {
        throw new Error('Passkeys are not supported on this device. Use another sign-in method.');
    }
    return module.Passkey;
}

export async function createNativePasskey(request: PasskeyCreateRequest) {
    const passkey = await nativePasskey();
    try {
        return await passkey.create(request);
    } catch (error) {
        throw new Error(passkeyErrorMessage(error));
    }
}

export async function getNativePasskey(request: PasskeyGetRequest, options?: { immediate?: boolean }) {
    const passkey = await nativePasskey();
    try {
        if (options?.immediate) {
            return await passkey.getImmediate(request);
        }
        return await passkey.get(request);
    } catch (error) {
        throw new Error(passkeyErrorMessage(error));
    }
}
