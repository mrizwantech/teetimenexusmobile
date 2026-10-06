import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { AuthUser } from '../api/auth';
import { getMyMembership } from '../api/account';
import { BrandMark } from './BrandMark';
import { ScreenHeader } from './Screen';
import { useAuth } from '../context/AuthContext';
import { colors, radii, spacing } from '../theme';

type ProfileScreenProps = {
    user: AuthUser;
};

export function ProfileScreen({ user }: ProfileScreenProps) {
    const { logout } = useAuth();
    const [membership, setMembership] = useState<{ package_name: string; status: string } | null>(null);
    const initials = user.display_name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'MR';

    useEffect(() => {
        getMyMembership().then(setMembership).catch(() => setMembership(null));
    }, [user.id]);

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

            <View style={styles.menu}>
                <ProfileRow icon="♧" label="Membership" value={membership?.package_name || 'Founding Member'} onPress={() => router.push('/membership')} />
                <ProfileRow icon="▣" label="Payment Methods" value="•••• 4242" onPress={() => Alert.alert('Payment methods', 'Payment methods will be available here.')} />
                <ProfileRow icon="▣" label="Reservations" onPress={() => router.push('/reservations')} />
                <ProfileRow icon="♧" label="Notifications" onPress={() => router.push('/notifications')} />
                <ProfileRow icon="⚙" label="Account Settings" onPress={() => Alert.alert('Account settings', 'Account settings will be available here.')} />
                <ProfileRow icon="?" label="Help & Support" onPress={() => Alert.alert('Help & Support', 'Please contact Tee Time Nexus support.')} />
            </View>

            <Pressable accessibilityRole="button" onPress={logout} style={styles.logout}>
                <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
        </>
    );
}

function ProfileRow({ icon, label, value, onPress }: { icon: string; label: string; value?: string; onPress: () => void }) {
    return (
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
            <Text style={styles.rowIcon}>{icon}</Text>
            <Text style={styles.rowLabel}>{label}</Text>
            {value ? <Text numberOfLines={1} style={styles.rowValue}>{value}</Text> : null}
            <Text style={styles.chevron}>{value ? '' : '›'}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    headerLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    identity: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
    avatar: { alignItems: 'center', backgroundColor: colors.heading, borderRadius: 30, height: 58, justifyContent: 'center', width: 58 },
    avatarText: { color: colors.primaryContrast, fontSize: 18, fontWeight: '900' },
    identityCopy: { flex: 1, gap: 3 },
    name: { color: colors.heading, fontSize: 16, fontWeight: '800' },
    email: { color: colors.muted, fontSize: 12 },
    menu: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, overflow: 'hidden' },
    row: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md },
    rowIcon: { color: colors.heading, fontSize: 16, textAlign: 'center', width: 22 },
    rowLabel: { color: colors.text, flex: 1, fontSize: 12 },
    rowValue: { color: colors.primary, fontSize: 10, maxWidth: 125 },
    chevron: { color: colors.muted, fontSize: 22, lineHeight: 22, width: 12 },
    logout: { alignSelf: 'center', padding: spacing.md },
    logoutText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
});
