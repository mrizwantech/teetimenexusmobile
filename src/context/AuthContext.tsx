import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearKisiCredentials } from '../../modules/kisi-access';
import { releasePushDevice } from '../notifications/device-registration';

import {
    AuthUser,
    fetchCurrentUser,
    getAccessToken,
    hasStoredSession,
    login as apiLogin,
    loginWithApple as apiLoginWithApple,
    loginWithPasskey as apiLoginWithPasskey,
    logout as apiLogout,
    refreshAccessToken,
    registerAccount as apiRegisterAccount,
} from '../api/auth';

type AuthContextValue = {
    user: AuthUser | null;
    isLoading: boolean;
    signInSequence: number;
    login: (username: string, password: string) => Promise<void>;
    loginWithPasskey: (options?: { immediate?: boolean }) => Promise<boolean>;
    loginWithApple: (identityToken: string, nonce: string, name?: string, givenName?: string, familyName?: string) => Promise<void>;
    register: (params: { name: string; email: string; password: string; phone?: string; smsOptIn?: boolean; promoOptIn?: boolean }) => Promise<boolean>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [signInSequence, setSignInSequence] = useState(0);
    const mountedRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;
        let cancelled = false;

        (async () => {
            // Restore session on app start: a stored refresh token means the user was logged in.
            let restoredUser: AuthUser | null = null;
            if (await hasStoredSession()) {
                const refreshed = await refreshAccessToken();
                restoredUser = refreshed ? await fetchCurrentUser(refreshed.access_token) : null;
            }
            if (!cancelled) {
                setUser(restoredUser);
                setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            mountedRef.current = false;
        };
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            isLoading,
            signInSequence,
            login: async (username, password) => {
                const result = await apiLogin(username, password);
                if (mountedRef.current) {
                    setUser(result.user);
                    setSignInSequence((value) => value + 1);
                }
            },
            loginWithPasskey: async (options) => {
                const result = options ? await apiLoginWithPasskey(options) : await apiLoginWithPasskey();
                if (result && mountedRef.current) {
                    setUser(result.user);
                    setSignInSequence(0);
                    return true;
                }
                return false;
            },
            loginWithApple: async (identityToken, nonce, name, givenName, familyName) => {
                const result = await apiLoginWithApple({ identityToken, nonce, name, givenName, familyName });
                if (mountedRef.current) {
                    setUser(result.user);
                    setSignInSequence((value) => value + 1);
                }
            },
            register: async (params) => {
                const result = await apiRegisterAccount(params);
                if (mountedRef.current) {
                    setUser(result.user);
                    setSignInSequence((value) => value + 1);
                }
                return result.welcome_email_sent === true;
            },
            logout: async () => {
                await releasePushDevice();
                await clearKisiCredentials();
                await apiLogout();
                if (mountedRef.current) {
                    setUser(null);
                    setSignInSequence(0);
                }
            },
            refreshUser: async () => {
                const accessToken = await getAccessToken();
                const updatedUser = accessToken ? await fetchCurrentUser(accessToken) : null;
                if (!updatedUser) throw new Error('Unable to refresh your profile. Please sign in again.');
                if (mountedRef.current) setUser(updatedUser);
            },
        }),
        [user, isLoading, signInSequence]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider.');
    }
    return context;
}
