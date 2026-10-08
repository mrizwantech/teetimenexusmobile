import { apiRequest } from './client';

export type MembershipPackage = {
    slug: string;
    title: string;
    price: number;
    discount_price: number | null;
    billing: string;
    featured: boolean;
    features: string[];
    thumbnail_url?: string | null;
};

export type MembershipRecord = {
    package_name: string;
    price: string;
    discount_price: string;
    status: string;
    payment_status: string;
    next_billing_date: string | null;
    cancel_date: string | null;
};

export function getMembershipPackages(): Promise<MembershipPackage[]> {
    return apiRequest<MembershipPackage[]>('/wp-json/ttn/v1/membership/packages');
}

export function getCurrentMembership(): Promise<MembershipRecord | null> {
    return apiRequest<MembershipRecord | null>('/wp-json/ttn/v1/membership/current');
}

export function startMembershipCheckout(packageSlug: string): Promise<{ bridge_url: string }> {
    return apiRequest<{ bridge_url: string }>('/wp-json/ttn/v1/membership/checkout', {
        method: 'POST',
        body: JSON.stringify({ package: packageSlug.toUpperCase() }),
    });
}

export function startGuestMembershipCheckout(params: {
    packageSlug: string;
    email: string;
    password: string;
    displayName: string;
}): Promise<{ bridge_url: string }> {
    return apiRequest<{ bridge_url: string }>('/wp-json/ttn/v1/membership/checkout-guest', {
        method: 'POST',
        body: JSON.stringify({
            package: params.packageSlug.toUpperCase(),
            email: params.email.trim(),
            password: params.password,
            display_name: params.displayName.trim(),
        }),
    });
}
