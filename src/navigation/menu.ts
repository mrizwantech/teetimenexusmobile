export const primaryNavigation = [
  { label: 'Booking', path: '/book', icon: 'book' },
  { label: 'Membership', path: '/membership', icon: 'membership' },
  { label: 'Menu', path: '/menu', icon: 'menu' },
] as const;

export const bookingPolicyUrl = 'https://teetimenexus.com/refund_cancellation/';

const websiteNavigation = [
  { label: 'Home', path: '/', kind: 'app' },
  { label: 'Leagues & Tournaments', path: '/competitions', kind: 'app' },
] as const;

export function getMenuItems(isSignedIn = false) {
  return [
    { label: isSignedIn ? 'Profile' : 'Login / Sign up', path: '/account', kind: 'app' } as const,
    ...websiteNavigation,
  ];
}
