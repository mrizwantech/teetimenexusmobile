import { Alert, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import { openAppleCalendar, openGoogleCalendar } from './CalendarCard';
import { BayCard } from './BayCard';
import { BookingActionIcon } from './BookingActionIcon';
import { BookingPolicyLink } from './BookingPolicyLink';
import { DoorAccess } from './DoorAccess';
import { PrimaryButton } from './PrimaryButton';
import { ScreenHeader } from './Screen';
import { colors, radii, spacing } from '../theme';

type BookingDetailsProps = {
    bookingId: number;
    bay: string;
    date: string;
    time: string;
    duration: number;
    players: number;
    bayIndex?: number;
};

function formatReservationDate(date: string): string {
    const parsedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return date;
    return parsedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

export function BookingDetails({ bookingId, bay, date, time, duration, players, bayIndex = 0 }: BookingDetailsProps) {
    const bayRecord = { key: bay, name: bay, type: 'dual' as const, location: 'Tee Time Nexus', premium: false, hourly_price: 0 };
    const [inviteVisible, setInviteVisible] = useState(false);
    const [inviteName, setInviteName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePhone, setInvitePhone] = useState('');
    const [doorAccessVisible, setDoorAccessVisible] = useState(false);

    function showAccessMessage() {
        setDoorAccessVisible(true);
    }

    function invitePlayers() {
        setInviteVisible(true);
    }

    function sendInvite() {
        if (!inviteName.trim() || !inviteEmail.trim() || !invitePhone.trim()) {
            Alert.alert('Missing details', 'Enter the player name, email, and phone number.');
            return;
        }

        const subject = encodeURIComponent(`Tee Time Nexus invitation - ${bay}`);
        const body = encodeURIComponent(`Hi ${inviteName}, you are invited to play at Tee Time Nexus on ${date} at ${time}. Contact phone: ${invitePhone}.`);
        setInviteVisible(false);
        Linking.openURL(`mailto:${inviteEmail.trim()}?subject=${subject}&body=${body}`);
    }

    function openDirections() {
        Linking.openURL('http://maps.apple.com/?q=Tee%20Time%20Nexus');
    }

    return (
        <>
            <ScreenHeader>
                <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}>
                    <Text style={styles.back}>‹</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Your Reservation</Text>
                <View style={styles.headerSpacer} />
            </ScreenHeader>

            <View style={styles.bayCardContainer}>
                <BayCard bay={bayRecord} index={bayIndex} selected fullWidth onPress={() => undefined} />
            </View>

            <View style={styles.detailsCard}>
                <DetailRow icon="▣" text={formatReservationDate(date)} />
                <DetailRow icon="◷" text={`${time} - ${time} (${duration} hour${duration === 1 ? '' : 's'})`} />
                <DetailRow icon="♧" text={`${players} ${players === 1 ? 'Player' : 'Players'}`} />
            </View>

            <View style={styles.accessCard}>
                <View style={styles.accessIcon}><Text style={styles.accessIconText}>▣</Text></View>
                <View style={styles.accessCopy}>
                    <Text style={styles.accessTitle}>Access</Text>
                    <Text style={styles.accessBody}>Active, paid members can access the entrance from 15 minutes before their reservation until it ends.</Text>
                </View>
                <PrimaryButton label="Unlock Door" onPress={showAccessMessage} />
            </View>

            <View style={styles.actions}>
                <ActionButton icon="calendar" label="Add to\nCalendar" onPress={() => Alert.alert('Add to Calendar', 'Choose a calendar', [
                    { text: 'Apple Calendar', onPress: () => openAppleCalendar(date, time) },
                    { text: 'Google Calendar', onPress: () => openGoogleCalendar(bay, date, time, duration, players) },
                    { text: 'Cancel', style: 'cancel' },
                ])} />
                <ActionButton icon="players" label="Invite\nPlayers" onPress={invitePlayers} />
                <ActionButton icon="directions" label="Directions" onPress={openDirections} />
            </View>

            <Modal visible={inviteVisible} transparent animationType="slide" onRequestClose={() => setInviteVisible(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Invite Players</Text>
                        <TextInput style={styles.modalInput} placeholder="Name" placeholderTextColor={colors.subtle} value={inviteName} onChangeText={setInviteName} />
                        <TextInput style={styles.modalInput} placeholder="Email" placeholderTextColor={colors.subtle} keyboardType="email-address" autoCapitalize="none" value={inviteEmail} onChangeText={setInviteEmail} />
                        <TextInput style={styles.modalInput} placeholder="Phone number" placeholderTextColor={colors.subtle} keyboardType="phone-pad" value={invitePhone} onChangeText={setInvitePhone} />
                        <PrimaryButton label="SEND INVITE" onPress={sendInvite} />
                        <PrimaryButton label="CANCEL" secondary onPress={() => setInviteVisible(false)} />
                    </View>
                </View>
            </Modal>

            <Pressable accessibilityRole="button" onPress={() => Alert.alert('Cancel or reschedule', 'Please contact Tee Time Nexus support to change this reservation.')}>
                <Text style={styles.cancel}>Cancel / Reschedule</Text>
            </Pressable>
            <BookingPolicyLink />

            {doorAccessVisible ? <DoorAccess bookingId={bookingId} visible onClose={() => setDoorAccessVisible(false)} /> : null}
        </>
    );
}

function DetailRow({ icon, text }: { icon: string; text: string }) {
    return (
        <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>{icon}</Text>
            <Text style={styles.detailText}>{text}</Text>
        </View>
    );
}

function ActionButton({ icon, label, onPress }: { icon: 'calendar' | 'players' | 'directions'; label: string; onPress: () => void }) {
    return (
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionButton}>
            <BookingActionIcon name={icon} />
            <Text style={styles.actionLabel}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    back: { color: colors.heading, fontSize: 30, lineHeight: 30 },
    headerTitle: { color: colors.heading, fontSize: 14, fontWeight: '800' },
    headerSpacer: { width: 24 },
    bayCardContainer: { alignItems: 'stretch' },
    detailsCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
    detailRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
    detailIcon: { color: colors.heading, fontSize: 17, textAlign: 'center', width: 20 },
    detailText: { color: colors.text, flex: 1, fontSize: 16 },
    accessCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
    accessIcon: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: radii.sm, height: 36, justifyContent: 'center', width: 36 },
    accessIconText: { color: colors.primary, fontSize: 18 },
    accessCopy: { gap: 3 },
    accessTitle: { color: colors.heading, fontSize: 14, fontWeight: '800' },
    accessBody: { color: colors.text, fontSize: 17, fontWeight: '500', lineHeight: 26 },
    actions: { flexDirection: 'row', gap: spacing.sm },
    actionButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flex: 1, gap: 4, paddingVertical: spacing.sm },
    actionIcon: { color: colors.heading, fontSize: 17 },
    actionLabel: { color: colors.text, fontSize: 14, textAlign: 'center' },
    modalBackdrop: { backgroundColor: 'rgba(0, 0, 0, 0.72)', flex: 1, justifyContent: 'flex-end' },
    modalCard: { backgroundColor: colors.bg, borderColor: colors.borderStrong, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
    modalTitle: { color: colors.heading, fontSize: 22, fontWeight: '900', marginBottom: spacing.sm },
    modalInput: { backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, color: colors.text, padding: spacing.md },
    cancel: { color: '#F87171', fontSize: 14, fontWeight: '800', paddingVertical: spacing.sm, textAlign: 'center', textDecorationLine: 'underline' },
});
