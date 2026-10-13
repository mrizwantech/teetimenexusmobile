import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import { addAccountPasskey, getAccountPasskeys } from '../api/passkeys';
import { useAuth } from '../context/AuthContext';

export function PasskeyEnrollmentPrompt() {
    const { user, isLoading, signInSequence } = useAuth();
    const userId = user?.id;
    const currentUserId = useRef(userId);

    useEffect(() => {
        currentUserId.current = userId;
    }, [userId]);

    useEffect(() => {
        if (!userId || isLoading || !signInSequence || Platform.OS === 'web' ||
            Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
        let cancelled = false;
        const key = `ttn_passkey_prompt_${userId}`;
        const isCurrent = () => !cancelled && currentUserId.current === userId;

        async function enable() {
            try {
                // Recheck after the popup: enrollment may have happened on another device.
                if (!isCurrent() || (await getAccountPasskeys()).length > 0 || !isCurrent()) return;
                await addAccountPasskey(Platform.OS === 'ios' ? 'iPhone passkey' : 'Android passkey');
                if (isCurrent()) Alert.alert('Passkey enabled', 'You can now use a passkey to sign in. Manage your passkeys in Profile > Settings.');
            } catch (error) {
                if (isCurrent()) Alert.alert('Unable to enable passkey', error instanceof Error ? error.message : 'Please try again from Profile > Settings > Manage Passkeys.');
            }
        }

        async function offer() {
            try {
                if (await SecureStore.getItemAsync(key) === 'shown' || !isCurrent()) return;
                const passkeys = await getAccountPasskeys();
                if (!isCurrent() || passkeys.length > 0) return;
                await SecureStore.setItemAsync(key, 'shown');
                if (!isCurrent()) return;
                Alert.alert(
                    'Enable passkey?',
                    'Sign in faster using Face ID, your fingerprint, or your device screen lock. You can still use your password or Apple sign-in.',
                    [
                        { text: 'Not now', style: 'cancel' },
                        { text: 'Enable', onPress: () => void enable() },
                    ],
                    { cancelable: true }
                );
            } catch (error) {
                if (isCurrent()) Alert.alert('Unable to check passkeys', error instanceof Error ? error.message : 'You can manage passkeys in Profile > Settings.');
            }
        }

        void offer();
        return () => { cancelled = true; };
    }, [userId, isLoading, signInSequence]);

    return null;
}
