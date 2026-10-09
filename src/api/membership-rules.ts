export type MembershipRecord = {
    package_name: string;
    package_key?: string;
    price: string;
    discount_price: string;
    status: string;
    payment_status: string;
    next_billing_date: string | null;
    cancel_date: string | null;
    revision?: string;
    period_end?: number | null;
    can_manage?: boolean;
    management_notice?: string;
    scheduled_change?: {
        action: 'cancel' | 'downgrade';
        package_name: string;
        effective_at: number;
    } | null;
};

export type MembershipManagementResult =
    | { bridge_url: string }
    | { message: string; membership: MembershipRecord };

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function membershipDisplayName(name: string): string {
    return ['ALBATROSS', 'EAGLE'].includes(name.trim().toUpperCase()) ? 'EAGLE' : name;
}

export function parseCurrentMembership(value: unknown): MembershipRecord | null {
    if (value === null) return null;
    if (!isObject(value)
        || !['package_name', 'price', 'discount_price', 'status', 'payment_status'].every((key) => typeof value[key] === 'string')
        || !['next_billing_date', 'cancel_date'].every((key) => value[key] === null || typeof value[key] === 'string')
        || (value.package_key !== undefined && typeof value.package_key !== 'string')
        || (value.revision !== undefined && (typeof value.revision !== 'string' || !/^[a-f0-9]{64}$/.test(value.revision)))
        || (value.can_manage !== undefined && typeof value.can_manage !== 'boolean')
        || (value.management_notice !== undefined && typeof value.management_notice !== 'string')
        || (value.period_end !== undefined && value.period_end !== null && (!Number.isSafeInteger(value.period_end) || Number(value.period_end) <= 0))) {
        throw new Error('The website returned invalid membership details. Please try again.');
    }
    let scheduledChange: MembershipRecord['scheduled_change'];
    if (value.scheduled_change !== undefined && value.scheduled_change !== null) {
        const change = value.scheduled_change;
        if (!isObject(change) || (change.action !== 'cancel' && change.action !== 'downgrade')
            || typeof change.package_name !== 'string' || !Number.isSafeInteger(change.effective_at) || Number(change.effective_at) <= 0) {
            throw new Error('The website returned an invalid scheduled membership change. Please try again.');
        }
        scheduledChange = { action: change.action, package_name: membershipDisplayName(change.package_name), effective_at: Number(change.effective_at) };
    }
    return {
        package_name: membershipDisplayName(String(value.package_name)),
        price: String(value.price), discount_price: String(value.discount_price),
        status: String(value.status), payment_status: String(value.payment_status),
        next_billing_date: value.next_billing_date as string | null,
        cancel_date: value.cancel_date as string | null,
        package_key: value.package_key as string | undefined,
        revision: value.revision as string | undefined,
        can_manage: value.can_manage as boolean | undefined,
        management_notice: value.management_notice as string | undefined,
        period_end: value.period_end as number | null | undefined,
        scheduled_change: scheduledChange ?? null,
    };
}

export function parseMembershipManagementResult(value: unknown): MembershipManagementResult {
    if (isObject(value)) {
        if (typeof value.bridge_url === 'string' && /^https:\/\//.test(value.bridge_url)) {
            return { bridge_url: value.bridge_url };
        }
        if (typeof value.message === 'string' && value.message.trim()) {
            const membership = parseCurrentMembership(value.membership);
            if (membership) return { message: value.message, membership };
        }
    }
    throw new Error('The website did not confirm your membership change. Refresh before trying again.');
}
