import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
    AuthUser,
    fetchCurrentUser,
    hasStoredSession,
    login as apiLogin,
    logout as apiLogout,
    refreshAccessToken,
} from '../api/auth';

type AuthContextValue = {
    user: AuthUser | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
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
            login: async (username, password) => {
                const result = await apiLogin(username, password);
                if (mountedRef.current) setUser(result.user);
            },
            logout: async () => {
                await apiLogout();
                if (mountedRef.current) setUser(null);
            },
        }),
        [user, isLoading]
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
