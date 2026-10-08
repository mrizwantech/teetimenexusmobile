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

type LoginResponse = TokenPair & { user: AuthUser; welcome_email_sent?: boolean };

export const PASSWORD_POLICY_MESSAGE = 'Use at least 8 characters, including an uppercase letter, a lowercase letter, a number, and a symbol.';

export function passwordMeetsPolicy(password: string): boolean {
    return password.length >= 8
        && /[A-Z]/.test(password)
        && /[a-z]/.test(password)
        && /[0-9]/.test(password)
        && /[^A-Za-z0-9\s]/.test(password);
}

export async function loginWithApple(params: {
    identityToken: string;
    nonce: string;
    name?: string;
}): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/wp-json/ttn/v1/auth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            identity_token: params.identityToken,
            nonce: params.nonce,
            name: params.name?.trim() ?? '',
        }).toString(),
    });

    if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
    }

    const data = await parseJsonResponse<LoginResponse>(response);
    await storeTokens(data);
    return data;
}

async function parseErrorMessage(response: Response): Promise<string> {
    try {
        const body = await response.json();
        if (typeof body?.message === 'string') return body.message;
    } catch {
        // Non-JSON error body; fall through to generic message.
    }
    return 'Something went wrong. Please try again.';
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text.trim()) {
        throw new Error('The server returned an empty response. Please try again.');
    }
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error('The server returned an invalid response. Please try again.');
    }
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

    const data = await parseJsonResponse<LoginResponse>(response);
    await storeTokens(data);
    return data;
}

export async function registerAccount(params: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    smsOptIn?: boolean;
    promoOptIn?: boolean;
}): Promise<LoginResponse> {
    if (!passwordMeetsPolicy(params.password)) {
        throw new Error(PASSWORD_POLICY_MESSAGE);
    }

    const response = await fetch(`${API_BASE_URL}/wp-json/ttn/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            name: params.name.trim(),
            email: params.email.trim(),
            password: params.password,
            phone: params.phone?.trim() ?? '',
            sms_opt_in: params.smsOptIn ? '1' : '0',
            promo_opt_in: params.promoOptIn ? '1' : '0',
        }).toString(),
    });

    if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
    }

    const data = await parseJsonResponse<LoginResponse>(response);
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

    const data = await parseJsonResponse<TokenPair>(response);
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
    return parseJsonResponse<AuthUser>(response);
}

export { clearTokens };
