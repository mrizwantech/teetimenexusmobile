import { Image } from 'react-native';

import { brandMarkStyles as styles } from '../theme';

export function BrandMark() {
  return <Image source={require('../../assets/tee-time-nexus-header-logo.png')} style={styles.image} resizeMode="contain" accessibilityLabel="Tee Time Nexus" />;
}
