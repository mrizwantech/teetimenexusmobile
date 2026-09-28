import { Text } from 'react-native';

import { BookingList } from '../components/BookingList';
import { BrandMark } from '../components/BrandMark';
import { Screen, ScreenHeader } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { accountStyles as styles } from '../theme';

export default function ReservationsScreen() {
    const { user } = useAuth();

    return (
        <Screen>
            <ScreenHeader>
                <BrandMark />
                <Text style={styles.label}>RESERVATIONS</Text>
            </ScreenHeader>
            {user ? <BookingList userId={user.id} /> : <Text style={styles.body}>Log in to view your reservations.</Text>}
        </Screen>
    );
}
