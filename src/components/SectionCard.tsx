import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { sectionCardStyles as styles } from '../theme';

export function SectionCard({ children, compact = false }: PropsWithChildren<{ compact?: boolean }>) {
  return <View style={[styles.card, compact && compactStyles.card]}>{children}</View>;
}

const compactStyles = StyleSheet.create({ card: { padding: 12 } });
