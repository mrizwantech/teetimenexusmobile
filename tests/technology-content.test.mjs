import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('.') && !extname(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { parseTechnologyContent } = await import('../src/api/technology-content.ts');
hooks.deregister();

function fixture() {
  return {
    section: { title: 'Practice Smarter. Play Better.', subtitle: 'Website introduction' },
    disclaimer: 'Facility configuration may vary.',
    panels: Array.from({ length: 13 }, (_, index) => ({
      id: `technology-${index}`, number: String(index + 1).padStart(2, '0'),
      title: 'Website feature', text: 'Website description', details: ['Measurement'],
      subsections: [{ title: 'Practice mode', text: 'Practice description' }], after: 'More information',
      media: 'https://example.test/image.gif', media_type: 'gif', video_url: '',
    })),
  };
}

test('preserves all technology sections and full details without website buttons', () => {
  assert.deepEqual(parseTechnologyContent(fixture()), fixture());
  assert.equal(parseTechnologyContent(fixture()).panels.length, 13);
});

test('allows missing media and official YouTube previews', () => {
  const content = fixture();
  content.panels[0].media = '';
  content.panels[1].media = 'https://i.ytimg.com/vi/wLWPu46TT68/hqdefault.jpg';
  content.panels[1].media_type = 'image';
  content.panels[1].video_url = 'https://www.youtube.com/watch?v=wLWPu46TT68';
  assert.deepEqual(parseTechnologyContent(content), content);
});

test('rejects malformed content, unsafe media, duplicate sections, and invalid videos', () => {
  const mutations = [
    (value) => { value.panels = []; },
    (value) => { value.panels[1].id = value.panels[0].id; },
    (value) => { value.panels[0].media = 'javascript:alert(1)'; },
    (value) => { value.panels[0].details = [123]; },
    (value) => { value.panels[0].subsections = [{ title: 'Test' }]; },
    (value) => { value.panels[0].video_url = 'https://example.test/video'; },
    (value) => { value.panels[0].after = null; },
    (value) => { delete value.disclaimer; },
  ];
  for (const mutate of mutations) {
    const content = fixture();
    mutate(content);
    assert.throws(() => parseTechnologyContent(content), /invalid technology content/);
  }
});
