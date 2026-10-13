import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isPasskeyAvailable, isPasskeySupported } from '../api/passkey-native';
import { useAuth } from '../context/AuthContext';

export function PasskeyAutoLogin() {
    const { user, isLoading, loginWithPasskey } = useAuth();
    const hasAttemptedRef = useRef(false);
    const wasLoggedInRef = useRef(false);

    useEffect(() => {
        if (user) {
            wasLoggedInRef.current = true;
            return;
        }

        // Do not auto-login if session is still restoring, already attempted, or user explicitly logged out
        if (isLoading || hasAttemptedRef.current || wasLoggedInRef.current) return;

        let cancelled = false;

        async function trigger() {
            if (hasAttemptedRef.current || cancelled) return;
            hasAttemptedRef.current = true;
            try {
                if (!isPasskeySupported()) return;
                const available = await isPasskeyAvailable();
                if (!available || cancelled) return;
                await loginWithPasskey({ immediate: true });
            } catch {
                // Opportunistic check: fail silently
            }
        }

        if (AppState.currentState === 'active') {
            const timer = setTimeout(() => {
                void trigger();
            }, 300);
            return () => {
                cancelled = true;
                clearTimeout(timer);
            };
        }

        const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') {
                void trigger();
            }
        });

        return () => {
            cancelled = true;
            subscription.remove();
        };
    }, [isLoading, user, loginWithPasskey]);

    return null;
}
