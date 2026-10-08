import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bottomNavStyles as styles } from '../theme';
import { NavigationIcon } from './NavigationIcon';
import { primaryNavigation } from '../navigation/menu';

export function BottomNav({ onNavigate }: { onNavigate?: () => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <SafeAreaView edges={['bottom']} style={styles.nav}>
      {primaryNavigation.map((item) => {
        const active = pathname === item.path;
        return (
          <Pressable key={item.path} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: active }} onPress={() => { onNavigate?.(); router.navigate(item.path); }} style={styles.item}>
            <NavigationIcon name={item.icon} active={active} />
            <Text style={[styles.label, active && styles.active]}>{item.label}</Text>
            {active && <View style={styles.dot} />}
          </Pressable>
        );
      })}
    </SafeAreaView>
  );
}
