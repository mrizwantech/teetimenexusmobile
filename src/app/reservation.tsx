import { useLocalSearchParams } from 'expo-router';

import { BookingDetails } from '../components/BookingDetails';
import { Screen } from '../components/Screen';

export default function ReservationScreen() {
    const { bookingId = '', bay = 'Simulator bay', date = '', time = '', duration = '1', players = '1', bayIndex = '0' } = useLocalSearchParams<{
        bookingId?: string;
        bay?: string;
        date?: string;
        time?: string;
        duration?: string;
        players?: string;
        bayIndex?: string;
    }>();

    return (
        <Screen>
            <BookingDetails
                bookingId={Number(bookingId)}
                bay={bay}
                date={date}
                time={time}
                duration={Number(duration)}
                players={Number(players)}
                bayIndex={Number(bayIndex)}
            />
        </Screen>
    );
}
