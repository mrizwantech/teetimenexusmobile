import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const sourceRoot = new URL('../src/', import.meta.url);

test('booking setup uses two text-only cards with the requested labels and descriptions', () => {
  const booking = readFileSync(new URL('../src/app/book.tsx', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../src/components/BayTypeCard.tsx', import.meta.url), 'utf8');
  assert.match(booking, /<Text style=\{styles\.setupHeading\}>Select a bay that matches your swing<\/Text>/);
  const theme = readFileSync(new URL('../src/theme.ts', import.meta.url), 'utf8');
  assert.match(theme, /setupHeading: \{[^}]*fontSize: 16, lineHeight: 22, fontWeight: '700'/);
  const bookingStyles = theme.slice(theme.indexOf('export const bookingStyles'));
  assert.match(bookingStyles, /title: \{[^}]*fontSize: 22, lineHeight: 28, fontWeight: '700'/);
  assert.doesNotMatch(booking, /Choose your bay type|Select the setup that matches your swing/);
  assert.match(booking, /label="Right-Handed"\s+description="For right-handed golfers only"/);
  assert.match(booking, /label="Dual-Handed"\s+description="Play both left- and right-handed"/);
  assert.match(booking, /onPress=\{\(\) => handleBayTypeSelect\('right-handed'\)\}/);
  assert.match(booking, /onPress=\{\(\) => handleBayTypeSelect\('left-handed'\)\}/);
  assert.doesNotMatch(card, /expo-image|<Image|imageFrame/);
  assert.match(card, /accessibilityState=\{\{ selected \}\}/);
  assert.match(card, /minHeight: 116/);
  assert.match(card, /card: \{[^\n]+borderColor: colors\.primary/);
  assert.match(card, /label: \{ color: colors\.primary/);
  assert.match(card, /selectedCard: \{ backgroundColor: colors\.surfaceStrong \}/);
  assert.doesNotMatch(card, /numberOfLines|allowFontScaling/);
});

test('explicit app font sizes use at least 14 points without disabling system text scaling', () => {
  for (const file of readdirSync(sourceRoot, { recursive: true })) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = readFileSync(new URL(file, sourceRoot), 'utf8');
    for (const match of source.matchAll(/fontSize:\s*(\d+)\b/g)) {
      assert.ok(Number(match[1]) >= 14, `${file} has unreadable ${match[1]}-point text`);
    }
    assert.doesNotMatch(source, /allowFontScaling\s*=\s*\{false\}/, `${file} disables system text scaling`);
  }
});

test('paragraphs use bright medium-weight 17-point text and inputs use 16 points', () => {
  const source = readFileSync(new URL('../src/theme.ts', import.meta.url), 'utf8');
  const bodies = [...source.matchAll(/\b(?:body|intro|accountCopy|confirmationBody|modalBody|consentText|termsText|description|feature):\s*\{[^}]+\}/g)];
  assert.ok(bodies.length > 0);
  for (const [style] of bodies) {
    assert.match(style, /fontSize: 17\b/);
    assert.match(style, /lineHeight: 26\b/);
    assert.match(style, /fontWeight: '500'/);
    assert.match(style, /color: colors\.text/);
  }
  const inputs = [...source.matchAll(/\b(?:input|modalInput):\s*\{[^}]+\}/g)];
  assert.ok(inputs.length > 0);
  for (const [style] of inputs) assert.match(style, /fontSize: 16\b/);
});

test('booking progress keeps larger labels scrollable rather than truncated', () => {
  const source = readFileSync(new URL('../src/components/BookingProgress.tsx', import.meta.url), 'utf8');
  assert.match(source, /<ScrollView[^>]+horizontal/);
  assert.match(source, /minWidth: 560/);
  assert.doesNotMatch(source, /numberOfLines/);
  assert.match(source, /scrollTo/);
  assert.equal((source.match(/steps\.map/g) ?? []).length, 1);
  assert.match(source, /style=\{styles\.step\}/);
  assert.match(source, /step: \{ flex: 1, alignItems: 'center'/);
  assert.match(source, /track: \{[^}]*width: '100%'/);
  assert.match(source, /activeNumber: \{ color: colors\.bg \}/);
});

test('booking bay choices use compact full-width image overlays and untruncated names', () => {
  const booking = readFileSync(new URL('../src/app/book.tsx', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../src/components/BayCard.tsx', import.meta.url), 'utf8');
  assert.match(booking, /<BayCard\s+key=\{bay\.key\}\s+bay=\{bay\}\s+index=\{index\}\s+fullWidth/);
  assert.match(booking, /Choose your bay<\/Text>\s+<View style=\{styles\.bayList\}>/);
  const theme = readFileSync(new URL('../src/theme.ts', import.meta.url), 'utf8');
  assert.match(theme, /bayList: \{ flexDirection: 'column', alignItems: 'stretch', gap: spacing\.md \}/);
  assert.match(card, /fullWidth: \{[^}]*width: '100%', flexBasis: 'auto'/);
  assert.match(card, /\{index \+ 1\}/);
  assert.match(card, /number: \{[^}]*backgroundColor: colors\.primary[^}]*minHeight: 32/);
  assert.match(card, /card: \{[^}]*borderColor: colors\.primary/);
  assert.match(card, /imageFrame: \{ width: '100%', minHeight: 140 \}/);
  assert.match(card, /overlay: \{[^}]*backgroundColor: 'rgba\(0, 0, 0, 0\.65\)'/);
  assert.match(card, /<ImageBackground[\s\S]*<View style=\{styles\.overlay\}>[\s\S]*\{bay\.name\}[\s\S]*<\/ImageBackground>/);
  assert.doesNotMatch(card, /numberOfLines/);
});

test('shared screens and cards provide consistent section and child spacing', () => {
  const source = readFileSync(new URL('../src/theme.ts', import.meta.url), 'utf8');
  const screens = source.slice(source.indexOf('export const screenStyles'), source.indexOf('export const sectionCardStyles'));
  const cards = source.slice(source.indexOf('export const sectionCardStyles'), source.indexOf('export const bottomNavStyles'));
  assert.match(screens, /content:.*padding: spacing\.lg.*gap: spacing\.xl/);
  assert.match(cards, /padding: spacing\.lg/);
  assert.match(cards, /gap: spacing\.md/);
  const compact = readFileSync(new URL('../src/components/SectionCard.tsx', import.meta.url), 'utf8');
  assert.match(compact, /padding: spacing\.md, gap: spacing\.sm/);
  const grid = readFileSync(new URL('../src/components/HomePanels.tsx', import.meta.url), 'utf8');
  assert.match(grid, /gridWidth - spacing\.md/);
  assert.match(grid, /grid:.*gap: spacing\.md/);
});
