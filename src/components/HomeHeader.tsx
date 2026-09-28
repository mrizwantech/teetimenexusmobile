import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { BrandMark } from './BrandMark';
import { ScreenHeader } from './Screen';
import { colors } from '../theme';

type HomeHeaderProps = {
    hasNotifications?: boolean;
    onNotificationsPress?: () => void;
};

export function HomeHeader({ hasNotifications = true, onNotificationsPress }: HomeHeaderProps) {
    return (
        <ScreenHeader>
            <BrandMark />
            <Pressable
                accessibilityLabel={hasNotifications ? 'Notifications available' : 'Notifications'}
                accessibilityRole="button"
                hitSlop={8}
                onPress={onNotificationsPress}
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
                        {hasNotifications ? <Circle cx="20" cy="4" r="3" fill="#EF4444" stroke={colors.bg} strokeWidth="1.5" /> : null}
                    </Svg>
                </View>
            </Pressable>
        </ScreenHeader>
    );
}

const styles = StyleSheet.create({
    button: { alignItems: 'center', justifyContent: 'center', padding: 6 },
});
