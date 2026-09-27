import { apiRequest } from './client';
import * as FileSystem from 'expo-file-system/legacy';
import { getAccessToken } from './auth';

export function getVerificationStatus(): Promise<{ verified: boolean }> {
    return apiRequest<{ verified: boolean }>('/wp-json/ttn/v1/verification-status');
}

export async function submitVerification(params: {
    idDocumentUri: string;
    idDocumentName: string;
    idDocumentType: string;
    signatureDataUrl: string;
}): Promise<{ verified: boolean }> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        throw new Error('Please log in again before uploading verification documents.');
    }

    const response = await FileSystem.uploadAsync(
        'https://teetimenexus.com/wp-json/ttn/v1/verification',
        params.idDocumentUri,
        {
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'id_document',
            mimeType: params.idDocumentType,
            parameters: {
                signature: params.signatureDataUrl,
                terms_accepted: '1',
            },
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        },
    );

    const data = JSON.parse(response.body) as { verified?: boolean; message?: string };
    if (response.status < 200 || response.status >= 300) {
        throw new Error(data.message ?? 'Unable to upload verification documents.');
    }

    return { verified: Boolean(data.verified) };
}
