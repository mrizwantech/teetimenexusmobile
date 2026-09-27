import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { BookingRecord, getMyBookings, getMyMembership } from '../api/account';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { accountStyles as styles, colors } from '../theme';

export default function AccountScreen() {
  const { user, isLoading, login, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [membership, setMembership] = useState<{ package_name: string; status: string; payment_status: string } | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([getMyBookings(), getMyMembership()])
      .then(([nextBookings, nextMembership]) => {
        if (!cancelled) {
          setBookings(nextBookings);
          setMembership(nextMembership);
        }
      })
      .finally(() => {
        if (!cancelled) setAccountLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

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
          {accountLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {membership ? <Text style={styles.accountLine}>Membership: {membership.package_name} · {membership.status}</Text> : null}
          <Text style={styles.sectionTitle}>Your bookings</Text>
          {!accountLoading && bookings.length === 0 ? <Text style={styles.body}>No bookings yet.</Text> : null}
          {bookings.map((booking) => (
            <View key={booking.ID} style={styles.bookingRow}>
              <Text style={styles.bookingTitle}>{booking.booking_reference} · {booking.bay}</Text>
              <Text style={styles.bookingText}>{booking.date} · {booking.time} · {booking.duration}h</Text>
              <Text style={styles.bookingText}>{booking.status} · {booking.payment_status}</Text>
            </View>
          ))}
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
