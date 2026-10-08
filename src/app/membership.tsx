import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { getCurrentMembership, getMembershipPackages, MembershipPackage, MembershipRecord, startGuestMembershipCheckout, startMembershipCheckout } from '../api/membership';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { Screen, ScreenHeader } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { router } from 'expo-router';
import { colors, homeStyles, membershipStyles as styles } from '../theme';

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
    const [selectedPackage, setSelectedPackage] = useState<MembershipPackage | null>(null);
    const [checkoutError, setCheckoutError] = useState('');

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
        if (!user) {
            setCheckoutError('');
            setSelectedPackage(packageInfo);
            return;
        }
        await continueCheckout(packageInfo);
    }

    function closeCheckout() {
        if (loadingPackage) return;
        setSelectedPackage(null);
        setAccountPassword('');
        setCheckoutError('');
    }

    async function continueCheckout(packageInfo: MembershipPackage) {
        if (!user && (!accountEmail.trim() || accountPassword.length < 8)) {
            setCheckoutError('Enter your email and a password with at least 8 characters.');
            return;
        }

        setCheckoutError('');
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
            setSelectedPackage(null);
            setAccountPassword('');
            router.push({ pathname: '/checkout', params: { url: result.bridge_url } });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to start checkout. Please try again.';
            if (user) Alert.alert('Unable to start checkout', message);
            else setCheckoutError(message);
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
            {loading ? <ActivityIndicator color={colors.primary} size="large" /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!loading && packages.map((packageInfo) => {
                const hasDiscount = packageInfo.discount_price !== null && packageInfo.discount_price < packageInfo.price;
                const price = hasDiscount ? packageInfo.discount_price : packageInfo.price;
                return <View key={packageInfo.slug} style={[styles.card, packageInfo.featured && styles.featuredCard]}>
                    {packageInfo.thumbnail_url ? <MembershipThumbnail key={packageInfo.thumbnail_url} uri={packageInfo.thumbnail_url} title={packageInfo.title} /> : null}
                    {packageInfo.featured ? <Text style={styles.featuredLabel}>MOST POPULAR</Text> : null}
                    <Text style={styles.kicker}>{packageInfo.title}</Text>
                    <View style={styles.priceRow}><Text style={styles.price}>${price}</Text><Text style={styles.month}> {packageInfo.billing}</Text></View>
                    {hasDiscount ? <Text style={styles.regularPrice}>Regularly ${packageInfo.price}{packageInfo.billing}</Text> : null}
                    <View style={styles.features}>{packageInfo.features.map((feature) => <Text key={feature} style={styles.feature}>✓ {feature}</Text>)}</View>
                    <PrimaryButton label={loadingPackage === packageInfo.slug ? 'LOADING...' : 'CHOOSE MEMBERSHIP'} onPress={() => handleChoose(packageInfo)} disabled={Boolean(loadingPackage)} />
                </View>;
            })}
            <Modal visible={selectedPackage !== null} transparent animationType="slide" onRequestClose={closeCheckout}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={homeStyles.modalBackdrop}>
                    <ScrollView contentContainerStyle={homeStyles.modalScrollContent} keyboardShouldPersistTaps="handled">
                        <View style={homeStyles.modalCard}>
                            <Text style={styles.accountHeading}>Continue with {selectedPackage?.title}</Text>
                            <Text style={styles.accountCopy}>Create an account to manage your membership. Billing and payment details are collected securely at checkout.</Text>
                            {checkoutError ? <Text accessibilityRole="alert" style={styles.error}>{checkoutError}</Text> : null}
                            <TextInput accessibilityLabel="Full name" editable={!loadingPackage} style={styles.input} placeholder="Full name" placeholderTextColor={colors.subtle} value={displayName} onChangeText={setDisplayName} />
                            <TextInput accessibilityLabel="Email address" editable={!loadingPackage} style={styles.input} placeholder="Email address" placeholderTextColor={colors.subtle} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={accountEmail} onChangeText={setAccountEmail} />
                            <TextInput accessibilityLabel="Password" editable={!loadingPackage} style={styles.input} placeholder="Password (8+ characters)" placeholderTextColor={colors.subtle} secureTextEntry value={accountPassword} onChangeText={setAccountPassword} />
                            <PasswordRequirements password={accountPassword} />
                            <PrimaryButton label={loadingPackage ? 'LOADING...' : 'CONTINUE TO CHECKOUT'} disabled={Boolean(loadingPackage)} onPress={() => { if (selectedPackage) void continueCheckout(selectedPackage); }} />
                            <PrimaryButton label="BACK TO PACKAGES" secondary disabled={Boolean(loadingPackage)} onPress={closeCheckout} />
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
        </Screen>
    );
}

function MembershipThumbnail({ uri, title }: { uri: string; title: string }) {
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    return failed ? (
        <View>
            <Text style={styles.error}>Package image could not be loaded.</Text>
            <PrimaryButton label="RETRY IMAGE" secondary onPress={() => { setFailed(false); setAttempt((value) => value + 1); }} />
        </View>
    ) : <Image key={attempt} source={{ uri }} accessibilityLabel={`${title} membership`} contentFit="contain" cachePolicy="disk" style={styles.thumbnail} onError={() => setFailed(true)} />;
}
