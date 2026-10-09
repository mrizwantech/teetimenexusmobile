import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, sectionCardStyles as styles, spacing } from '../theme';

export function SectionCard({ children, compact = false, accent = false }: PropsWithChildren<{ compact?: boolean; accent?: boolean }>) {
  return <View style={[styles.card, compact && compactStyles.card, accent && compactStyles.accent]}>{children}</View>;
}

const compactStyles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.sm },
  accent: { borderColor: colors.primary },
});
