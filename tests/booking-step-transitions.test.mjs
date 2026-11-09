import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/app/book.tsx', import.meta.url), 'utf8');

test('date selection never schedules an animated scroll into the next options', () => {
    assert.doesNotMatch(source, /scrollToLatestStep|scrollToEnd|setTimeout/);
    assert.match(source, /function selectDate\(nextDate: Date\)/);
    assert.match(source, /setDate\(nextDate\)/);
    assert.match(source, /setCurrentStep\(3\)/);
});

test('forward and Back transitions mount distinct controls instead of carrying pressed state', () => {
    assert.match(source, /<SectionCard key=\{`booking-step-\$\{currentStep\}`\}>/);
    assert.match(source, /setCurrentStep\(\(step\) => Math\.max\(0, step - 1\)\)/);
    assert.match(source, /<Screen scrollRef=\{scrollRef\}>/);
    assert.doesNotMatch(source, /<Screen[^>]*key=/);
});
