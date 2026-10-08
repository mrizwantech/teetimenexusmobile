import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { bookingPolicyUrl, getMenuItems, primaryNavigation } from '../src/navigation/menu.ts';

test('bottom navigation contains only Booking, Membership, and Menu', () => {
  assert.deepEqual(primaryNavigation.map(({ label, path }) => ({ label, path })), [
    { label: 'Booking', path: '/book' },
    { label: 'Membership', path: '/membership' },
    { label: 'Menu', path: '/menu' },
  ]);
});

test('sheet offers its destinations including Home and Profile once', () => {
  assert.deepEqual(getMenuItems(), [
    { label: 'Profile', path: '/account', kind: 'app' },
    { label: 'Leagues & Tournaments', path: '/competitions', kind: 'app' },
    { label: 'Membership', path: '/membership', kind: 'app' },
    { label: 'Home', path: '/', kind: 'app' },
  ]);
});

test('Experience is omitted from the menu', () => {
  assert.equal(getMenuItems().some((item) => item.path === '/technology' || item.label === 'Experience'), false);
});

test('Menu toggles locally without navigating or replacing the bottom bar', () => {
  const navigation = readFileSync(new URL('../src/components/BottomNav.tsx', import.meta.url), 'utf8');
  assert.match(navigation, /if \(path === '\/menu'\)/);
  assert.match(navigation, /setMenuRoute\(\(route\) => route === pathname \? null : pathname\)/);
  assert.doesNotMatch(navigation, /router\.(push|back|replace)\(/);
  assert.match(navigation, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(navigation, /onNavigate\?\.\(\)/);
  assert.match(navigation, /expanded: active/);
});

test('menu combines competitions and omits removed destinations', () => {
    const items = getMenuItems();
    assert.equal(items.some((item) => item.path === '/book' || item.path === '/menu' || item.path === '/features' || item.kind === 'website'), false);
    assert.equal(items.filter((item) => item.path.startsWith('/competitions')).length, 1);
    assert.equal(items.filter((item) => item.path === '/membership').length, 1);
    assert.equal(new Set(items.map((item) => item.label)).size, items.length);
});

test('Menu uses a dismissible themed sheet with a two-column card grid and one bottom bar', () => {
  const layout = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');
  const menu = readFileSync(new URL('../src/components/MenuSheet.tsx', import.meta.url), 'utf8');
  const navigation = readFileSync(new URL('../src/components/BottomNav.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /transparentModal|pathname !==/);
  assert.match(layout, /<BottomNav \/>/);
  assert.match(navigation, /bottomOffset=\{navHeight\}/);
  assert.match(navigation, /setNavHeight\(event\.nativeEvent\.layout\.height\)/);
  assert.match(menu, /bottom: bottomOffset/);
  assert.match(menu, /accessibilityLabel="Close menu"/);
  assert.match(menu, /\(gridWidth - spacing\.md\) \/ 2/);
  assert.doesNotMatch(menu, /<BottomNav/);
  assert.match(menu, /router\.navigate\(item\.path\)/);
});

test('Features reuses the cached Home feed and two-column native cards', () => {
  const features = readFileSync(new URL('../src/app/features.tsx', import.meta.url), 'utf8');
  assert.match(features, /getHomeContent\(forceRefresh\)/);
  assert.match(features, /<HomePanels content=\{content\} columns=\{2\} mediaOnly \/>/);
  assert.match(features, /loadContent\(true\)/);
});

test('Features shows only media and titles while Home keeps descriptions', () => {
  const panels = readFileSync(new URL('../src/components/HomePanels.tsx', import.meta.url), 'utf8');
  assert.match(panels, /mediaOnly = false/);
  assert.match(panels, /\{!mediaOnly \? <View style=\{styles\.heading\}/);
  assert.match(panels, /\{!mediaOnly \? <>\s*<Text[^>]*>\{panel\.text\}/);
  assert.match(panels, /panel\.title/);
});

test('Menu slides on the native driver without remounting or changing bottom bar height', () => {
  const menu = readFileSync(new URL('../src/components/MenuSheet.tsx', import.meta.url), 'utf8');
  const navigation = readFileSync(new URL('../src/components/BottomNav.tsx', import.meta.url), 'utf8');
  assert.match(navigation, /<MenuSheet visible=\{menuOpen && navHeight > 0\}/);
  assert.doesNotMatch(navigation, /menuOpen && navHeight > 0 \? <MenuSheet/);
  assert.match(navigation, /opacity: active \? 1 : 0/);
  assert.match(menu, /Animated\.timing\(progress/);
  assert.match(menu, /useNativeDriver: true/);
  assert.match(menu, /translateY: progress\.interpolate/);
  assert.match(menu, /pointerEvents=\{visible \? 'auto' : 'none'\}/);
  assert.match(menu, /accessibilityElementsHidden=\{!visible\}/);
  assert.match(menu, /animation\.stop\(\)/);
});

test('competitions supports optional filters and defaults the combined destination to all', () => {
  const competitions = readFileSync(new URL('../src/app/competitions.tsx', import.meta.url), 'utf8');
  assert.match(competitions, /useLocalSearchParams/);
  assert.match(competitions, /setFilter\(type === 'league' \|\| type === 'tournament' \? type : 'all'\)/);
});
test('booking policies remain available to booking screens but are omitted from the menu', () => {
  assert.equal(bookingPolicyUrl, 'https://teetimenexus.com/book-a-bay/#ttn-terms-open');
  assert.equal(getMenuItems().some((item) => item.path === bookingPolicyUrl), false);
});

test('Home and Profile use native routes without restoring the old link list', () => {
  const items = getMenuItems();
  assert.equal(items.find((item) => item.label === 'Home').path, '/');
  assert.equal(items.find((item) => item.label === 'Profile').path, '/account');
  for (const path of ['/hours', '/reservations', 'https://teetimenexus.com/about-us/', '/notifications', '/settings', bookingPolicyUrl]) {
    assert.equal(items.some((item) => item.path === path), false);
  }
  assert.equal(items.length, 4);
  const menu = readFileSync(new URL('../src/components/MenuSheet.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(menu, /styles\.links|styles\.linkTitle|items\.slice/);
});
