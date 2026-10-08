import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('.') && !extname(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { parseHoursContent } = await import('../src/api/hours-content.ts');
hooks.deregister();

function fixture() {
  return {
    title: 'Hours & Access',
    sections: [
      {
        id: 'member', title: 'Member Access', time: '24/7',
        note: 'Active members have secure facility access.',
        action: { label: 'Explore Memberships', route: '/membership' },
      },
      {
        id: 'public', title: 'Public Hours', time: '10:00 AM to 10:00 PM',
        note: 'Open 7 days a week for public bookings.',
        action: { label: 'Book Public Hours', route: '/book' },
      },
    ],
  };
}

test('preserves website hours, access copy, order, and native actions', () => {
  assert.deepEqual(parseHoursContent(fixture()), fixture());
});

test('accepts website copy changes without substituting app defaults', () => {
  const content = fixture();
  content.title = 'Updated Hours & Access';
  content.sections[1].time = '9:00 AM to 9:00 PM';
  content.sections[1].note = 'Updated public booking schedule.';
  assert.deepEqual(parseHoursContent(content), content);
});

test('rejects malformed hours, missing fields, duplicate sections, and non-native actions', () => {
  for (const value of [null, [], {}, { title: 'Hours', sections: [] }]) {
    assert.throws(() => parseHoursContent(value), /invalid hours and access content/);
  }
  const mutations = [
    (value) => { value.title = ' '; },
    (value) => { value.sections[0] = null; },
    (value) => { value.sections[1].id = value.sections[0].id; },
    (value) => { value.sections[0].title = ''; },
    (value) => { value.sections[0].time = 24; },
    (value) => { delete value.sections[0].note; },
    (value) => { value.sections[0].action = null; },
    (value) => { value.sections[0].action.label = ''; },
    (value) => { value.sections[0].action.route = 'https://example.test'; },
    (value) => { value.sections[0].action.route = '/checkout'; },
  ];
  for (const mutate of mutations) {
    const content = fixture();
    mutate(content);
    assert.throws(() => parseHoursContent(content), /invalid hours and access content/);
  }
});
