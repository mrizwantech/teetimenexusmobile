import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from './BrandMark';
import { BottomNav } from './BottomNav';
import { PrimaryButton } from './PrimaryButton';
import { ScreenHeader } from './Screen';
import { createDoorCredential, DoorAccessState, DoorCredentialResponse, getDoorAccess, unlockEntrance } from '../api/door-access';
import { useAuth } from '../context/AuthContext';
import {
    clearKisiCredentials, getKisiProximityProof, initializeKisi, isKisiAvailable, onKisiReaderError,
    onKisiUnlock, startKisiReaderScan, stopKisiReaderScan,
} from '../../modules/kisi-access';
import { colors, radii, spacing } from '../theme';

type DoorAccessProps = {
    visible: boolean;
    bookingId: number;
    onClose: () => void;
};

export function DoorAccess({ visible, bookingId, onClose }: DoorAccessProps) {
    const { user } = useAuth();
    const [state, setState] = useState<DoorAccessState | null>(null);
    const [access, setAccess] = useState<DoorCredentialResponse | null>(null);
    const [busy, setBusy] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshMessage, setRefreshMessage] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [now, setNow] = useState(() => Date.now());
    const offset = useRef(0);
    const generation = useRef(0);
    const operating = useRef(false);
    const request = useRef(0);
    const checking = useRef(false);
    const credential = useRef<DoorCredentialResponse | null>(null);

    const clearAccess = useCallback(async () => {
        credential.current = null;
        try {
            await clearKisiCredentials();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Could not clear native door credentials. Close the app and contact support.');
        } finally {
            setAccess(null);
            setNotice('');
        }
    }, []);

    const refresh = useCallback(async (manual = false) => {
        if (checking.current) return;
        checking.current = true;
        const current = generation.current;
        const sequence = ++request.current;
        setRefreshing(true);
        setRefreshMessage('');
        setError('');
        try {
            const next = await getDoorAccess(bookingId);
            if (current !== generation.current || sequence !== request.current) return;
            offset.current = next.server_time - Date.now();
            setNow(next.server_time);
            setState(next);
            setError('');
            const saved = credential.current;
            if (next.status !== 'ready' || (saved && (saved.valid_from !== next.valid_from || saved.valid_until !== next.valid_until))) {
                await clearAccess();
            }
            if (manual && current === generation.current && sequence === request.current) {
                setRefreshMessage(next.status === 'ready'
                    ? 'Access checked. Your booking is eligible. Refresh does not unlock the door; use Enable Door Access or Open Door.'
                    : `Access checked. ${next.message}`);
            }
        } catch (failure) {
            if (current !== generation.current || sequence !== request.current) return;
            setState(null);
            setError(failure instanceof Error ? failure.message : 'Unable to verify door access.');
            await clearAccess();
        } finally {
            checking.current = false;
            if (sequence === request.current) setRefreshing(false);
        }
    }, [bookingId, clearAccess]);

    useEffect(() => {
        generation.current += 1;
        if (!visible || !user) return;
        const initialRequest = setTimeout(() => { void refresh(); }, 0);
        const timer = setInterval(() => {
            const timestamp = Date.now() + offset.current;
            setNow(timestamp);
            if (credential.current && timestamp >= credential.current.credential.validUntil) {
                void clearAccess();
            }
        }, 1000);
        const recheck = setInterval(() => { void refresh(); }, 60000);
        const appState = AppState.addEventListener('change', (status) => {
            if (status === 'active') void refresh();
            else if (status === 'background') {
                generation.current += 1;
                clearTimeout(initialRequest);
                void clearAccess();
            }
        });
        const unlock = isKisiAvailable() ? onKisiUnlock((event) => {
            if (event.success) setNotice('Kisi accepted the entrance unlock request.');
            else setError(event.error ?? 'Kisi could not unlock the entrance.');
        }) : null;
        const reader = isKisiAvailable() ? onKisiReaderError((event) => setError(event.message)) : null;
        return () => {
            generation.current += 1;
            clearTimeout(initialRequest);
            clearInterval(timer);
            clearInterval(recheck);
            appState.remove();
            unlock?.remove();
            reader?.remove();
            // Access is foreground-only until cancellation and offline reader behavior are device-tested.
            void clearAccess();
        };
    }, [visible, user, refresh, clearAccess]);

    async function enableAccess() {
        if (operating.current || checking.current) return;
        operating.current = true;
        const current = generation.current;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            if (!isKisiAvailable()) throw new Error('Door access requires a rebuilt iOS or Android app. It is unavailable in Expo Go and on web.');
            await startKisiReaderScan();
            if (current !== generation.current) return;
            const next = await createDoorCredential(bookingId);
            if (current !== generation.current) return;
            await initializeKisi(next.credential);
            if (current !== generation.current) {
                await clearAccess();
                return;
            }
            credential.current = next;
            setAccess(next);
            setState(next);
            offset.current = next.server_time - Date.now();
            setNow(next.server_time);
            setNotice('Door access enabled. Keep this screen open and tap your phone at the entrance reader, or use Open Door nearby.');
        } catch (failure) {
            if (current === generation.current) {
                setError(failure instanceof Error ? failure.message : 'Unable to enable door access.');
            }
            await clearAccess();
        } finally {
            operating.current = false;
            setBusy(false);
            if (current !== generation.current) {
                await stopKisiReaderScan().catch((failure: Error) => setError(failure.message));
            }
        }
    }

    async function openDoor() {
        if (!access || operating.current || checking.current) return;
        operating.current = true;
        setBusy(true);
        setError('');
        setNotice('Searching for the entrance reader. Keep Bluetooth on and stay near the reader.');
        const current = generation.current;
        try {
            await startKisiReaderScan();
            if (current !== generation.current) return;
            await unlockEntrance(access, async () => {
                return getKisiProximityProof(access.lock_id, () => {
                    if (current !== generation.current) throw new Error('Door access was closed. Reopen your reservation to retry.');
                });
            });
            setNotice('Kisi accepted the entrance unlock request.');
        } catch (failure) {
            await refresh();
            setNotice('');
            setError(failure instanceof Error ? failure.message : 'Unable to unlock the entrance.');
        } finally {
            operating.current = false;
            setBusy(false);
        }
    }

    const ready = Boolean(user) && state?.status === 'ready' && state.valid_until !== null && now < state.valid_until;
    const remaining = state?.valid_until ? Math.max(0, Math.ceil((state.valid_until - now) / 60000)) : 0;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={styles.screen} edges={['top']}>
                <ScreenHeader>
                    <Pressable accessibilityRole="button" accessibilityLabel="Close door access" onPress={onClose} style={styles.closeButton}>
                        <Text style={styles.closeText}>‹</Text>
                    </Pressable>
                    <BrandMark />
                    <View style={styles.headerSpacer} />
                </ScreenHeader>
                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.title}>Door Access</Text>
                    {!user ? <Text style={styles.instruction}>Sign in to the account that owns this reservation.</Text> : null}
                    {user && !state && !error && !refreshing ? <ActivityIndicator color={colors.primary} /> : null}
                    {user && state ? <Text style={styles.instruction}>{state.message}</Text> : null}
                    {user && state?.status === 'upcoming' && state.valid_from ? <Text style={styles.instruction}>Available from {new Date(state.valid_from).toLocaleString()}</Text> : null}
                    {ready ? <View style={styles.expiryCard}>
                        <Text style={styles.expiryLabel}>Booking access ends in {remaining} minute{remaining === 1 ? '' : 's'}</Text>
                    </View> : null}
                    {user && state?.status === 'ready' && !ready ? <Text style={styles.instruction}>Door access for this reservation has expired.</Text> : null}
                    {notice ? <Text accessibilityLiveRegion="polite" style={styles.instruction}>{notice}</Text> : null}
                    {refreshMessage ? <Text accessibilityLiveRegion="polite" style={styles.instruction}>{refreshMessage}</Text> : null}
                    {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
                    {ready && !access ? <PrimaryButton label="Enable Door Access" onPress={() => { void enableAccess(); }} disabled={busy || refreshing} /> : null}
                    {ready && access ? <PrimaryButton label="Open Door" onPress={() => { void openDoor(); }} disabled={busy || refreshing} /> : null}
                    {busy || refreshing ? <ActivityIndicator accessibilityLabel={refreshing ? 'Checking door access' : 'Updating door access'} color={colors.primary} /> : null}
                    {user ? <PrimaryButton label={refreshing ? 'Checking Access...' : 'Refresh Access'} secondary onPress={() => { void refresh(true); }} disabled={busy || refreshing} /> : null}
                    <PrimaryButton label="Device Settings" secondary onPress={() => {
                        void Linking.openSettings().catch((failure: Error) => setError(failure.message));
                    }} />
                    <Text style={styles.instruction}>Bluetooth and reader permissions are required. Access is limited to your member booking; this app does not open the door automatically.</Text>
                </ScrollView>
                <BottomNav onNavigate={onClose} />
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: { backgroundColor: colors.bg, flex: 1 },
    closeButton: { padding: spacing.xs },
    closeText: { color: colors.heading, fontSize: 30 },
    headerSpacer: { width: 32 },
    content: { alignItems: 'center', flexGrow: 1, gap: spacing.lg, justifyContent: 'center', padding: spacing.lg },
    title: { color: colors.heading, fontSize: 22, fontWeight: '800' },
    instruction: { color: colors.text, fontSize: 17, fontWeight: '500', lineHeight: 26, textAlign: 'center' },
    expiryCard: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
    expiryLabel: { color: colors.primary, fontSize: 16, fontWeight: '700', lineHeight: 24 },
    error: { color: colors.danger, fontSize: 17, fontWeight: '500', lineHeight: 26, textAlign: 'center' },
});
