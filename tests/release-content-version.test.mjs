import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { CONTENT_DOCUMENT, CONTENT_PROJECT, publishContentVersion, releaseContentVersion } from '../functions/scripts/publish-content-version.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('release content labels are valid, unique and independent of the app version', () => {
  const date = new Date('2026-10-22T00:15:00Z');
  const first = releaseContentVersion('1.2.0', date, 'a1b2c3d4');
  const next = releaseContentVersion('1.2.0', date, 'f1e2d3c4');
  assert.equal(first, '1.2.0-20261022T001500000Z-a1b2c3d4');
  assert.notEqual(first, next);
  assert.match(first, /^[A-Za-z0-9._:-]{1,64}$/);
  assert.equal(CONTENT_PROJECT, 'tee-time-nexus');
  assert.equal(CONTENT_DOCUMENT, 'appConfig/publicContent');
  for (const invalid of [undefined, '', '1', '1.0;echo bad', '1.0.0/other', '1'.repeat(25) + '.0.0']) {
    assert.throws(() => releaseContentVersion(invalid), /release version/);
  }
});

test('publishing merges the version, verifies the saved value and preserves other fields', async () => {
  const data = { note: 'keep me', version: '1' };
  let writes = 0;
  const document = {
    async set(value, options) {
      writes += 1;
      assert.deepEqual(options, { merge: true });
      Object.assign(data, value);
    },
    async get() { return { get: (key) => data[key] }; },
  };
  const version = await publishContentVersion(document, '1.2.0');
  assert.equal(writes, 1);
  assert.equal(data.version, version);
  assert.equal(data.note, 'keep me');
});

test('publishing exposes write and verification failures', async () => {
  await assert.rejects(publishContentVersion({
    async set() { throw new Error('permission denied'); },
  }, '1.2.0'), /permission denied/);
  await assert.rejects(publishContentVersion({
    async set() {},
    async get() { return { get: () => 'different' }; },
  }, '1.2.0'), /could not be verified/);
});

function simulateRelease(t, overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'ttn-release-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = join(directory, 'calls');
  writeFileSync(join(directory, 'node'), `#!/bin/sh
if [ "$1" = "functions/scripts/publish-content-version.mjs" ]; then
  printf 'firebase %s\\n' "$2" >> "$CALL_LOG"
  if [ "$2" = "--check" ]; then exit "\${CHECK_EXIT:-0}"; fi
  exit "\${PUBLISH_EXIT:-0}"
fi
exec "$REAL_NODE" "$@"
`, { mode: 0o755 });
  writeFileSync(join(directory, 'npx'), `#!/bin/sh
printf 'eas %s\\n' "$*" >> "$CALL_LOG"
if [ "$2" = "build" ]; then
  printf '%s\\n' "$BUILD_JSON"
  exit "\${BUILD_EXIT:-0}"
fi
exit "\${SUBMIT_EXIT:-0}"
`, { mode: 0o755 });
  const result = spawnSync('bash', ['scripts/testflight-release.sh', '1.2.0'], {
    cwd: root, encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      REAL_NODE: process.execPath,
      CALL_LOG: log,
      BUILD_JSON: JSON.stringify([{ id: 'exact-build', status: 'FINISHED', platform: 'IOS' }]),
      ...overrides,
    },
  });
  return { ...result, calls: readFileSync(log, 'utf8').trim().split('\n') };
}

test('release waits for the exact build and submission before publishing', (t) => {
  const result = simulateRelease(t);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [
    'firebase --check',
    'eas eas-cli@latest build --platform ios --profile production --wait --json',
    'eas eas-cli@latest submit --platform ios --profile production --id exact-build --wait',
    'firebase 1.2.0',
  ]);
});

