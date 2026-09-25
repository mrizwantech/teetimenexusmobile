import { Platform } from 'react-native';

export const colors = {
  bg: '#050505',
  surface: '#121212',
  surfaceStrong: '#0A0C0C',
  surfaceSoft: '#181818',
  primary: '#A1E04C',
  primaryHover: '#B5F565',
  primaryContrast: '#101010',
  text: '#F5F5F5',
  heading: '#FFFFFF',
  muted: '#B8B8B8',
  subtle: '#777777',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  danger: '#FCA5A5',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const shadows = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  android: { elevation: 8 },
  default: {},
});