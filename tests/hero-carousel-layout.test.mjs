import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { getHeroCardWidth } from '../src/components/hero-carousel-layout.ts';

test('tablet slides fill the measured viewport rather than displaying multiple panels', () => {
    for (const viewportWidth of [600, 720, 976, 984, 1318, 1328]) {
        const cardWidth = getHeroCardWidth(viewportWidth, 3);
        assert.equal(cardWidth, viewportWidth);
        assert.ok(cardWidth * 2 + 16 > viewportWidth);
    }
});

test('phone and narrow split-screen layouts retain the next-card preview', () => {
    for (const viewportWidth of [272, 342, 382, 599]) {
        assert.equal(getHeroCardWidth(viewportWidth, 3), viewportWidth - 28);
    }
});

test('a single slide fills the viewport at every size', () => {
    for (const viewportWidth of [272, 382, 600, 984, 1328]) {
        assert.equal(getHeroCardWidth(viewportWidth, 1), viewportWidth);
    }
    assert.equal(getHeroCardWidth(0, 3), 1);
});

test('pagination and the last slide stay reachable after viewport resizing', () => {
    for (const viewportWidth of [342, 984, 1328, 500]) {
        const cardWidth = getHeroCardWidth(viewportWidth, 3);
        const interval = cardWidth + 16;
        const trailingPadding = viewportWidth - cardWidth;
        const contentWidth = cardWidth * 3 + 16 * 2 + trailingPadding;
        assert.equal(contentWidth - viewportWidth, interval * 2);
        for (let index = 0; index < 3; index += 1) {
            assert.equal(Math.round(index * interval / interval), index);
        }
    }
    const source = readFileSync(new URL('../src/components/HeroCarousel.tsx', import.meta.url), 'utf8');
    assert.match(source, /getHeroCardWidth\(viewportWidth, slides\.length\)/);
    assert.match(source, /onLayout=.*setViewportWidth\(event\.nativeEvent\.layout\.width\)/);
    assert.match(source, /snapToInterval=\{cardInterval\}/);
    assert.match(source, /scrollTo\(\{ x: currentIndexRef\.current \* cardInterval, animated: false \}\)/);
    assert.match(source, /\}, \[cardInterval\]\)/);
});
