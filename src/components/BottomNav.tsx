import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { bottomNavStyles as styles } from '../theme';
import { NavigationIcon } from './NavigationIcon';
import { useAuth } from '../context/AuthContext';

const items = [
  { label: 'Home', path: '/', icon: 'home' as const },
  { label: 'Book', path: '/book', icon: 'book' as const },
  { label: 'Reservations', path: '/reservations', icon: 'reservations' as const },
  { label: 'Membership', path: '/membership', icon: 'membership' as const },
  { label: 'Profile', path: '/account', icon: 'profile' as const },
];

export function BottomNav({ onNavigate }: { onNavigate?: () => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const visibleItems = items.filter((item) => item.path !== '/reservations' || Boolean(user));

  return (
    <View style={styles.nav}>
      {visibleItems.map((item) => {
        const active = pathname === item.path;
        return (
          <Pressable key={item.path} onPress={() => { onNavigate?.(); router.push(item.path); }} style={styles.item}>
            <NavigationIcon name={item.icon} active={active} />
            <Text style={[styles.label, active && styles.active]}>{item.label}</Text>
            {active && <View style={styles.dot} />}
          </Pressable>
        );
      })}
    </View>
  );
}
