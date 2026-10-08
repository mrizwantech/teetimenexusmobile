import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../theme';

type NavigationIconProps = {
    name: 'home' | 'book' | 'reservations' | 'membership' | 'profile' | 'menu';
    active?: boolean;
};

export function NavigationIcon({ name, active = false }: NavigationIconProps) {
    const color = active ? colors.primary : colors.subtle;
    const common = { stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

    if (name === 'menu') {
        return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4 6h16M4 12h16M4 18h16" {...common} /></Svg>;
    }

    if (name === 'home') {
        return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" {...common} /><Path d="M9 21v-7h6v7" {...common} /></Svg>;
    }

    if (name === 'book') {
        return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Rect x="4" y="5" width="16" height="16" rx="2" {...common} /><Path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 18h.01" {...common} /></Svg>;
    }

    if (name === 'reservations') {
        return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Rect x="3" y="5" width="18" height="16" rx="2" {...common} /><Path d="M7 3v4M17 3v4M3 10h18M7 14h10M7 17h6" {...common} /></Svg>;
    }

    if (name === 'membership') {
        return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" {...common} /></Svg>;
    }

    return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Circle cx="12" cy="8" r="3.5" {...common} /><Path d="M4.5 21c.7-4 3.1-6 7.5-6s6.8 2 7.5 6" {...common} /></Svg>;
}
