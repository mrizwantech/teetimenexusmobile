import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { BrandMark } from '../components/BrandMark';
import { PasswordVisibilityIcon } from '../components/PasswordVisibilityIcon';
import { ProfileScreen } from '../components/ProfileScreen';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { SignupForm } from '../components/SignupForm';
import { useAuth } from '../context/AuthContext';
import { accountStyles as styles, colors, spacing } from '../theme';

export default function AccountScreen() {
  const { user, isLoading, login } = useAuth();
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
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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

  async function handleRegister() {
    if (!mountedRef.current) return;
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
            placeholder={isRegistering ? 'Password (at least 6 characters)' : 'Password'}
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
        <View style={{ marginTop: spacing.sm }}>
          <PrimaryButton label={isRegistering ? 'I already have an account' : 'Create an account'} onPress={() => { setError(''); setIsRegistering((value) => !value); }} secondary />
        </View>
      </SectionCard>
    </Screen>
  );
}