for (const [name, overrides, expectedCalls] of [
  ['authentication failure', { CHECK_EXIT: '1' }, 1],
  ['build failure', { BUILD_EXIT: '1' }, 2],
  ['unfinished build', { BUILD_JSON: '[{"id":"x","status":"IN_PROGRESS","platform":"IOS"}]' }, 2],
  ['malformed build output', { BUILD_JSON: '{}' }, 2],
  ['submission failure', { SUBMIT_EXIT: '1' }, 3],
]) {
  test(`${name} prevents content publishing`, (t) => {
    const result = simulateRelease(t, overrides);
    assert.notEqual(result.status, 0);
    assert.equal(result.calls.length, expectedCalls);
    assert.ok(!result.calls.includes('firebase 1.2.0'));
  });
}

test('a failed publish after submission reports a retry without rebuilding', (t) => {
  const result = simulateRelease(t, { PUBLISH_EXIT: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /app was submitted, but content refresh failed/);
  assert.match(result.stdout, /npm run content:publish -- 1\.2\.0/);
});

test('release preparation wires publishing only to the accepted build branch', () => {
  execFileSync('bash', ['-n', 'scripts/release.sh'], { cwd: root });
  execFileSync('bash', ['-n', 'scripts/testflight-release.sh'], { cwd: root });
  const source = readFileSync(join(root, 'scripts/release.sh'), 'utf8');
  assert.match(source, /if \[\[ "\$trigger_build" =~ .*?then\n\s+bash scripts\/testflight-release\.sh "\$VERSION"\nfi/s);
  assert.match(source, /npm run lint/);
});

test('invalid release versions stop before authentication or build commands', () => {
  for (const script of ['scripts/release.sh', 'scripts/testflight-release.sh']) {
    const result = spawnSync('bash', [script, 'invalid-version'], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Provide a release version/);
  }
});

function simulateVersionSelection(t, { args = [], input = '', firebaseExit = '0' } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'ttn-release-versions-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = join(directory, 'calls');
  writeFileSync(join(directory, 'node'), `#!/bin/sh
if [ "$1" = "functions/scripts/publish-content-version.mjs" ]; then
  printf 'firebase %s\\n' "$2" >> "$CALL_LOG"
  printf '"1.0.1"\\n'
  exit "$FIREBASE_EXIT"
fi
exec "$REAL_NODE" "$@"
`, { mode: 0o755 });
  // Stop at the clean-worktree check; never allow this test to switch branches or build.
  writeFileSync(join(directory, 'git'), `#!/bin/sh
printf 'git %s\\n' "$*" >> "$CALL_LOG"
exit 1
`, { mode: 0o755 });
  const result = spawnSync('bash', ['scripts/release.sh', ...args], {
    cwd: root, input, encoding: 'utf8',
    env: {
      ...process.env, PATH: `${directory}:${process.env.PATH}`,
      REAL_NODE: process.execPath, CALL_LOG: log, FIREBASE_EXIT: firebaseExit,
    },
  });
  return { ...result, calls: readFileSync(log, 'utf8') };
}

test('release shows local and Firebase versions and accepts an interactive next version', (t) => {
  const result = simulateVersionSelection(t, { input: '1.2.3\n' });
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.ok(result.stdout.includes(`Local app version:     ${app.expo.version}`));
  assert.ok(result.stdout.includes(`Local package version: ${pkg.version}`));
  assert.match(result.stdout, /Firebase content version: "1\.0\.1"/);
  assert.match(result.stdout, /Preparing Release v1\.2\.3 for TestFlight/);
  assert.match(result.calls, /^firebase --show\n/);
  assert.doesNotMatch(result.calls, /git checkout|firebase 1\.2\.3/);
});

test('an explicit release version still displays current versions without prompting', (t) => {
  const result = simulateVersionSelection(t, { args: ['2.0.0'] });
  assert.match(result.stdout, /Firebase content version: "1\.0\.1"/);
  assert.match(result.stdout, /Preparing Release v2\.0\.0 for TestFlight/);
});

for (const [name, options, message] of [
  ['Firebase read failure', { firebaseExit: '1' }, /Unable to read the Firebase content version/],
  ['invalid interactive input', { input: 'bad\n' }, /Provide a release version/],
  ['missing interactive input', {}, /No release version provided/],
]) {
  test(`${name} stops release before git changes`, (t) => {
    const result = simulateVersionSelection(t, options);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, message);
    assert.doesNotMatch(result.calls, /git /);
  });
}
