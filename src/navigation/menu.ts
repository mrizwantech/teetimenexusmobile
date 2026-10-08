export const primaryNavigation = [
  { label: 'Booking', path: '/book', icon: 'book' },
  { label: 'Membership', path: '/membership', icon: 'membership' },
  { label: 'Menu', path: '/menu', icon: 'menu' },
] as const;

export const bookingPolicyUrl = 'https://teetimenexus.com/book-a-bay/#ttn-terms-open';

const websiteNavigation = [
  { label: 'Home', path: '/', kind: 'app' },
  { label: 'Membership', path: '/membership', kind: 'app' },
  { label: '24/7 Hours & Access', path: 'https://teetimenexus.com/hours/', kind: 'website' },
  { label: 'Experience', path: '/technology', kind: 'app' },
  { label: 'Leagues & Tournaments', path: '/competitions', kind: 'app' },
  { label: 'About Us', path: 'https://teetimenexus.com/about-us/', kind: 'website' },
] as const;

export function getMenuItems(signedIn: boolean) {
  return [
    ...websiteNavigation,
    { label: 'Booking, Cancellation & Refund Policy', path: bookingPolicyUrl, kind: 'website' } as const,
    ...(signedIn ? [{ label: 'My Reservations', path: '/reservations', kind: 'app' } as const] : []),
    { label: signedIn ? 'My Account' : 'Login / Sign Up', path: '/account', kind: 'app' } as const,
    { label: 'Notifications', path: '/notifications', kind: 'app' } as const,
  ];
}
