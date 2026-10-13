import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Text, TextInput } from 'react-native';
import { Link, Redirect, useFocusEffect } from 'expo-router';

import { addAccountPasskey, getAccountPasskeys, removeAccountPasskey } from '../api/passkeys';
import type { AccountPasskey } from '../api/passkey-rules';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { accountStyles as styles, colors } from '../theme';

export default function PasskeysScreen() {
    const { user, isLoading } = useAuth();
    const [passkeys, setPasskeys] = useState<AccountPasskey[] | null>(null);
    const [label, setLabel] = useState(Platform.OS === 'ios' ? 'iPhone passkey' : 'Android passkey');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const active = useRef(false);
    const submitting = useRef(false);
    const generation = useRef(0);

    const load = useCallback(async () => {
        const requestId = ++generation.current;
        try {
            const result = await getAccountPasskeys();
            if (active.current && requestId === generation.current) {
                setPasskeys(result);
                setError('');
            }
        } catch (err) {
            if (active.current && requestId === generation.current) {
                setError(err instanceof Error ? err.message : 'Unable to load your passkeys.');
            }
        }
    }, []);

    useFocusEffect(useCallback(() => {
        active.current = true;
        if (user) void load();
        return () => {
            active.current = false;
            generation.current++;
        };
    }, [user, load]));

    async function mutate(action: () => Promise<void>, success: string) {
        if (!active.current || submitting.current) return;
        submitting.current = true;
        generation.current++;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            await action();
            if (active.current) {
                setNotice(success);
                await load();
            }
        } catch (err) {
            if (active.current) setError(err instanceof Error ? err.message : 'Unable to update your passkeys.');
        } finally {
            submitting.current = false;
            if (active.current) setBusy(false);
        }
    }

    function add() {
        if (!label.trim()) {
            setError('Enter a name for this passkey.');
            return;
        }
        void mutate(() => addAccountPasskey(label), 'Passkey added. You can use it the next time you sign in.');
    }

    function remove(passkey: AccountPasskey) {
        Alert.alert('Remove passkey?', `Remove "${passkey.label}" from your account? Keep access to your password or Apple sign-in. This does not delete the saved passkey from your device's password manager or sign out existing sessions.`, [
            { text: 'Keep passkey', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => void mutate(
                () => removeAccountPasskey(passkey.id), 'Passkey removed. It can no longer sign in to your account.'
            ) },
        ]);
    }

    if (isLoading) return <Screen><ActivityIndicator accessibilityLabel="Loading account" color={colors.primary} /></Screen>;
    if (!user) return <Redirect href="/account" />;

    return (
        <Screen>
            <ScreenHeader>
                <BrandMark />
                <Link href="/settings"><Text style={{ color: colors.primary }}>Back to settings</Text></Link>
            </ScreenHeader>
            <Text accessibilityRole="header" style={styles.title}>Passkeys</Text>
            <Text style={styles.body}>Passkeys use your device&apos;s screen lock to sign in. Tee Time Nexus stores only the public key, never your fingerprint, Face ID data, or private key. Password and Apple sign-in still work.</Text>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {notice ? <Text accessibilityRole="alert" style={styles.body}>{notice}</Text> : null}
            <SectionCard>
                <Text style={styles.cardTitle}>Your passkeys</Text>
                {passkeys === null && !error ? <ActivityIndicator accessibilityLabel="Loading passkeys" color={colors.primary} /> : null}
                {passkeys?.length === 0 ? <Text style={styles.body}>No passkeys added yet.</Text> : null}
                {passkeys?.map((passkey) => (
                    <SectionCard key={passkey.id}>
                        <Text style={styles.cardTitle}>{passkey.label}</Text>
                        <Text style={styles.body}>Added {new Date(passkey.created_at).toLocaleDateString()}{passkey.last_used_at ? ` · Last used ${new Date(passkey.last_used_at).toLocaleDateString()}` : ''}</Text>
                        <PrimaryButton small secondary label={`Remove ${passkey.label}`} disabled={busy} onPress={() => remove(passkey)} />
                    </SectionCard>
                ))}
                <PrimaryButton secondary small label="Reload passkeys" disabled={busy} onPress={() => void load()} />
            </SectionCard>
            {Platform.OS !== 'web' ? <SectionCard>
                <Text style={styles.cardTitle}>Add a passkey</Text>
                <Text style={styles.body}>Only add a passkey on a device you trust. Your device or password manager will ask you to approve it.</Text>
                <TextInput accessibilityLabel="Passkey name" style={styles.input} value={label} onChangeText={setLabel} maxLength={80} editable={!busy} placeholder="Passkey name" placeholderTextColor={colors.subtle} />
                <PrimaryButton label={busy ? 'Please wait...' : 'Add passkey'} disabled={busy || passkeys === null || passkeys.length >= 10} onPress={add} />
            </SectionCard> : <Text style={styles.body}>Use the installed iOS or Android app to add a passkey.</Text>}
        </Screen>
    );
}
