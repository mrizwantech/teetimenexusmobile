import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { CHECKOUT_SIGNATURE_END, CHECKOUT_SIGNATURE_START, checkoutSignatureScript } from '../api/checkout-signature';
import { checkoutStyles as styles, colors } from '../theme';

export default function CheckoutScreen() {
    const { url, bay, date, time, duration, players, managementBookingId } = useLocalSearchParams<{ url: string; bay?: string; date?: string; time?: string; duration?: string; players?: string; managementBookingId?: string }>();
    const [error, setError] = useState('');
    const [signing, setSigning] = useState(false);

    function handleNavigation(url: string) {
        if (managementBookingId && /[?&]booking_change_failed=1(?:&|$)/.test(url)) {
            setError('Your reservation could not be changed. Your original booking is unchanged. Check the website confirmation or contact Tee Time Nexus for the payment/refund status.');
            return;
        }
        if (managementBookingId && /[?&]booking_updated=1(?:&|$)/.test(url)) {
            router.replace({ pathname: '/manage-reservation', params: { bookingId: managementBookingId } });
            return;
        }
        if (/[?&](success|payment_status)=(success|paid|complete)/i.test(url)) {
            router.replace({ pathname: '/confirmation', params: { bay, date, time, duration, players } });
        }
    }

    if (error) {
        return <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Back</Text></Pressable>
        </View>;
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
                injectedJavaScript={checkoutSignatureScript}
                scrollEnabled={!signing}
                onMessage={(event) => {
                    if (event.nativeEvent.data === CHECKOUT_SIGNATURE_START) setSigning(true);
                    if (event.nativeEvent.data === CHECKOUT_SIGNATURE_END) setSigning(false);
                }}
                onLoadStart={() => setSigning(false)}
                startInLoadingState
                renderLoading={() => <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>}
                onError={() => setError('Checkout could not be loaded. Please try again.')}
                onNavigationStateChange={(state) => handleNavigation(state.url)}
            />
        </View>
    );
}
