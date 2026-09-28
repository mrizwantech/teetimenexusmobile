import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { checkoutStyles as styles, colors } from '../theme';

export default function CheckoutScreen() {
    const { url, bay, date, time, duration, players } = useLocalSearchParams<{ url: string; bay?: string; date?: string; time?: string; duration?: string; players?: string }>();
    const [error, setError] = useState('');

    function handleNavigation(url: string) {
        if (/[?&](success|payment_status)=(success|paid|complete)/i.test(url)) {
            router.replace({ pathname: '/confirmation', params: { bay, date, time, duration, players } });
        }
    }

    if (error) {
        return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
    }

    if (!url) return <View style={styles.center}><Text style={styles.error}>Checkout URL is missing.</Text></View>;

    return (
        <View style={styles.checkoutScreen}>
            <View style={styles.checkoutHeader}>
                <Pressable accessibilityRole="button" accessibilityLabel="Close checkout" onPress={() => router.back()}>
                    <Text style={styles.back}>‹</Text>
                </Pressable>
                <Text style={styles.checkoutTitle}>Secure Checkout</Text>
                <View style={styles.headerSpacer} />
            </View>
            <WebView
                source={{ uri: url }}
                startInLoadingState
                renderLoading={() => <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>}
                onError={() => setError('Checkout could not be loaded. Please try again.')}
                onNavigationStateChange={(state) => handleNavigation(state.url)}
            />
        </View>
    );
}

