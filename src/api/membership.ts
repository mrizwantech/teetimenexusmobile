import { apiRequest } from './client';
import { isRecord } from './home-content';
import { getCachedPublicContent, PUBLIC_CONTENT_CACHE_MAX_AGE_MS } from './public-content-cache';

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

function isMembershipPackage(value: unknown): value is MembershipPackage {
    return isRecord(value)
        && typeof value.slug === 'string'
        && typeof value.title === 'string'
        && typeof value.price === 'number'
        && (value.discount_price === null || typeof value.discount_price === 'number')
        && typeof value.billing === 'string'
        && typeof value.featured === 'boolean'
        && Array.isArray(value.features)
        && value.features.every((feature) => typeof feature === 'string')
        && (value.thumbnail_url === undefined || value.thumbnail_url === null || typeof value.thumbnail_url === 'string');
}

function parseMembershipPackages(value: unknown): MembershipPackage[] {
    if (!Array.isArray(value) || !value.every(isMembershipPackage)) {
        throw new Error('The website returned invalid membership packages. Please try again.');
    }
    return value;
}

export function getMembershipPackages(forceRefresh = false): Promise<MembershipPackage[]> {
    return getCachedPublicContent({
        key: 'membership-packages',
        maxAgeMs: PUBLIC_CONTENT_CACHE_MAX_AGE_MS,
        request: () => apiRequest<unknown>('/wp-json/ttn/v1/membership/packages'),
        parse: parseMembershipPackages,
        forceRefresh,
    });
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
