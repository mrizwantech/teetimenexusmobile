import { apiRequest } from './client';

export type CheckoutRequest = {
    bay: string;
    date: string;
    time: string;
    duration: number;
    players: number;
};

export function startCheckout(params: CheckoutRequest): Promise<{ bridge_url: string }> {
    return apiRequest<{ bridge_url: string }>('/wp-json/ttn/v1/checkout/start', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}
