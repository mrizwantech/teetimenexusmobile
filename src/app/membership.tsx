import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { getCurrentMembership, getMembershipPackages, manageMembership, MembershipPackage, MembershipRecord, startGuestMembershipCheckout, startMembershipCheckout } from '../api/membership';
import { getContactEmailStatus } from '../api/contact-email';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { Screen, ScreenHeader } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { router, useFocusEffect } from 'expo-router';
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
    const [managing, setManaging] = useState(false);
    const [notice, setNotice] = useState('');
    const [retry, setRetry] = useState(0);
    const mutationInFlight = useRef(false);
    const currentIsPaid = membership?.status === 'active' && membership.payment_status === 'paid';

    useFocusEffect(useCallback(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        (async () => {
            try {
                const [availablePackages, current] = await Promise.all([
                    getMembershipPackages(retry > 0),
                    user ? getCurrentMembership() : Promise.resolve(null),
                ]);
                if (!cancelled) {
                    setPackages(availablePackages);
                    setMembership(current);
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load membership options. Please try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [user, retry]));

    async function performManagement(action: 'change' | 'cancel' | 'undo', packageInfo?: MembershipPackage) {
        if (!membership || mutationInFlight.current) return;
        mutationInFlight.current = true;
        setManaging(true);
        setNotice('');
        try {
            const result = await manageMembership(action, membership, packageInfo?.slug);
            if ('bridge_url' in result) {
                router.push({ pathname: '/checkout', params: { url: result.bridge_url } });
            } else {
                setMembership(result.membership);
                setNotice(result.message);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to update membership. Please refresh before trying again.');
        } finally {
            mutationInFlight.current = false;
            setManaging(false);
        }
    }

    function confirmManagement(action: 'change' | 'cancel' | 'undo', packageInfo?: MembershipPackage) {
        const end = membership?.period_end ? new Date(membership.period_end * 1000).toLocaleDateString() : 'the end of your paid period';
        const title = action === 'cancel' ? 'Cancel membership?' : action === 'undo' ? 'Remove scheduled change?' : `Change to ${packageInfo?.title}?`;
        const message = action === 'cancel'
            ? `Your current benefits remain until ${end}. Membership access ends then. No refund is issued.`
            : action === 'undo'
                ? 'Keep your current membership and remove the pending cancellation or downgrade.'
                : `Upgrades continue to prorated checkout. Downgrades take effect on ${end}; pay for the new tier then to activate it. No automatic refund is issued.`;
        Alert.alert(title, message, [
            { text: 'Not now', style: 'cancel' },
            { text: action === 'cancel' ? 'Schedule cancellation' : 'Continue', style: action === 'cancel' ? 'destructive' : 'default', onPress: () => { void performManagement(action, packageInfo); } },
        ]);
    }

    async function handleChoose(packageInfo: MembershipPackage) {
        if (currentIsPaid) {
            confirmManagement('change', packageInfo);
            return;
        }
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
            if (user && (await getContactEmailStatus()).required) {
                Alert.alert('Verify your contact email',
                    'Add and verify a non-relay contact email in Profile before continuing. You can keep signing in with Apple.',
                    [{ text: 'Not now', style: 'cancel' }, { text: 'OPEN PROFILE', onPress: () => router.push('/account') }]);
                return;
            }
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
            {membership ? <View style={styles.currentPanel}>
                <Text style={styles.currentLabel}>YOUR MEMBERSHIP</Text>
                <Text style={styles.currentTitle}>{membership.package_name}</Text>
                <Text style={styles.currentStatus}>{membership.status} · {membership.payment_status}</Text>
                {membership.management_notice ? <Text accessibilityRole="alert" style={styles.error}>{membership.management_notice}</Text> : null}
                {membership.period_end ? <Text style={styles.intro}>Paid period ends {new Date(membership.period_end * 1000).toLocaleDateString()}</Text> : null}
                {membership.scheduled_change ? <>
                    <Text style={styles.intro}>{membership.scheduled_change.action === 'cancel' ? 'Cancellation' : `Change to ${membership.scheduled_change.package_name}`} scheduled for {new Date(membership.scheduled_change.effective_at * 1000).toLocaleDateString()}. Current benefits continue until then.</Text>
                    {membership.scheduled_change.action === 'downgrade' ? <Text style={styles.intro}>Payment for the new period is required to activate the new tier.</Text> : null}
                    <PrimaryButton secondary label={managing ? 'UPDATING...' : 'REMOVE SCHEDULED CHANGE'} disabled={managing || loading || Boolean(error)} onPress={() => confirmManagement('undo')} />
                </> : currentIsPaid && membership.can_manage ? <>
                    <Text style={styles.intro}>Change your plan using the cards below, or cancel at the end of your paid period.</Text>
                    <PrimaryButton secondary label={managing ? 'UPDATING...' : 'CANCEL MEMBERSHIP'} disabled={managing || loading || Boolean(error)} onPress={() => confirmManagement('cancel')} />
                </> : currentIsPaid ? <Text style={styles.error}>Membership management is not available on the website yet. Contact support.</Text> : null}
            </View> : null}
            {notice ? <Text accessibilityLiveRegion="polite" style={styles.intro}>{notice}</Text> : null}
            {loading ? <ActivityIndicator color={colors.primary} size="large" /> : null}
            {error ? <View><Text accessibilityRole="alert" style={styles.error}>{error}</Text><PrimaryButton secondary label="REFRESH MEMBERSHIP" disabled={loading || managing} onPress={() => setRetry((value) => value + 1)} /></View> : null}
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
                    <PrimaryButton label={loadingPackage === packageInfo.slug || managing ? 'LOADING...' : currentIsPaid ? (membership.package_key?.toLowerCase() === packageInfo.slug ? 'CURRENT PLAN' : 'CHANGE PLAN') : 'CHOOSE MEMBERSHIP'} onPress={() => handleChoose(packageInfo)} disabled={Boolean(loadingPackage) || managing || Boolean(error) || Boolean(currentIsPaid && (!membership.can_manage || membership.scheduled_change || membership.package_key?.toLowerCase() === packageInfo.slug))} />
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
