export const CHECKOUT_SIGNATURE_START = 'ttn:checkout-signature:start';
export const CHECKOUT_SIGNATURE_END = 'ttn:checkout-signature:end';

// Checkout supplies the signature canvas; keep its drawing handlers intact.
export const checkoutSignatureScript = `
(function () {
    if (window.__ttnSignatureScrollGuard) return;
    window.__ttnSignatureScrollGuard = true;
    var signing = false;
    var savedOverflow = [];
    var style = document.createElement('style');
    style.textContent = 'canvas { touch-action: none !important; overscroll-behavior: contain; }';
    document.head.appendChild(style);

    function notify(message) {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
    }

    function start(event) {
        if (signing || !event.target || !event.target.closest || !event.target.closest('canvas')) return;
        signing = true;
        savedOverflow = [document.documentElement, document.body].filter(Boolean).map(function (element) {
            var saved = {
                element: element,
                value: element.style.getPropertyValue('overflow'),
                priority: element.style.getPropertyPriority('overflow')
            };
            element.style.setProperty('overflow', 'hidden', 'important');
            return saved;
        });
        notify('${CHECKOUT_SIGNATURE_START}');
    }

    function end() {
        if (!signing) return;
        signing = false;
        savedOverflow.forEach(function (saved) {
            if (saved.value) saved.element.style.setProperty('overflow', saved.value, saved.priority);
            else saved.element.style.removeProperty('overflow');
        });
        savedOverflow = [];
        notify('${CHECKOUT_SIGNATURE_END}');
    }

    document.addEventListener('touchstart', start, { capture: true, passive: true });
    document.addEventListener('pointerdown', start, true);
    document.addEventListener('touchmove', function (event) {
        if (signing && event.cancelable) event.preventDefault();
    }, { capture: true, passive: false });
    document.addEventListener('touchend', function (event) {
        if (!event.touches.length) end();
    }, true);
    document.addEventListener('touchcancel', end, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    window.addEventListener('blur', end);
    window.addEventListener('pagehide', end);
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) end();
    });
})();
true;
`;
