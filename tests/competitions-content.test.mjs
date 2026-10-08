import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('.') && !extname(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { parseCompetitions } = await import('../src/api/competitions-content.ts');
hooks.deregister();

function fixture() {
  return {
    items: [{
      id: 42,
      title: 'Spring League',
      type: 'league',
      description: 'Weekly league play.',
      start_date: '2027-03-01',
      end_date: '2027-04-30',
      registration_start: '2027-02-01',
      registration_end: '2027-02-25',
      entry_fee: 75,
      currency: 'USD',
      capacity: 24,
      format: 'Individual Stroke Play',
      course: 'Example Course',
      image_url: 'https://example.test/event.jpg',
      url: 'https://teetimenexus.com/competition/spring-league/',
    }],
    count: 1,
  };
}

test('accepts the public WordPress competitions response shape', () => {
  assert.deepEqual(parseCompetitions(fixture()), fixture());
});

test('supports no fee and optional competition details', () => {
  const response = fixture();
  response.items[0].entry_fee = null;
  response.items[0].end_date = '';
  response.items[0].registration_start = '';
  response.items[0].registration_end = '';
  response.items[0].image_url = '';
  response.items[0].course = '';
  response.items[0].format = '';
  assert.deepEqual(parseCompetitions(response), response);
});

test('rejects malformed, unsafe, duplicated, or inconsistent listings', () => {
  const mutations = [
    (value) => { value.items[0].type = 'scramble'; },
    (value) => { value.items[0].start_date = '2027-02-30'; },
    (value) => { value.items[0].end_date = '2027-02-28'; },
    (value) => { value.items[0].image_url = 'javascript:alert(1)'; },
    (value) => { value.items[0].url = 'data:text/html,test'; },
    (value) => { value.items[0].currency = 'US'; },
    (value) => { value.items[0].entry_fee = -1; },
    (value) => { value.items.push({ ...value.items[0] }); value.count = 2; },
    (value) => { value.count = 0; },
  ];
  for (const mutate of mutations) {
    const response = fixture();
    mutate(response);
    assert.throws(() => parseCompetitions(response), /invalid competition listings/);
  }
});
