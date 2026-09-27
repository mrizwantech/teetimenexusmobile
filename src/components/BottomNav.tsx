import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { bottomNavStyles as styles } from '../theme';

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
