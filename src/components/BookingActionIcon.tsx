import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../theme';

type BookingActionIconProps = {
    name: 'calendar' | 'players' | 'directions';
};

export function BookingActionIcon({ name }: BookingActionIconProps) {
    if (name === 'calendar') {
        return (
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Rect x="3" y="5" width="18" height="16" rx="2" stroke={colors.heading} strokeWidth="1.7" />
                <Path d="M7 3v4M17 3v4M3 10h18M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01" stroke={colors.heading} strokeWidth="1.7" strokeLinecap="round" />
            </Svg>
        );
    }

    if (name === 'players') {
        return (
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Circle cx="9" cy="8" r="3" stroke={colors.heading} strokeWidth="1.7" />
                <Path d="M3.5 20c.5-3.2 2.3-5 5.5-5s5 1.8 5.5 5M16 5.5a2.5 2.5 0 0 1 0 5M17 15c2.1.3 3.4 1.9 3.7 4" stroke={colors.heading} strokeWidth="1.7" strokeLinecap="round" />
            </Svg>
        );
    }

    return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke={colors.heading} strokeWidth="1.7" strokeLinejoin="round" />
            <Circle cx="12" cy="10" r="2.5" stroke={colors.heading} strokeWidth="1.7" />
        </Svg>
    );
}
