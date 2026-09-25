import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://teetimenexus.com';

const ACCESS_TOKEN_KEY = 'ttn_access_token';
const REFRESH_TOKEN_KEY = 'ttn_refresh_token';

export type AuthUser = { id: number; email: string; display_name: string };

export type TokenPair = {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
};

type LoginResponse = TokenPair & { user: AuthUser };

async function parseErrorMessage(response: Response): Promise<string> {
    try {
        const body = await response.json();
        if (typeof body?.message === 'string') return body.message;
    } catch {
        // Non-JSON error body; fall through to generic message.
    }
    return 'Something went wrong. Please try again.';
}

export async function login(username: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/wp-json/ttn/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password }).toString(),
    });

    if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
    }

    const data = (await response.json()) as LoginResponse;
    await storeTokens(data);
    return data;
}

let inFlightRefresh: Promise<TokenPair | null> | null = null;

export async function refreshAccessToken(): Promise<TokenPair | null> {
    // Coalesce concurrent callers (e.g. React StrictMode's double-invoked effects) into a
    // single in-flight request, since refresh tokens are single-use and rotate on each call.
    if (inFlightRefresh) return inFlightRefresh;

    inFlightRefresh = performRefresh().finally(() => {
        inFlightRefresh = null;
    });

    return inFlightRefresh;
}

async function performRefresh(): Promise<TokenPair | null> {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    const response = await fetch(`${API_BASE_URL}/wp-json/ttn/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ refresh_token: refreshToken }).toString(),
    });

    if (!response.ok) {
        await clearTokens();
        return null;
    }

    const data = (await response.json()) as TokenPair;
    await storeTokens(data);
    return data;
}

export async function logout(): Promise<void> {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

    if (accessToken) {
        try {
            await fetch(`${API_BASE_URL}/wp-json/ttn/v1/auth/logout`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(refreshToken ? { refresh_token: refreshToken } : {}).toString(),
            });
        } catch {
            // Best-effort revocation; still clear local tokens even if the request fails.
        }
    }

    await clearTokens();
}

async function storeTokens(tokens: TokenPair): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.access_token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

async function clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function hasStoredSession(): Promise<boolean> {
    return (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)) !== null;
}

export async function fetchCurrentUser(accessToken: string): Promise<AuthUser | null> {
    const response = await fetch(`${API_BASE_URL}/wp-json/ttn/v1/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return null;
    return (await response.json()) as AuthUser;
}

export { clearTokens };
