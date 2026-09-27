import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { checkoutStyles as styles, colors } from '../theme';

export default function CheckoutScreen() {
    const { url } = useLocalSearchParams<{ url: string }>();
    const openedRef = useRef(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!url || openedRef.current) return;
        openedRef.current = true;

        WebBrowser.openBrowserAsync(url)
            .catch(() => setError('Checkout could not be opened. Please try again.'))
            .finally(() => router.back());
    }, [url]);

    if (error) {
        return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
    }

    return (
        <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.text}>Opening secure checkout…</Text>
        </View>
    );
}

