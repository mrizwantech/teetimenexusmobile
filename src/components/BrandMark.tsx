import { Text, View } from 'react-native';

import { brandMarkStyles as styles } from '../theme';

export function BrandMark() {
  return (
    <View style={styles.container}>
      <Text style={styles.top}>TEE TIME</Text>
      <Text style={styles.bottom}>NEXUS</Text>
    </View>
  );
}
