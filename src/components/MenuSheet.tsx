import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '../components/BrandMark';
import { NavigationIcon } from '../components/NavigationIcon';
import { getMenuItems } from '../navigation/menu';
import { colors, radii, spacing } from '../theme';

type MenuItem = ReturnType<typeof getMenuItems>[number];
const cardIcons = ['profile', 'tournament', 'membership', 'home'] as const;

export function MenuSheet({ visible, bottomOffset, onClose, onNavigate }: {
  visible: boolean;
  bottomOffset: number;
  onClose: () => void;
  onNavigate?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [gridWidth, setGridWidth] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  const items = getMenuItems();

  useEffect(() => {
    if (!sheetHeight) return;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 280 : 220,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, sheetHeight, progress]);

  function openItem(item: MenuItem) {
    onClose();
    onNavigate?.();
    router.navigate(item.path);
  }

  return (
    <View pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} style={[styles.overlay, { bottom: bottomOffset, paddingTop: insets.top + spacing.md }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)} style={[styles.sheet, {
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] }) }],
      }]} accessibilityViewIsModal={visible}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <BrandMark />
          <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>X</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.title}>Explore Tee Time Nexus</Text>
          <View style={styles.grid} onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
            {items.map((item, index) => (
              <Pressable key={item.path} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => openItem(item)} style={({ pressed }) => [styles.card, { width: gridWidth ? Math.max(1, (gridWidth - spacing.md) / 2) : '45%' }, pressed && styles.pressed]}>
                <NavigationIcon name={cardIcons[index]} active />
                <Text style={styles.cardTitle}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, overflow: 'hidden', justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  sheet: { backgroundColor: colors.bg, borderColor: colors.borderStrong, borderWidth: 1, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, maxHeight: '100%', overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.muted, fontSize: 16, fontWeight: '700' },
  content: { padding: spacing.lg, gap: spacing.lg },
  scroll: { flexShrink: 1 },
  title: { color: colors.heading, fontSize: 22, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { minHeight: 100, backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  cardTitle: { color: colors.heading, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  pressed: { backgroundColor: colors.surfaceSoft },
});
