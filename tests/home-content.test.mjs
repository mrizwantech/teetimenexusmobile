import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseHomeContent } from '../src/api/home-content.ts';

function fixture() {
  return {
    slides: Array.from({ length: 3 }, (_, index) => ({
      id: `slide-${index + 1}`,
      image: `https://teetimenexus.com/slide-${index + 1}.png`,
      kicker: 'Coming Soon',
      heading: 'Grand Opening TBD',
      text: 'Website description',
      actions: [
        { label: 'Become a Member', url: 'https://teetimenexus.com/membership/', route: '/membership' },
        { label: 'Book a Bay', url: 'https://teetimenexus.com/book-a-bay/', route: '/book' },
      ],
    })),
    section: { title: 'WHERE GOLF MEETS TECHNOLOGY', subtitle: 'Website subtitle' },
    panels: ['video', 'video', 'gif', 'gif', 'gif', 'gif'].map((type, index) => ({
      id: `feature-${index + 1}`,
      title: `Feature ${index + 1}`,
      text: 'WordPress-managed panel description',
      media: `https://teetimenexus.com/feature-${index + 1}.${type === 'video' ? 'mp4' : 'gif'}?v=2`,
      media_type: type,
    })),
  };
}

test('preserves three slides, six panels, all media URLs and both native actions', () => {
  const input = fixture();
  const content = parseHomeContent(input);
  assert.deepEqual(content, input);
  assert.equal(content.slides.length, 3);
  assert.equal(content.panels.length, 6);
  assert.equal(content.panels.filter((panel) => panel.media_type === 'video').length, 2);
  assert.equal(content.panels.filter((panel) => panel.media_type === 'gif').length, 4);
  assert.deepEqual(content.slides[0].actions.map((action) => action.route), ['/membership', '/book']);
});

test('allows image panels and explicitly empty optional media', () => {
  const input = fixture();
  input.panels[0].media_type = 'image';
  input.panels[0].media = '';
  input.slides[0].image = '';
  assert.deepEqual(parseHomeContent(input), input);
});

test('rejects empty, missing, malformed and duplicate content instead of substituting defaults', () => {
  for (const invalid of [undefined, null, '', [], {}, { slides: [] }]) {
    assert.throws(() => parseHomeContent(invalid), /invalid home-page content/);
  }
  const mutations = [
    (input) => { input.slides = []; },
    (input) => { input.slides[0].image = 'not-a-url'; },
    (input) => { input.slides[0].heading = null; },
    (input) => { input.slides[0].actions = []; },
    (input) => { input.slides[0].actions[0].route = '/unknown'; },
    (input) => { input.slides[0].actions[0].label = ' '; },
    (input) => { input.slides[1].id = input.slides[0].id; },
    (input) => { input.panels[0].media_type = 'unknown'; },
    (input) => { input.panels[0].media = 'javascript:alert(1)'; },
    (input) => { input.panels[0].media = 'file:///private/image.png'; },
    (input) => { input.panels[0].text = 42; },
    (input) => { input.panels[1].id = input.panels[0].id; },
    (input) => { delete input.section.subtitle; },
  ];
  for (const mutate of mutations) {
    const input = fixture();
    mutate(input);
    assert.throws(() => parseHomeContent(input), /invalid home-page content/);
  }
});
