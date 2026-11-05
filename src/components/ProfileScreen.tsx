import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { AuthUser, reauthenticateWithApple, reauthenticateWithPasskey } from '../api/auth';
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
    const { logout, deleteAccount } = useAuth();
    const [loggingOut, setLoggingOut] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteVerificationVisible, setDeleteVerificationVisible] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [verifyingWithProvider, setVerifyingWithProvider] = useState(false);
    const [membership, setMembership] = useState<Awaited<ReturnType<typeof getMyMembership>>>(null);
    const [membershipError, setMembershipError] = useState('');
    const initials = user.display_name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'MR';

    async function handleLogout() {
        if (loggingOut || deletingAccount) return;
        setLoggingOut(true);
        try {
            await logout();
        } catch (error) {
            setLoggingOut(false);
            Alert.alert('Unable to log out', error instanceof Error ? error.message : 'Please try again.');
        }
    }

    async function performAccountDeletion(password?: string) {
        if (loggingOut || deletingAccount) return;
        setDeletingAccount(true);
        setDeleteError('');
        try {
            const result = await deleteAccount(password);
            setDeleteVerificationVisible(false);
            setDeletePassword('');
            Alert.alert('Account deleted', result.localCleanupWarning ?? 'Your Tee Time Nexus account has been permanently deleted.');
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setDeletingAccount(false);
        }
    }

    async function verifyWithPasskey() {
        if (verifyingWithProvider || deletingAccount) return;
        setVerifyingWithProvider(true);
        setDeleteError('');
        try {
            await reauthenticateWithPasskey(user.id);
            await performAccountDeletion();
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : 'Unable to verify your passkey. Please try again.');
        } finally {
            setVerifyingWithProvider(false);
        }
    }

    async function verifyWithApple() {
        if (verifyingWithProvider || deletingAccount) return;
        setVerifyingWithProvider(true);
        setDeleteError('');
        try {
            if (!(await AppleAuthentication.isAvailableAsync())) {
                throw new Error('Sign in with Apple is unavailable on this device. Use your password or a passkey.');
            }
            const nonce = Crypto.randomUUID();
            const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
            const credential = await AppleAuthentication.signInAsync({ nonce: hashedNonce });
            if (!credential.identityToken) {
                throw new Error('Apple did not return an identity token. Please try again.');
            }
            await reauthenticateWithApple({ identityToken: credential.identityToken, nonce, expectedUserId: user.id });
            await performAccountDeletion();
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') return;
            setDeleteError(error instanceof Error ? error.message : 'Unable to verify with Apple. Please try again.');
        } finally {
            setVerifyingWithProvider(false);
        }
    }

    function confirmAccountDeletion() {
        if (loggingOut || deletingAccount) return;
        Alert.alert(
            'Delete your account?',
            'This permanently deletes your account. It does not cancel reservations or payment obligations or issue refunds. Some booking and payment records may be retained for legal, accounting, security, or dispute-resolution purposes. If you have any issue, contact customer service at sales@teetimenexus.com.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    style: 'destructive',
                    onPress: () => Alert.alert(
                        'Permanently delete account?',
                        'This action cannot be undone. Do you want to delete your account now?',
                        [
                            { text: 'Keep Account', style: 'cancel' },
                            {
                                text: 'Continue to verification',
                                style: 'destructive',
                                onPress: () => {
                                    setDeleteError('');
                                    setDeletePassword('');
                                    setDeleteVerificationVisible(true);
                                },
                            },
                        ],
                    ),
                },
            ],
        );
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
                accessibilityState={{ disabled: loggingOut || deletingAccount }}
                disabled={loggingOut || deletingAccount}
                onPress={handleLogout}
                style={({ pressed }) => [styles.logout, pressed && !loggingOut && !deletingAccount && styles.pressed, (loggingOut || deletingAccount) && styles.logoutDisabled]}
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

            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete account"
                accessibilityState={{ disabled: loggingOut || deletingAccount }}
                disabled={loggingOut || deletingAccount}
                onPress={confirmAccountDeletion}
                style={({ pressed }) => [styles.deleteAccount, pressed && !loggingOut && !deletingAccount && styles.pressed, (loggingOut || deletingAccount) && styles.logoutDisabled]}
            >
                {deletingAccount ? (
                    <View style={styles.logoutContent}>
                        <ActivityIndicator size="small" color={colors.danger} />
                        <Text style={styles.logoutText}>Deleting account…</Text>
                    </View>
                ) : (
                    <Text style={styles.logoutText}>Delete Account</Text>
                )}
            </Pressable>

            <Modal
                animationType="slide"
                onRequestClose={() => {
                    if (!deletingAccount && !verifyingWithProvider) setDeleteVerificationVisible(false);
                }}
                transparent
                visible={deleteVerificationVisible}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.deleteModalBackdrop}>
                    <ScrollView contentContainerStyle={styles.deleteModalScroll} keyboardShouldPersistTaps="handled">
                      <View style={styles.deleteModalCard}>
                        <Text style={styles.deleteModalTitle}>Verify it’s you</Text>
                        <Text style={styles.deleteModalBody}>Enter your account password, or verify with Apple or a passkey to continue deleting your account.</Text>
                        {deleteError ? <Text accessibilityRole="alert" style={styles.deleteError}>{deleteError}</Text> : null}
                        <TextInput
                            accessibilityLabel="Account password"
                            autoCapitalize="none"
                            autoComplete="current-password"
                            editable={!deletingAccount && !verifyingWithProvider}
                            onChangeText={setDeletePassword}
                            onSubmitEditing={() => void performAccountDeletion(deletePassword)}
                            placeholder="Account password"
                            placeholderTextColor={colors.subtle}
                            returnKeyType="done"
                            secureTextEntry
                            style={styles.deletePasswordInput}
                            value={deletePassword}
                        />
                        <Pressable
                            accessibilityRole="button"
                            disabled={!deletePassword || deletingAccount || verifyingWithProvider}
                            onPress={() => void performAccountDeletion(deletePassword)}
                            style={({ pressed }) => [styles.deleteVerifyButton, (pressed || !deletePassword || deletingAccount || verifyingWithProvider) && styles.deleteVerifyDisabled]}
                        >
                            {deletingAccount ? <ActivityIndicator color={colors.primaryContrast} /> : <Text style={styles.deleteVerifyText}>Verify & Delete Account</Text>}
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            disabled={deletingAccount || verifyingWithProvider}
                            onPress={() => void verifyWithPasskey()}
                            style={({ pressed }) => [styles.deleteAltButton, pressed && styles.rowPressed, (deletingAccount || verifyingWithProvider) && styles.deleteVerifyDisabled]}
                        >
                            <Text style={styles.deleteAltText}>{verifyingWithProvider ? 'Verifying…' : 'Use a passkey'}</Text>
                        </Pressable>
                        {Platform.OS === 'ios' ? (
                            <Pressable
                                accessibilityRole="button"
                                disabled={deletingAccount || verifyingWithProvider}
                                onPress={() => void verifyWithApple()}
                                style={({ pressed }) => [styles.deleteAltButton, pressed && styles.rowPressed, (deletingAccount || verifyingWithProvider) && styles.deleteVerifyDisabled]}
                            >
                                <Text style={styles.deleteAltText}>Continue with Apple</Text>
                            </Pressable>
                        ) : null}
                        <Text style={styles.deleteSupport}>Need help? Contact customer service at sales@teetimenexus.com.</Text>
                        <Pressable
                            accessibilityRole="button"
                            disabled={deletingAccount || verifyingWithProvider}
                            onPress={() => {
                                setDeleteVerificationVisible(false);
                                setDeletePassword('');
                                setDeleteError('');
                            }}
                            style={styles.deleteCancelButton}
                        >
                            <Text style={styles.deleteCancelText}>Cancel</Text>
                        </Pressable>
                      </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
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
    deleteAccount: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm },
    logoutContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    logoutDisabled: { opacity: 0.6 },
    pressed: { opacity: 0.6 },
    logoutText: { color: colors.danger, fontSize: 14, fontWeight: '800' },
    deleteModalBackdrop: { backgroundColor: 'rgba(0,0,0,0.72)', flex: 1 },
    deleteModalScroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
    deleteModalCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
    deleteModalTitle: { color: colors.heading, fontSize: 20, fontWeight: '800' },
    deleteModalBody: { color: colors.text, fontSize: 16, lineHeight: 24 },
    deleteError: { color: colors.danger, fontSize: 14, lineHeight: 20 },
    deletePasswordInput: { backgroundColor: colors.bg, borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 52, paddingHorizontal: spacing.md },
    deleteVerifyButton: { alignItems: 'center', backgroundColor: colors.danger, borderRadius: radii.sm, justifyContent: 'center', minHeight: 50, padding: spacing.md },
    deleteVerifyDisabled: { opacity: 0.6 },
    deleteVerifyText: { color: colors.primaryContrast, fontSize: 16, fontWeight: '800' },
    deleteAltButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, justifyContent: 'center', minHeight: 48, padding: spacing.md },
    deleteAltText: { color: colors.text, fontSize: 16, fontWeight: '700' },
    deleteSupport: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    deleteCancelButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
    deleteCancelText: { color: colors.muted, fontSize: 16, fontWeight: '700' },
});
