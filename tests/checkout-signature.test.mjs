import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { CHECKOUT_SIGNATURE_END, CHECKOUT_SIGNATURE_START, checkoutSignatureScript } from '../src/api/checkout-signature.ts';

function checkout() {
    const handlers = new Map();
    const messages = [];
    const addEventListener = (name, callback, options) => {
        const entries = handlers.get(name) ?? [];
        entries.push({ callback, options });
        handlers.set(name, entries);
    };
    const element = (initial = '', priority = '') => {
        const values = new Map(initial ? [['overflow', [initial, priority]]] : []);
        return { style: {
            getPropertyValue: (key) => values.get(key)?.[0] ?? '',
            getPropertyPriority: (key) => values.get(key)?.[1] ?? '',
            setProperty: (key, value, nextPriority) => values.set(key, [value, nextPriority]),
            removeProperty: (key) => values.delete(key),
        } };
    };
    const document = {
        addEventListener,
        documentElement: element('auto', 'important'),
        body: element(),
        head: { appendChild() {} },
        createElement: () => ({ textContent: '' }),
        hidden: false,
    };
    const window = { addEventListener, ReactNativeWebView: { postMessage: (message) => messages.push(message) } };
    const context = vm.createContext({ document, window });
    vm.runInContext(checkoutSignatureScript, context);
    return {
        document, messages, handlers,
        inject: () => vm.runInContext(checkoutSignatureScript, context),
        event: (name, value = {}) => handlers.get(name)?.forEach(({ callback }) => callback(value)),
        canvas: { closest: (selector) => selector === 'canvas' ? {} : null },
    };
}

test('drawing locks scrolling immediately and release restores the original page styles', () => {
    const page = checkout();
    page.event('touchstart', { target: page.canvas });
    assert.deepEqual(page.messages, [CHECKOUT_SIGNATURE_START]);
    assert.equal(page.document.body.style.getPropertyValue('overflow'), 'hidden');
    let prevented = false;
    page.event('touchmove', { cancelable: true, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(page.handlers.get('touchmove')[0].options.passive, false);
    page.event('touchend', { touches: [] });
    assert.deepEqual(page.messages, [CHECKOUT_SIGNATURE_START, CHECKOUT_SIGNATURE_END]);
    assert.equal(page.document.body.style.getPropertyValue('overflow'), '');
    assert.equal(page.document.documentElement.style.getPropertyValue('overflow'), 'auto');
    assert.equal(page.document.documentElement.style.getPropertyPriority('overflow'), 'important');
});

test('normal checkout touches never disable scrolling or interfere with handlers', () => {
    const page = checkout();
    page.event('touchstart', { target: { closest: () => null } });
    page.event('touchmove', { cancelable: true, preventDefault: () => assert.fail('Normal scrolling must work') });
    assert.deepEqual(page.messages, []);
});

test('interrupted strokes and navigation always restore scrolling', () => {
    for (const name of ['touchcancel', 'pointerup', 'pointercancel', 'blur', 'pagehide', 'visibilitychange']) {
        const page = checkout();
        page.event('pointerdown', { target: page.canvas });
        page.document.hidden = true;
        page.event(name);
        assert.deepEqual(page.messages, [CHECKOUT_SIGNATURE_START, CHECKOUT_SIGNATURE_END], name);
        assert.equal(page.document.body.style.getPropertyValue('overflow'), '');
    }
});

test('duplicate pointer/touch starts do not overwrite saved styles; another finger keeps the lock', () => {
    const page = checkout();
    page.inject();
    page.event('pointerdown', { target: page.canvas });
    page.event('touchstart', { target: page.canvas });
    page.event('touchend', { touches: [{}] });
    assert.deepEqual(page.messages, [CHECKOUT_SIGNATURE_START]);
    page.event('touchend', { touches: [] });
    assert.deepEqual(page.messages, [CHECKOUT_SIGNATURE_START, CHECKOUT_SIGNATURE_END]);
    assert.equal(page.document.documentElement.style.getPropertyValue('overflow'), 'auto');
});

test('checkout bridges stroke state to native scrolling and resets on page loads', () => {
    const source = readFileSync(new URL('../src/app/checkout.tsx', import.meta.url), 'utf8');
    assert.match(source, /injectedJavaScript=\{checkoutSignatureScript\}/);
    assert.match(source, /scrollEnabled=\{!signing\}/);
    assert.match(source, /onLoadStart=\{\(\) => setSigning\(false\)\}/);
    assert.match(source, /event\.nativeEvent\.data === CHECKOUT_SIGNATURE_END/);
});
