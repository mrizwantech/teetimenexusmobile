export const primaryNavigation = [
  { label: 'Booking', path: '/book', icon: 'book' },
  { label: 'Membership', path: '/membership', icon: 'membership' },
  { label: 'Menu', path: '/menu', icon: 'menu' },
] as const;

export const bookingPolicyUrl = 'https://teetimenexus.com/book-a-bay/#ttn-terms-open';

const websiteNavigation = [
  { label: 'Profile', path: '/account', kind: 'app' },
  { label: 'Leagues & Tournaments', path: '/competitions', kind: 'app' },
  { label: 'Membership', path: '/membership', kind: 'app' },
  { label: 'Home', path: '/', kind: 'app' },
] as const;

export function getMenuItems() {
  return [...websiteNavigation];
}
