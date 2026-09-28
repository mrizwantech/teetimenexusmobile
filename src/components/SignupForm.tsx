import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { PasswordVisibilityIcon } from './PasswordVisibilityIcon';
import { PrimaryButton } from './PrimaryButton';
import { SectionCard } from './SectionCard';
import { useAuth } from '../context/AuthContext';
import { accountStyles as styles, colors, spacing } from '../theme';

type SignupFormProps = {
    returnTo?: string;
};

export function SignupForm({ returnTo }: SignupFormProps) {
    const { register } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [smsOptIn, setSmsOptIn] = useState(false);
    const [promoOptIn, setPromoOptIn] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSignup() {
        if (!name.trim() || !email.trim() || !password || !confirmPassword) {
            setError('Complete all required fields.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setError('');
        setSubmitting(true);
        try {
            const welcomeEmailSent = await register({ name, email, password, phone, smsOptIn, promoOptIn });
            Alert.alert(
                'Account created',
                welcomeEmailSent
                    ? 'Your account is ready. We sent a welcome email; check your inbox and spam folder.'
                    : 'Your account is ready, but we could not send the welcome email. You can still sign in; please check your email address or contact support.',
                [{ text: 'Continue', onPress: () => router.replace(returnTo === '/book' ? '/book' : '/') }]
            );
        } catch (signupError) {
            setError(signupError instanceof Error ? signupError.message : 'Unable to create your account.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <SectionCard>
            <Text style={styles.cardTitle}>Create your account</Text>
            <Text style={styles.body}>Sign up to book bays, manage reservations, and access your membership.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={colors.subtle} value={name} onChangeText={setName} autoCapitalize="words" />
            <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={colors.subtle} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <TextInput style={styles.input} placeholder="Phone number" placeholderTextColor={colors.subtle} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <View style={localStyles.passwordRow}>
                <TextInput style={[styles.input, localStyles.passwordInput]} placeholder="Password" placeholderTextColor={colors.subtle} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                <Text onPress={() => setShowPassword((value) => !value)} style={localStyles.passwordIcon}><PasswordVisibilityIcon visible={showPassword} /></Text>
            </View>
            <TextInput style={styles.input} placeholder="Confirm password" placeholderTextColor={colors.subtle} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} />
            <Pressable style={styles.consentRow} onPress={() => setSmsOptIn((value) => !value)}>
                <View style={[styles.checkbox, smsOptIn && styles.checkboxSelected]}>{smsOptIn ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
                <Text style={styles.consentText}>I agree to receive text messages about my account and bookings.</Text>
            </Pressable>
            <Pressable style={styles.consentRow} onPress={() => setPromoOptIn((value) => !value)}>
                <View style={[styles.checkbox, promoOptIn && styles.checkboxSelected]}>{promoOptIn ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
                <Text style={styles.consentText}>Send me occasional Tee Time Nexus offers and updates.</Text>
            </Pressable>
            <PrimaryButton label={submitting ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'} onPress={handleSignup} />
            <Text onPress={() => router.replace('/account')} style={localStyles.loginLink}>Already have an account? Log in</Text>
        </SectionCard>
    );
}

const localStyles = StyleSheet.create({
    passwordRow: { position: 'relative' },
    passwordInput: { paddingRight: spacing.xl },
    passwordIcon: { alignItems: 'center', justifyContent: 'center', padding: spacing.xs, position: 'absolute', right: spacing.sm, top: 8 },
    loginLink: { color: colors.primary, fontSize: 13, marginTop: spacing.sm, paddingVertical: spacing.xs, textAlign: 'center', textDecorationLine: 'underline' },
});
