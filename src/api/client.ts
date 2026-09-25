import { getAccessToken, refreshAccessToken } from './auth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://teetimenexus.com';

async function doFetch(path: string, options: RequestInit | undefined, accessToken: string | null) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options?.headers,
    },
  });
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured yet.');
  }

  let accessToken = await getAccessToken();
  let response = await doFetch(path, options, accessToken);

  // Access token likely expired: refresh once and retry before giving up.
  if (response.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doFetch(path, options, refreshed.access_token);
    }
  }

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
}