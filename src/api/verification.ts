import { apiRequest } from './client';

export function getVerificationStatus(): Promise<{ verified: boolean }> {
    return apiRequest<{ verified: boolean }>('/wp-json/ttn/v1/verification-status');
}

export function submitVerification(params: {
    idDocumentUri: string;
    idDocumentName: string;
    idDocumentType: string;
    signatureDataUrl: string;
}): Promise<{ verified: boolean }> {
    const form = new FormData();
    form.append('id_document', {
        uri: params.idDocumentUri,
        name: params.idDocumentName,
        type: params.idDocumentType,
    } as unknown as Blob);
    form.append('signature', params.signatureDataUrl);
    form.append('terms_accepted', '1');

    return apiRequest<{ verified: boolean }>('/wp-json/ttn/v1/verification', {
        method: 'POST',
        body: form,
    });
}
