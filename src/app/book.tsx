import { StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { colors, spacing } from '../theme';

export default function BookScreen() {
  return <Screen><ScreenHeader><BrandMark /><Text style={styles.step}>STEP 1 OF 4</Text></ScreenHeader><View><Text style={styles.kicker}>RESERVE A BAY</Text><Text style={styles.title}>Book your session</Text><Text style={styles.body}>Choose your bay type and we will show the available times.</Text></View><SectionCard><Text style={styles.label}>Bay type</Text><View style={styles.options}><View style={styles.selected}><Text style={styles.selectedText}>Right handed</Text></View><View style={styles.option}><Text style={styles.optionText}>Left handed</Text></View></View><Text style={styles.label}>Duration</Text><View style={styles.options}><View style={styles.selected}><Text style={styles.selectedText}>1 hour</Text></View><View style={styles.option}><Text style={styles.optionText}>2 hours</Text></View></View><PrimaryButton label="Continue to availability" /></SectionCard></Screen>;
}

const styles = StyleSheet.create({
  step: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  kicker: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: colors.heading, fontSize: 34, fontWeight: '900', marginTop: 8 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 10 },
  label: { color: colors.heading, fontSize: 15, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  options: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  selected: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  option: { borderColor: colors.borderStrong, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 11 },
  selectedText: { color: colors.primaryContrast, fontWeight: '800' },
  optionText: { color: colors.text, fontWeight: '700' },
});