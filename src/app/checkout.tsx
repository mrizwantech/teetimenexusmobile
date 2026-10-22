import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useIsFocused, usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { CHECKOUT_SIGNATURE_END, CHECKOUT_SIGNATURE_START, checkoutSignatureScript } from '../api/checkout-signature';
import { checkoutStyles as styles, colors } from '../theme';
import { useBookingLeaveGuard } from '../context/BookingLeaveContext';

export default function CheckoutScreen() {
    const { url, bay, date, time, duration, players, managementBookingId } = useLocalSearchParams<{ url: string; bay?: string; date?: string; time?: string; duration?: string; players?: string; managementBookingId?: string }>();
    const [error, setError] = useState('');
    const [signing, setSigning] = useState(false);
    const [checkoutComplete, setCheckoutComplete] = useState(false);
    const navigation = useNavigation();
    const leaveGuard = useBookingLeaveGuard();
    const { register } = leaveGuard;
    const isFocused = useIsFocused();
    const bookingCheckout = Boolean((bay && date) || managementBookingId);
    const completed = useRef(false);
    const unregisterGuard = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!bookingCheckout || completed.current) return;
        const unregister = register('/checkout', () => {});
        unregisterGuard.current = unregister;
        return () => {
            unregister();
            if (unregisterGuard.current === unregister) unregisterGuard.current = null;
        };
    }, [bookingCheckout, register]);

    useFocusEffect(useCallback(() => {
        if (!bookingCheckout || completed.current) return;
        const back = BackHandler.addEventListener('hardwareBackPress', () => {
            if (navigation.canGoBack()) return false;
            leaveGuard.request(null, () => BackHandler.exitApp());
            return true;
        });
        return () => back.remove();
    }, [bookingCheckout, leaveGuard, navigation]));

    usePreventRemove(isFocused && bookingCheckout && !checkoutComplete, ({ data }) => {
        leaveGuard.request(null, () => navigation.dispatch(data.action));
    });

    function finishCheckout(proceed: () => void) {
        if (completed.current) return;
        completed.current = true;
        setCheckoutComplete(true);
        unregisterGuard.current?.();
        unregisterGuard.current = null;
        proceed();
    }

    function closeCheckout() {
        leaveGuard.request(null, () => router.back());
    }

    function handleNavigation(url: string) {
        if (managementBookingId && /[?&]booking_change_failed=1(?:&|$)/.test(url)) {
            setError('Your reservation could not be changed. Your original booking is unchanged. Check the website confirmation or contact Tee Time Nexus for the payment/refund status.');
            return;
        }
        if (managementBookingId && /[?&]booking_updated=1(?:&|$)/.test(url)) {
            finishCheckout(() => router.replace({ pathname: '/manage-reservation', params: { bookingId: managementBookingId } }));
            return;
        }
        if (/[?&]booking_failed=1(?:&|$)/i.test(url)) {
            const match = url.match(/[?&]alt_msg=([^&#]+)/i);
            const altMsg = match ? decodeURIComponent(match[1]) : '';
            const baseMsg = 'Someone was just a bit quicker than you to book this tee time. If your payment was processed, a full refund has been automatically issued.';
            setError(altMsg ? `${baseMsg}\n\n${altMsg}` : `${baseMsg} Please choose another date or time.`);
            return;
        }
        if (/[?&]booking_error=/i.test(url)) {
            setError('This tee time is no longer available. If your payment was processed, a full refund has been issued. Please return and choose another date or time.');
            return;
        }
        if (/[?&](success|payment_status)=(success|paid|complete)/i.test(url) || /[?&]booking=confirmed/i.test(url) || /\/order-received\//i.test(url)) {
            finishCheckout(() => router.replace({ pathname: '/confirmation', params: { bay, date, time, duration, players } }));
        }
    }

    if (error) {
        return <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={closeCheckout}><Text style={styles.back}>Back</Text></Pressable>
        </View>;
    }

    if (!url) return <View style={styles.center}><Text style={styles.error}>Checkout URL is missing.</Text></View>;

    return (
        <View style={styles.checkoutScreen}>
            <View style={styles.checkoutHeader}>
                <Pressable accessibilityRole="button" accessibilityLabel="Close checkout" onPress={closeCheckout}>
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
