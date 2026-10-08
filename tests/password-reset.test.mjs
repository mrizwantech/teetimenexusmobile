import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getPasswordResetUrl } from '../src/navigation/password-reset.ts';

test('password reset uses the existing WordPress flow on the configured website', () => {
  for (const base of ['https://teetimenexus.com', 'https://teetimenexus.com/']) {
    assert.equal(getPasswordResetUrl(base), 'https://teetimenexus.com/wp-login.php?action=lostpassword');
  }
  assert.equal(getPasswordResetUrl('https://staging.example.test/wordpress/'), 'https://staging.example.test/wordpress/wp-login.php?action=lostpassword');
});

test('password reset URL carries no credentials and rejects invalid configuration', () => {
  const url = new URL(getPasswordResetUrl('https://teetimenexus.com'));
  assert.deepEqual([...url.searchParams], [['action', 'lostpassword']]);
  assert.throws(() => getPasswordResetUrl(''), TypeError);
});

test('login offers password reset independently of login errors and uses the existing browser flow', () => {
  const account = readFileSync(new URL('../src/app/account.tsx', import.meta.url), 'utf8');
  assert.match(account, /\{!isRegistering \? <ForgotPasswordLink \/> : null\}/);
  const link = readFileSync(new URL('../src/components/ForgotPasswordLink.tsx', import.meta.url), 'utf8');
  assert.match(link, /WebBrowser\.openBrowserAsync\(url\)/);
  assert.match(link, /disabled=\{opening\}/);
  assert.match(link, /Alert\.alert\('Unable to open password reset'/);
});
