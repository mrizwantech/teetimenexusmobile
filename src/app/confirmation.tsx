import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { CalendarCard } from '../components/CalendarCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { BrandMark } from '../components/BrandMark';
import { checkoutStyles as styles } from '../theme';

export default function ConfirmationScreen() {
    const { bay, date, time, duration, players } = useLocalSearchParams<{
        bay: string;
        date: string;
        time: string;
        duration: string;
        players: string;
    }>();

    return (
        <Screen>
            <ScreenHeader>
                <BrandMark />
                <Text style={styles.confirmationLabel}>CONFIRMED</Text>
            </ScreenHeader>
            <View style={styles.confirmationCenter}>
                <Text style={styles.confirmationTitle}>Booking confirmed</Text>
                <Text style={styles.confirmationBody}>Your bay is reserved. Save the details to your calendar so your next round is easy to find.</Text>
                {bay && date && time && duration && players ? (
                    <CalendarCard bay={bay} date={date} time={time} duration={Number(duration)} players={Number(players)} />
                ) : null}
                <PrimaryButton label="BACK TO HOME" onPress={() => router.replace('/')} />
            </View>
        </Screen>
    );
}
