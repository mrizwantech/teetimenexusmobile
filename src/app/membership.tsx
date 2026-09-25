import { StyleSheet, Text } from 'react-native';

import { BrandMark } from '../components/BrandMark';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { colors } from '../theme';

export default function MembershipScreen() {
  return <Screen><ScreenHeader><BrandMark /><Text style={styles.label}>MEMBERSHIP</Text></ScreenHeader><Text style={styles.title}>Choose your level</Text><SectionCard><Text style={styles.kicker}>PAR</Text><Text style={styles.price}>$250<Text style={styles.month}> / month</Text></Text><Text style={styles.body}>Flexible off-peak access, guest privileges, and standard club rentals.</Text></SectionCard><SectionCard><Text style={styles.kicker}>BIRDIE</Text><Text style={styles.price}>$399<Text style={styles.month}> / month</Text></Text><Text style={styles.body}>More playing time and premium perks for regular golfers.</Text></SectionCard></Screen>;
}

const styles = StyleSheet.create({ label: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 }, title: { color: colors.heading, fontSize: 34, fontWeight: '900' }, kicker: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 }, price: { color: colors.heading, fontSize: 32, fontWeight: '900', marginVertical: 10 }, month: { color: colors.muted, fontSize: 14, fontWeight: '600' }, body: { color: colors.muted, fontSize: 15, lineHeight: 23 } });