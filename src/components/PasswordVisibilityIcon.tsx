import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme';

type PasswordVisibilityIconProps = {
    visible: boolean;
};

export function PasswordVisibilityIcon({ visible }: PasswordVisibilityIconProps) {
    return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            {visible ? (
                <>
                    <Path d="M2.5 12s3.2-5 9.5-5 9.5 5 9.5 5-3.2 5-9.5 5-9.5-5-9.5-5Z" stroke={colors.muted} strokeWidth="1.7" strokeLinejoin="round" />
                    <Circle cx="12" cy="12" r="2.5" stroke={colors.muted} strokeWidth="1.7" />
                </>
            ) : (
                <>
                    <Path d="M3 3l18 18M10.6 6.2C11.1 6.1 11.5 6 12 6c6.3 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.7M6.2 6.9C3.8 8.2 2.5 12 2.5 12s3.2 6 9.5 6c.5 0 1-.1 1.4-.2" stroke={colors.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </>
            )}
        </Svg>
    );
}
