import { apiRequest } from './client';

export async function deleteAccount(password?: string): Promise<void> {
    const result = await apiRequest<unknown>('/wp-json/ttn/v1/account', {
        method: 'DELETE',
        cache: 'no-store',
        body: JSON.stringify({ confirm: true, ...(password ? { password } : {}) }),
    });
    if (!result || typeof result !== 'object' || !('deleted' in result) || result.deleted !== true) {
        throw new Error('The server did not confirm that your account was deleted. Please try again.');
    }
}
