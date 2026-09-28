import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { BrandMark } from '../components/BrandMark';
import { Screen, ScreenHeader } from '../components/Screen';
import { SignupForm } from '../components/SignupForm';
import { accountStyles as styles } from '../theme';

export default function SignupScreen() {
    const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

    return (
        <Screen>
            <ScreenHeader>
                <BrandMark />
                <Text style={styles.label}>SIGN UP</Text>
            </ScreenHeader>
            <SignupForm returnTo={returnTo} />
        </Screen>
    );
}
