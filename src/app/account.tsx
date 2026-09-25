import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { colors, radii, spacing } from '../theme';

export default function AccountScreen() {
  const { user, isLoading, login, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      }
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Unable to log in.');
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
        <ScreenHeader>
          <BrandMark />
          <Text style={styles.label}>ACCOUNT</Text>
        </ScreenHeader>
        <Text style={styles.title}>Welcome back.</Text>
        <SectionCard>
          <Text style={styles.cardTitle}>{user.display_name}</Text>
          <Text style={styles.body}>{user.email}</Text>
          <PrimaryButton label="Log out" onPress={logout} secondary />
        </SectionCard>
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
        <Text style={styles.cardTitle}>Log in</Text>
        <Text style={styles.body}>Log in to manage bookings, view membership perks, and keep your history in one place.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput
          style={styles.input}
          placeholder="WordPress username"
          placeholderTextColor={colors.subtle}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Password"
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
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
          </Pressable>
        </View>
        <PrimaryButton label={submitting ? 'Logging in…' : 'Log in'} onPress={handleLogin} />
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.heading, fontSize: 34, fontWeight: '900' },
  cardTitle: { color: colors.heading, fontSize: 20, fontWeight: '800', marginBottom: 10 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23, marginBottom: 20 },
  error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  input: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: 15,
  },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: spacing.xl },
  eyeButton: { position: 'absolute', right: spacing.sm, padding: spacing.xs },
  eyeIcon: { fontSize: 18 },
});