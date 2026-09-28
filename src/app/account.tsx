import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BrandMark } from '../components/BrandMark';
import { PasswordVisibilityIcon } from '../components/PasswordVisibilityIcon';
import { ProfileScreen } from '../components/ProfileScreen';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { accountStyles as styles, colors } from '../theme';

export default function AccountScreen() {
  const { user, isLoading, login } = useAuth();
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
        <ProfileScreen user={user} />
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
          placeholder="Username or email"
          placeholderTextColor={colors.subtle}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          value={username}
          onChangeText={setUsername}
        />
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Password"
            placeholderTextColor={colors.subtle}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            textContentType="password"
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
        <PrimaryButton label={submitting ? 'Logging in…' : 'Log in'} onPress={handleLogin} />
      </SectionCard>
    </Screen>
  );
}
