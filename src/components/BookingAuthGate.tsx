import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { BrandMark } from './BrandMark';
import { PrimaryButton } from './PrimaryButton';
import { colors, spacing } from '../theme';

export function BookingAuthGate() {
    return (
        <View style={styles.container}>
            <BrandMark />
            <Text style={styles.title}>Sign in to book</Text>
            <Text style={styles.body}>Create an account or sign in before choosing your bay. This keeps your reservation and payment secure.</Text>
            <PrimaryButton label="LOG IN" onPress={() => router.push({ pathname: '/account', params: { returnTo: '/book' } })} />
            <PrimaryButton label="SIGN UP" secondary onPress={() => router.push({ pathname: '/signup', params: { returnTo: '/book' } })} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
    title: { color: colors.heading, fontSize: 28, fontWeight: '900', marginTop: spacing.md, textAlign: 'center' },
    body: { color: colors.muted, fontSize: 15, lineHeight: 22, maxWidth: 320, textAlign: 'center' },
});
