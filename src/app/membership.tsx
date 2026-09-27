import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, View } from 'react-native';

import { getCurrentMembership, getMembershipPackages, MembershipPackage, MembershipRecord, startGuestMembershipCheckout, startMembershipCheckout } from '../api/membership';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { router } from 'expo-router';
import { colors, membershipStyles as styles } from '../theme';

export default function MembershipScreen() {
    const { user } = useAuth();
    const [packages, setPackages] = useState<MembershipPackage[]>([]);
    const [membership, setMembership] = useState<MembershipRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingPackage, setLoadingPackage] = useState('');
    const [error, setError] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [accountEmail, setAccountEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const availablePackages = await getMembershipPackages();
                const current = user ? await getCurrentMembership().catch(() => null) : null;
                if (!cancelled) {
                    setPackages(availablePackages);
                    setMembership(current);
                }
            } catch {
                if (!cancelled) setError('Unable to load membership options. Please try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [user]);

    async function handleChoose(packageInfo: MembershipPackage) {
        if (!user && (!accountEmail.trim() || accountPassword.length < 8)) {
            Alert.alert('Account details required', 'Enter your email and a password with at least 8 characters.');
            return;
        }

        setLoadingPackage(packageInfo.slug);
        try {
            const result = user
                ? await startMembershipCheckout(packageInfo.slug)
                : await startGuestMembershipCheckout({
                    packageSlug: packageInfo.slug,
                    email: accountEmail,
                    password: accountPassword,
                    displayName,
                });
            router.push({ pathname: '/checkout', params: { url: result.bridge_url } });
        } catch (err) {
            Alert.alert('Unable to start checkout', err instanceof Error ? err.message : 'Please try again.');
        } finally {
            setLoadingPackage('');
        }
    }

    return (
        <Screen>
            <ScreenHeader><BrandMark /><Text style={styles.label}>MEMBERSHIP</Text></ScreenHeader>
            <Text style={styles.title}>Choose your level</Text>
            <Text style={styles.intro}>Founding membership rates, flexible access, and benefits built for your game.</Text>
            {membership ? <View style={styles.currentPanel}><Text style={styles.currentLabel}>YOUR MEMBERSHIP</Text><Text style={styles.currentTitle}>{membership.package_name}</Text><Text style={styles.currentStatus}>{membership.status} · {membership.payment_status}</Text></View> : null}
            {!user ? <View style={styles.accountPanel}>
                <Text style={styles.accountHeading}>Create your account</Text>
                <Text style={styles.accountCopy}>Your account will be created securely when you continue to checkout.</Text>
                <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={colors.subtle} value={displayName} onChangeText={setDisplayName} />
                <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={colors.subtle} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={accountEmail} onChangeText={setAccountEmail} />
                <TextInput style={styles.input} placeholder="Password (8+ characters)" placeholderTextColor={colors.subtle} secureTextEntry value={accountPassword} onChangeText={setAccountPassword} />
            </View> : null}
            {loading ? <ActivityIndicator color={colors.primary} size="large" /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!loading && packages.map((packageInfo) => {
                const hasDiscount = packageInfo.discount_price !== null && packageInfo.discount_price < packageInfo.price;
                const price = hasDiscount ? packageInfo.discount_price : packageInfo.price;
                return <View key={packageInfo.slug} style={[styles.card, packageInfo.featured && styles.featuredCard]}>
                    {packageInfo.featured ? <Text style={styles.featuredLabel}>MOST POPULAR</Text> : null}
                    <Text style={styles.kicker}>{packageInfo.title}</Text>
                    <View style={styles.priceRow}><Text style={styles.price}>${price}</Text><Text style={styles.month}> {packageInfo.billing}</Text></View>
                    {hasDiscount ? <Text style={styles.regularPrice}>Regularly ${packageInfo.price}{packageInfo.billing}</Text> : null}
                    <View style={styles.features}>{packageInfo.features.map((feature) => <Text key={feature} style={styles.feature}>✓ {feature}</Text>)}</View>
                    <PrimaryButton label={loadingPackage === packageInfo.slug ? 'LOADING...' : 'CHOOSE MEMBERSHIP'} onPress={() => handleChoose(packageInfo)} disabled={Boolean(loadingPackage)} />
                </View>;
            })}
        </Screen>
    );
}
