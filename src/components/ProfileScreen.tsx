import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { AuthUser } from '../api/auth';
import { getMyMembership } from '../api/account';
import { isActivePaidMembership } from '../api/membership-rules';
import { BrandMark } from './BrandMark';
import { ContactEmailVerification } from './ContactEmailVerification';
import { ScreenHeader } from './Screen';
import { useAuth } from '../context/AuthContext';
import { colors, radii, spacing } from '../theme';

type ProfileScreenProps = {
    user: AuthUser;
};

export function ProfileScreen({ user }: ProfileScreenProps) {
    const { logout } = useAuth();
    const [loggingOut, setLoggingOut] = useState(false);
    const [membership, setMembership] = useState<Awaited<ReturnType<typeof getMyMembership>>>(null);
    const [membershipError, setMembershipError] = useState('');
    const initials = user.display_name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'MR';

    async function handleLogout() {
        if (loggingOut) return;
        setLoggingOut(true);
        try {
            await logout();
        } catch (error) {
            setLoggingOut(false);
            Alert.alert('Unable to log out', error instanceof Error ? error.message : 'Please try again.');
        }
    }

    useFocusEffect(useCallback(() => {
        if (!user.id) return;
        let active = true;
        setMembership(null);
        setMembershipError('');
        getMyMembership().then((result) => {
            if (active) setMembership(result);
        }).catch((err: unknown) => {
            if (active) setMembershipError(err instanceof Error ? err.message : 'Unable to load your membership. Please reopen Profile to try again.');
        });
        return () => { active = false; };
    }, [user.id]));

    return (
        <>
            <ScreenHeader>
                <BrandMark />
                <Text style={styles.headerLabel}>PROFILE</Text>
            </ScreenHeader>

            <View style={styles.identity}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
                <View style={styles.identityCopy}>
                    <Text style={styles.name}>{user.display_name}</Text>
                    <Text style={styles.email}>{user.email}</Text>
                </View>
            </View>

            <ContactEmailVerification key={user.id} />
            {membershipError ? <Text accessibilityRole="alert" style={styles.membershipError}>{membershipError}</Text> : null}

            <View style={styles.menu}>
                {isActivePaidMembership(membership) ? <ProfileRow icon="♧" label="Membership" value={membership.package_name} onPress={() => router.push('/membership')} /> : null}
                <ProfileRow icon="▣" label="Payment Methods" value="•••• 4242" onPress={() => Alert.alert('Payment methods', 'Payment methods will be available here.')} />
                <ProfileRow icon="▣" label="Reservations" onPress={() => router.push('/reservations')} />
                <ProfileRow icon="⚙" label="Settings" onPress={() => router.push('/settings')} />
                <ProfileRow icon="?" label="Help & Support" onPress={() => Alert.alert('Help & Support', 'Please contact Tee Time Nexus support.')} />
            </View>

            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log out"
                accessibilityState={{ disabled: loggingOut }}
                disabled={loggingOut}
                onPress={handleLogout}
                style={({ pressed }) => [styles.logout, pressed && !loggingOut && styles.pressed, loggingOut && styles.logoutDisabled]}
            >
                {loggingOut ? (
                    <View style={styles.logoutContent}>
                        <ActivityIndicator size="small" color={colors.danger} />
                        <Text style={styles.logoutText}>Logging out…</Text>
                    </View>
                ) : (
                    <Text style={styles.logoutText}>Log out</Text>
                )}
            </Pressable>
        </>
    );
}

function ProfileRow({ icon, label, value, onPress }: { icon: string; label: string; value?: string; onPress: () => void }) {
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
            <Text style={styles.rowIcon}>{icon}</Text>
            <Text style={styles.rowLabel}>{label}</Text>
            {value ? <Text style={styles.rowValue}>{value}</Text> : null}
            <Text style={styles.chevron}>{value ? '' : '›'}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    membershipError: { color: colors.danger, fontSize: 17, fontWeight: '500', lineHeight: 26 },
    headerLabel: { color: colors.muted, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
    identity: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
    avatar: { alignItems: 'center', backgroundColor: colors.heading, borderRadius: 30, height: 58, justifyContent: 'center', width: 58 },
    avatarText: { color: colors.primaryContrast, fontSize: 18, fontWeight: '900' },
    identityCopy: { flex: 1, gap: spacing.xs },
    name: { color: colors.heading, fontSize: 16, fontWeight: '800' },
    email: { color: colors.muted, fontSize: 14 },
    menu: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, overflow: 'hidden' },
    row: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 56, padding: spacing.md },
    rowIcon: { color: colors.heading, fontSize: 16, textAlign: 'center', width: 22 },
    rowLabel: { color: colors.text, flex: 1, fontSize: 14 },
    rowValue: { color: colors.primary, fontSize: 14, maxWidth: 125 },
    chevron: { color: colors.muted, fontSize: 22, lineHeight: 22, width: 12 },
    rowPressed: { backgroundColor: colors.surfaceSoft },
    logout: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    logoutContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    logoutDisabled: { opacity: 0.6 },
    pressed: { opacity: 0.6 },
    logoutText: { color: colors.danger, fontSize: 14, fontWeight: '800' },
});
