import { apiRequest } from './client';

export type ContactEmailStatus = {
    required: boolean;
    verified: boolean;
    email: string;
    pending_email: string | null;
};

async function requestStatus(path: string, body?: object): Promise<ContactEmailStatus> {
    const value = await apiRequest<unknown>(`/wp-json/ttn/v1/account/contact-email${path}`, body ? {
        method: 'POST',
        body: JSON.stringify(body),
    } : undefined);
    if (!value || typeof value !== 'object'
        || !('required' in value) || typeof value.required !== 'boolean'
        || !('verified' in value) || typeof value.verified !== 'boolean'
        || !('email' in value) || typeof value.email !== 'string'
        || !('pending_email' in value) || (value.pending_email !== null && typeof value.pending_email !== 'string')) {
        throw new Error('The website returned an invalid contact-email status. Please try again.');
    }
    return {
        required: value.required,
        verified: value.verified,
        email: value.email,
        pending_email: value.pending_email,
    };
}

export const getContactEmailStatus = () => requestStatus('');
export const sendContactEmailCode = (email: string) => requestStatus('/send', { email: email.trim() });
export const verifyContactEmailCode = (code: string) => requestStatus('/verify', { code: code.trim() });
