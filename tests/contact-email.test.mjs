import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function client(value, error) {
    const calls = [];
    const source = readFileSync(new URL('../src/api/contact-email.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, {
        exports,
        require: (name) => {
            assert.equal(name, './client');
            return {
                apiRequest: async (...args) => {
                    calls.push(args);
                    if (error) throw error;
                    return value;
                },
            };
        },
    });
    return { api: exports, calls };
}

const required = { required: true, verified: false, email: 'relay@privaterelay.appleid.com', pending_email: null };

test('contact-email requests use authenticated API client and normalized POST bodies', async () => {
    const { api, calls } = client(required);
    assert.equal((await api.getContactEmailStatus()).required, true);
    await api.sendContactEmailCode(' contact@example.test ');
    await api.verifyContactEmailCode(' 123456 ');
    assert.equal(calls[0][0], '/wp-json/ttn/v1/account/contact-email');
    assert.equal(calls[1][0], '/wp-json/ttn/v1/account/contact-email/send');
    assert.equal(calls[1][1].method, 'POST');
    assert.equal(calls[1][1].body, '{"email":"contact@example.test"}');
    assert.equal(calls[2][0], '/wp-json/ttn/v1/account/contact-email/verify');
    assert.equal(calls[2][1].body, '{"code":"123456"}');
});

test('contact-email status rejects malformed or empty server responses instead of allowing checkout', async () => {
    for (const value of [null, undefined, {}, { ...required, required: 'false' }, { ...required, verified: undefined },
        { ...required, email: 123 }, { ...required, pending_email: {} }]) {
        await assert.rejects(client(value).api.getContactEmailStatus(), /invalid contact-email status/);
    }
    const pending = { ...required, pending_email: 'contact@example.test' };
    assert.equal((await client(pending).api.getContactEmailStatus()).pending_email, 'contact@example.test');
    const verified = { required: false, verified: true, email: 'contact@example.test', pending_email: null };
    assert.equal((await client(verified).api.verifyContactEmailCode('123456')).verified, true);
});

test('verification mail failures and invalid codes are surfaced unchanged', async () => {
    const error = new Error('Incorrect verification code.');
    await assert.rejects(client(undefined, error).api.verifyContactEmailCode('123456'), error);
    await assert.rejects(client(undefined, new Error('Unable to send email.')).api.sendContactEmailCode('contact@example.test'), /Unable to send email/);
});

test('profile offers code entry and membership checkout directs required users to Profile', () => {
    const profile = readFileSync(new URL('../src/components/ProfileScreen.tsx', import.meta.url), 'utf8');
    assert.match(profile, /<ContactEmailVerification key=\{user\.id\} \/>/);
    const form = readFileSync(new URL('../src/components/ContactEmailVerification.tsx', import.meta.url), 'utf8');
    assert.match(form, /await verifyContactEmailCode\(code\)/);
    assert.match(form, /await refreshUser\(\)/);
    assert.match(form, /Six-digit verification code/);
    assert.match(form, /this becomes your account email/);
    const membership = readFileSync(new URL('../src/app/membership.tsx', import.meta.url), 'utf8');
    assert.match(membership, /user && \(await getContactEmailStatus\(\)\)\.required/);
    assert.match(membership, /OPEN PROFILE.*router\.push\('\/account'\)/);
    assert.ok(membership.indexOf('await getContactEmailStatus()') < membership.indexOf('await startMembershipCheckout(packageInfo.slug)'));
});
