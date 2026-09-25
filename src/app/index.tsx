import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { colors, spacing } from '../theme';

export default function HomeScreen() {
  return (
    <Screen>
      <ScreenHeader><BrandMark /><Text style={styles.live}>OPENING SOON</Text></ScreenHeader>
      <View style={styles.hero}>
        <Text style={styles.kicker}>TEE TIME NEXUS</Text>
        <Text style={styles.title}>Your next round starts here.</Text>
        <Text style={styles.body}>Premium indoor golf, practice, leagues, and private events in Mooresville.</Text>
        <Link href="/book" asChild><PrimaryButton label="Book your session" /></Link>
      </View>
      <View style={styles.heading}><Text style={styles.sectionTitle}>Why golfers choose us</Text></View>
      <SectionCard><Text style={styles.kicker}>PRECISION</Text><Text style={styles.cardTitle}>Professional simulator setup</Text><Text style={styles.body}>High-speed launch tracking and immersive course play make every session feel like the real thing.</Text></SectionCard>
      <SectionCard><Text style={styles.kicker}>EVENTS</Text><Text style={styles.cardTitle}>Private leagues & parties</Text><Text style={styles.body}>A premium atmosphere for corporate nights, birthdays, and friendly competitions.</Text></SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.surfaceStrong, borderColor: colors.border, borderRadius: 24, borderWidth: 1, gap: spacing.md, padding: spacing.xl },
  kicker: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: colors.heading, fontSize: 38, fontWeight: '900', lineHeight: 42 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  live: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heading: { paddingTop: spacing.sm },
  sectionTitle: { color: colors.heading, fontSize: 24, fontWeight: '800' },
  cardTitle: { color: colors.heading, fontSize: 20, fontWeight: '800', marginVertical: 8 },
});