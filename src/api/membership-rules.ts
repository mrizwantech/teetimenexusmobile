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

function scalarText(value: unknown): string | null {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return null;
}

function optionalText(value: unknown): string {
    return value === null || value === undefined ? '' : scalarText(value) ?? '';
}

function optionalDate(value: unknown): string | null {
    const text = value === null || value === undefined ? null : scalarText(value);
    return text && text.trim() && !text.startsWith('0000-00-00') ? text : null;
}

function positiveTimestamp(value: unknown): number | null {
    const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    return Number.isSafeInteger(number) && Number(number) > 0 ? Number(number) : null;
}

// Legacy website responses send raw DB rows (nulls/numbers); management actions stay disabled unless every management field is valid.
export function parseCurrentMembership(value: unknown): MembershipRecord | null {
    if (value === null) return null;
    const packageName = isObject(value) ? scalarText(value.package_name)?.trim() : null;
    if (!isObject(value) || !packageName) {
        throw new Error('The website returned invalid membership details. Please try again.');
    }
    const record: MembershipRecord = {
        package_name: membershipDisplayName(packageName),
        price: optionalText(value.price),
        discount_price: optionalText(value.discount_price),
        status: optionalText(value.status).trim().toLowerCase(),
        payment_status: optionalText(value.payment_status).trim().toLowerCase(),
        next_billing_date: optionalDate(value.next_billing_date),
        cancel_date: optionalDate(value.cancel_date),
        package_key: typeof value.package_key === 'string' && value.package_key.trim() ? value.package_key : undefined,
        management_notice: typeof value.management_notice === 'string' ? value.management_notice : undefined,
        period_end: positiveTimestamp(value.period_end),
        scheduled_change: null,
    };
    let managementValid = value.can_manage !== undefined;
    if (value.scheduled_change !== undefined && value.scheduled_change !== null) {
        const change = value.scheduled_change;
        const effectiveAt = isObject(change) ? positiveTimestamp(change.effective_at) : null;
        if (isObject(change) && (change.action === 'cancel' || change.action === 'downgrade')
            && typeof change.package_name === 'string' && effectiveAt) {
            record.scheduled_change = { action: change.action, package_name: membershipDisplayName(change.package_name), effective_at: effectiveAt };
        } else {
            managementValid = false;
        }
    }
    if (typeof value.can_manage !== 'boolean'
        || typeof value.revision !== 'string' || !/^[a-f0-9]{64}$/.test(value.revision)
        || (value.period_end !== undefined && value.period_end !== null && record.period_end === null)) {
        managementValid = false;
    }
    if (managementValid) {
        record.revision = value.revision as string;
        record.can_manage = value.can_manage as boolean;
    } else if (value.can_manage !== undefined) {
        record.can_manage = false;
    }
    return record;
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
