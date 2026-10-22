import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';

import { BrandMark } from './BrandMark';
import { ScreenHeader } from './Screen';
import { colors } from '../theme';
import { usePush } from '../context/PushContext';
import { notificationBadge } from '../notifications/history';

export function HomeHeader() {
    const { unreadCount } = usePush();
    const badge = notificationBadge(unreadCount);
    return (
        <ScreenHeader>
            <BrandMark />
            <Pressable
                accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => router.push('/notifications')}
                style={styles.button}
            >
                <View>
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" accessibilityLabel="Bell">
                        <Path
                            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
                            stroke={colors.heading}
                            strokeWidth={1.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </Svg>
                    {unreadCount > 0 ? (
                        <View pointerEvents="none" style={[styles.badge, badge ? styles.countBadge : styles.dot]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                            {badge ? <Text style={styles.badgeText}>{badge}</Text> : null}
                        </View>
                    ) : null}
                </View>
            </Pressable>
        </ScreenHeader>
    );
}

const styles = StyleSheet.create({
    button: { alignItems: 'center', justifyContent: 'center', padding: 10, minHeight: 44, minWidth: 44 },
    badge: { position: 'absolute', top: -6, right: -8, backgroundColor: '#EF4444', borderColor: colors.bg, borderWidth: 2 },
    dot: { width: 10, height: 10, borderRadius: 5, top: -2, right: -2 },
    countBadge: { minWidth: 24, minHeight: 24, borderRadius: 16, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
    badgeText: { color: colors.heading, fontSize: 14, lineHeight: 18, fontWeight: '800' },
});
