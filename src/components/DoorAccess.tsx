import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from './BrandMark';
import { BottomNav } from './BottomNav';
import { ScreenHeader } from './Screen';
import { colors, radii, spacing } from '../theme';

type DoorAccessProps = {
    visible: boolean;
    accessCode?: string;
    onClose: () => void;
};

export function DoorAccess({ visible, accessCode = '5327', onClose }: DoorAccessProps) {
    const [remainingSeconds, setRemainingSeconds] = useState(14 * 60 + 32);
    const openedAtRef = useRef<number | null>(null);

    useEffect(() => {
        if (!visible) return;
        openedAtRef.current = Date.now();
        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - (openedAtRef.current ?? Date.now())) / 1000);
            setRemainingSeconds(Math.max(14 * 60 + 32 - elapsed, 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [visible]);

    const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
    const seconds = String(remainingSeconds % 60).padStart(2, '0');

    function openDoor() {
        Alert.alert('Door access unavailable', 'The door can be opened shortly before your reservation.');
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
                <ScreenHeader>
                    <Pressable accessibilityRole="button" accessibilityLabel="Close door access" onPress={onClose} style={styles.closeButton}>
                        <Text style={styles.closeText}>‹</Text>
                    </Pressable>
                    <BrandMark />
                    <View style={styles.headerSpacer} />
                </ScreenHeader>
                <View style={styles.content}>
                    <Text style={styles.title}>Door Access Code</Text>
                    <Text style={styles.code}>{accessCode}</Text>
                    <Text style={styles.instruction}>Enter this code at the door{`\n`}and press Unlock.</Text>
                    <View style={styles.expiryCard}>
                        <Text style={styles.clock}>◷</Text>
                        <View>
                            <Text style={styles.expiryLabel}>Code expires in</Text>
                            <Text style={styles.expiryTime}>{minutes} : {seconds}</Text>
                        </View>
                    </View>
                    <Pressable accessibilityRole="button" onPress={openDoor} style={styles.openButton}>
                        <Text style={styles.openButtonText}>Open Door</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => Alert.alert('Need help?', 'Please contact Tee Time Nexus support.')}>
                        <Text style={styles.help}>Need Help?</Text>
                    </Pressable>
                </View>
                <BottomNav onNavigate={onClose} />
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: { backgroundColor: colors.bg, flex: 1 },
    closeButton: { padding: spacing.xs },
    closeText: { color: colors.heading, fontSize: 30 },
    headerSpacer: { width: 128 },
    content: { alignItems: 'center', flex: 1, gap: spacing.lg, justifyContent: 'center', padding: spacing.lg },
    title: { color: colors.heading, fontSize: 20, fontWeight: '800', marginTop: spacing.xl },
    code: { color: colors.primary, fontSize: 42, fontWeight: '900', letterSpacing: 5 },
    instruction: { color: colors.subtle, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    expiryCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    clock: { color: colors.heading, fontSize: 25 },
    expiryLabel: { color: colors.subtle, fontSize: 11 },
    expiryTime: { color: colors.primary, fontSize: 20, fontWeight: '800', marginTop: 2 },
    openButton: { borderColor: colors.primary, borderRadius: radii.pill, borderWidth: 1.5, minHeight: 50, justifyContent: 'center', paddingHorizontal: spacing.xxl, width: '100%' },
    openButtonText: { color: colors.primary, fontSize: 15, fontWeight: '800', textAlign: 'center', textTransform: 'capitalize' },
    help: { color: colors.primary, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
});
