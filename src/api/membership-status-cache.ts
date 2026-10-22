import type { MembershipRecord } from './membership-rules';

export const MEMBERSHIP_STATUS_CACHE_MS = 5 * 60 * 1000;

/** Owner identity is the session's user object, so a new login cannot reuse an old session's status. */
export function createMembershipStatusCache(load: () => Promise<MembershipRecord | null>, now = Date.now) {
    type Entry = { pending: Promise<MembershipRecord | null>; expiresAt: number };
    const entries = new WeakMap<object, Entry>();

    function get(owner: object, forceRefresh = false): Promise<MembershipRecord | null> {
        const cached = entries.get(owner);
        if (!forceRefresh && cached && now() < cached.expiresAt) return cached.pending;
        const entry: Entry = { pending: Promise.resolve(null), expiresAt: Infinity };
        entry.pending = load().then((value) => {
            entry.expiresAt = now() + MEMBERSHIP_STATUS_CACHE_MS;
            return value;
        }, (error: unknown) => {
            if (entries.get(owner) === entry) entries.delete(owner);
            throw error;
        });
        entries.set(owner, entry);
        return entry.pending;
    }

    function invalidate(owner: object) {
        entries.delete(owner);
    }

    return { get, invalidate };
}
