import { useEffect, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bottomNavStyles as styles } from '../theme';
import { NavigationIcon } from './NavigationIcon';
import { primaryNavigation } from '../navigation/menu';
import { MenuSheet } from './MenuSheet';

export function BottomNav({ onNavigate }: { onNavigate?: () => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuRoute, setMenuRoute] = useState<string | null>(null);
  const menuOpen = menuRoute === pathname;
  const [navHeight, setNavHeight] = useState(0);

  if (menuRoute !== null && menuRoute !== pathname) {
    setMenuRoute(null);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setMenuRoute(null);
      return true;
    });
    return () => subscription.remove();
  }, [menuOpen]);

  function navigate(path: typeof primaryNavigation[number]['path']) {
    if (path === '/menu') {
      setMenuRoute((route) => route === pathname ? null : pathname);
      return;
    }
    setMenuRoute(null);
    onNavigate?.();
    router.navigate(path);
  }

  return (
    <>
    <MenuSheet visible={menuOpen && navHeight > 0} bottomOffset={navHeight} onClose={() => setMenuRoute(null)} onNavigate={onNavigate} />
    <SafeAreaView edges={['bottom']} style={styles.nav} onLayout={(event) => setNavHeight(event.nativeEvent.layout.height)}>
      {primaryNavigation.map((item) => {
        const active = item.path === '/menu' ? menuOpen : pathname === item.path;
        return (
          <Pressable key={item.path} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: active, ...(item.path === '/menu' ? { expanded: active } : {}) }} onPress={() => navigate(item.path)} style={styles.item}>
            <NavigationIcon name={item.icon} active={active} />
            <Text style={[styles.label, active && styles.active]}>{item.label}</Text>
            <View style={[styles.dot, { opacity: active ? 1 : 0 }]} />
          </Pressable>
        );
      })}
    </SafeAreaView>
    </>
  );
}
