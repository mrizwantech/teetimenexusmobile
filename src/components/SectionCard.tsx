import { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { sectionCardStyles as styles } from '../theme';

export function SectionCard({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}
