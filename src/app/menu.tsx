import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { BrandMark } from '../components/BrandMark';
import { Screen, ScreenHeader } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { bookingPolicyUrl, getMenuItems } from '../navigation/menu';
import { menuStyles as styles } from '../theme';

type MenuItem = ReturnType<typeof getMenuItems>[number];

export default function MenuScreen() {
  const { user } = useAuth();
  const [openingLink, setOpeningLink] = useState<string | null>(null);

  async function openItem(item: MenuItem) {
    if (item.kind === 'app') {
      router.navigate(item.path);
      return;
    }
    setOpeningLink(item.path);
    try {
      await WebBrowser.openBrowserAsync(item.path);
    } catch (error) {
      Alert.alert('Unable to open page', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setOpeningLink(null);
    }
  }

  return (
    <Screen>
      <ScreenHeader><BrandMark /><Text style={styles.label}>MENU</Text></ScreenHeader>
      <Text style={styles.title}>Explore Tee Time Nexus</Text>
      <View style={styles.list}>
        {getMenuItems(Boolean(user)).map((item) => (
          <Pressable key={item.path} accessibilityRole="button" accessibilityLabel={item.kind === 'website' ? `${item.label}, opens website` : item.label} disabled={openingLink !== null} onPress={() => void openItem(item)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <View style={styles.copy}>
              <Text style={styles.itemTitle}>{item.label}</Text>
              {item.kind === 'website' ? <Text style={styles.subtitle}>{openingLink === item.path ? 'Opening...' : item.path === bookingPolicyUrl ? 'On the booking page, tap Terms and Conditions' : 'View website page'}</Text> : null}
            </View>
            <Text style={styles.arrow} accessibilityElementsHidden importantForAccessibility="no">›</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
