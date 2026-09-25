import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { colors, spacing } from '../theme';

const items = [
  { label: 'Home', path: '/' },
  { label: 'Book', path: '/book' },
  { label: 'Membership', path: '/membership' },
  { label: 'Account', path: '/account' },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.nav}>
      {items.map((item) => {
        const active = pathname === item.path;
        return (
          <Pressable key={item.path} onPress={() => router.push(item.path)} style={styles.item}>
            <Text style={[styles.label, active && styles.active]}>{item.label}</Text>
            {active && <View style={styles.dot} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    backgroundColor: colors.surfaceStrong,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  item: { alignItems: 'center', gap: 4, minWidth: 72, paddingVertical: 4 },
  label: { color: colors.subtle, fontSize: 11, fontWeight: '700' },
  active: { color: colors.primary },
  dot: { backgroundColor: colors.primary, borderRadius: 3, height: 4, width: 4 },
});