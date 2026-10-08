import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { PASSWORD_POLICY_MESSAGE, passwordMeetsPolicy } from '../api/auth';
import { BrandMark } from '../components/BrandMark';
import { PasswordVisibilityIcon } from '../components/PasswordVisibilityIcon';
import { ProfileScreen } from '../components/ProfileScreen';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { SignupForm } from '../components/SignupForm';
import { useAuth } from '../context/AuthContext';
import { accountStyles as styles, colors, spacing } from '../theme';

export default function AccountScreen() {
  const { user, isLoading, login, loginWithApple } = useAuth();
  const { register } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [promoOptIn, setPromoOptIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let cancelled = false;
    AppleAuthentication.isAvailableAsync().then((available) => {
      if (!cancelled) setAppleAvailable(available);
    }).catch(() => {
      if (!cancelled) setAppleAvailable(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogin() {
    if (!mountedRef.current) return;
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      if (mountedRef.current) {
        setUsername('');
        setPassword('');
        if (returnTo === '/book') router.replace('/book');
      }
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Unable to log in.');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  async function handleAppleLogin() {
    if (!mountedRef.current || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const nonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token. Please try again.');
      }

      const name = credential.fullName
        ? AppleAuthentication.formatFullName(credential.fullName).trim()
        : undefined;
      await loginWithApple(credential.identityToken, nonce, name || undefined);
      if (mountedRef.current && returnTo === '/book') router.replace('/book');
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ERR_REQUEST_CANCELED') return;
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Unable to sign in with Apple.');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  async function handleRegister() {
    if (!mountedRef.current) return;
    if (!passwordMeetsPolicy(password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await register({ name, email: username, password, phone, smsOptIn, promoOptIn });
      if (mountedRef.current) {
        setName('');
        setUsername('');
        setPhone('');
        setPassword('');
        if (returnTo === '/book') router.replace('/book');
      }
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Unable to create your account.');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader>
          <BrandMark />
          <Text style={styles.label}>ACCOUNT</Text>
        </ScreenHeader>
      </Screen>
    );
  }

  if (user) {
    return (
      <Screen>
        <ProfileScreen user={user} />
      </Screen>
    );
  }

  if (isRegistering) {
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

  return (
    <Screen>
      <ScreenHeader>
        <BrandMark />
        <Text style={styles.label}>ACCOUNT</Text>
      </ScreenHeader>
      <Text style={styles.title}>Your golf, organized.</Text>
      <Link href="/notifications" asChild><PrimaryButton label="NOTIFICATION SETTINGS" secondary /></Link>
      <SectionCard>
        <Text style={styles.cardTitle}>{isRegistering ? 'Create your account' : 'Log in'}</Text>
        <Text style={styles.body}>{isRegistering ? 'Create an account to manage bookings and memberships.' : 'Log in to manage bookings, view membership perks, and keep your history in one place.'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {isRegistering ? <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor={colors.subtle}
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
        /> : null}
        <TextInput
          style={styles.input}
          placeholder={isRegistering ? 'Email address' : 'Username or email'}
          placeholderTextColor={colors.subtle}
          editable
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        {isRegistering ? <TextInput
          style={styles.input}
          placeholder="Phone number (optional)"
          placeholderTextColor={colors.subtle}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        /> : null}
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder={isRegistering ? 'Password (8+ chars, upper/lowercase, number, symbol)' : 'Password'}
            placeholderTextColor={colors.subtle}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.eyeButton}
          >
            <PasswordVisibilityIcon visible={showPassword} />
          </Pressable>
        </View>
        {isRegistering ? <PasswordRequirements password={password} /> : null}
        {isRegistering ? <>
          <Pressable style={styles.consentRow} onPress={() => setSmsOptIn((value) => !value)}>
            <View style={[styles.checkbox, smsOptIn && styles.checkboxSelected]}>{smsOptIn ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
            <Text style={styles.consentText}>I agree to receive text messages about my account and bookings.</Text>
          </Pressable>
          <Pressable style={styles.consentRow} onPress={() => setPromoOptIn((value) => !value)}>
            <View style={[styles.checkbox, promoOptIn && styles.checkboxSelected]}>{promoOptIn ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
            <Text style={styles.consentText}>Send me occasional Tee Time Nexus offers and updates.</Text>
          </Pressable>
        </> : null}
        <PrimaryButton label={submitting ? 'Please wait…' : isRegistering ? 'Create account' : 'Log in'} onPress={isRegistering ? handleRegister : handleLogin} />
        {!isRegistering && appleAvailable ? (
          <View style={localStyles.appleSignIn}>
            <Text style={localStyles.divider}>OR</Text>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={10}
              style={localStyles.appleButton}
              onPress={handleAppleLogin}
            />
          </View>
        ) : null}
        <View style={{ marginTop: spacing.sm }}>
          <PrimaryButton label={isRegistering ? 'I already have an account' : 'Create an account'} onPress={() => { setError(''); setIsRegistering((value) => !value); }} secondary />
        </View>
      </SectionCard>
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  appleSignIn: { gap: spacing.sm, marginTop: spacing.sm },
  divider: { color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  appleButton: { height: 50, width: '100%' },
});
