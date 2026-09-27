import { PropsWithChildren, Ref } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { screenStyles as styles } from '../theme';

export function Screen({ children, scrollRef }: PropsWithChildren<{ scrollRef?: Ref<ScrollView> }>) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ScreenHeader({ children }: PropsWithChildren) {
  return <View style={styles.header}>{children}</View>;
}
