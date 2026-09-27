import { getAccessToken, refreshAccessToken } from './auth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://teetimenexus.com';

async function doFetch(path: string, options: RequestInit | undefined, accessToken: string | null) {
  // Let fetch set its own multipart boundary header when sending FormData.
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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

  const responseText = await response.text();

  if (!response.ok) {
    let message = `API request failed with status ${response.status}.`;
    if (responseText.trim()) {
      try {
        const errorBody = JSON.parse(responseText) as { message?: string };
        if (errorBody.message) message = errorBody.message;
      } catch {
        // Keep the generic status message when the server returns non-JSON text.
      }
    }
    throw new Error(message);
  }

  if (!responseText.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error('The server returned an invalid response. Please try again.');
  }
}