import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import * as logger from 'firebase-functions/logger';
import { defineSecret, defineString } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { handleContentVersionWrite, parseContentVersion, PUBLIC_CONTENT_DOCUMENT } from './content-refresh.ts';
import { FirestoreNotificationStore } from './firestore-store.ts';
import { processWebhook, sendDueReminders } from './handlers.ts';
import { parseDeliveryMode, parseTestUserIds } from './messages.ts';
import type { Deps, MessageSender } from './types.ts';

setGlobalOptions({ region: 'us-east1', maxInstances: 5 });

const app = initializeApp();
const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

const webhookSecret = defineSecret('TTN_NOTIFY_WEBHOOK_SECRET');
const notifyMode = defineString('NOTIFY_MODE', {
  default: 'test',
  description: 'Set to "live" only when production notifications may be sent. Any other value restricts delivery to TEST_WP_USER_IDS.',
});
const testUserIds = defineString('TEST_WP_USER_IDS', {
  default: '',
  description: 'Comma-separated WordPress user IDs allowed to receive notifications while NOTIFY_MODE is test.',
});

const sender: MessageSender = {
  async sendEach(messages) {
    const response = await getMessaging(app).sendEach(messages);
    return response.responses.map((item) => (item.success ? { ok: true } : { ok: false, code: item.error?.code ?? 'unknown' }));
  },
  async validateToken(token) {
    try {
      await getMessaging(app).send({ token, data: { type: 'token_check' } }, true);
      return { ok: true };
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'unknown';
      return { ok: false, code };
    }
  },
};

function deps(): Deps {
  return {
    store: new FirestoreNotificationStore(db),
    sender,
    mode: parseDeliveryMode(notifyMode.value()),
    testUserIds: parseTestUserIds(testUserIds.value()),
    now: () => Date.now(),
    log: logger,
  };
}

export const wordpressEvents = onRequest(
  { secrets: [webhookSecret], invoker: 'public', cors: false, timeoutSeconds: 60, memory: '256MiB' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).set('Allow', 'POST').json({ ok: false, error: 'method_not_allowed' });
      return;
    }
    const result = await processWebhook(
      { rawBody: req.rawBody, timestamp: req.get('x-ttn-timestamp'), signature: req.get('x-ttn-signature') },
      webhookSecret.value(),
      deps(),
    );
    res.status(result.status).set('Cache-Control', 'no-store').json(result.body);
  },
);

// Editing appConfig/publicContent.version in the Firebase Console tells every app to refresh its public content cache.
export const publicContentChanged = onDocumentWritten(
  { document: PUBLIC_CONTENT_DOCUMENT, retry: false, timeoutSeconds: 60, memory: '256MiB' },
  async (event) => {
    await handleContentVersionWrite(
      { before: event.data?.before.data(), after: event.data?.after.data() },
      (message) => getMessaging(app).send(message),
      logger,
    );
  },
);

// Apps check this on launch and when foregrounded, so devices that missed the silent push still refresh.
export const publicContentVersion = onRequest(
  { invoker: 'public', cors: false, timeoutSeconds: 10, memory: '256MiB' },
  async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
      res.status(405).set('Allow', 'GET').json({ ok: false, error: 'method_not_allowed' });
      return;
    }
    try {
      const snapshot = await db.doc(PUBLIC_CONTENT_DOCUMENT).get();
      res.status(200).json({ version: parseContentVersion(snapshot.get('version')) });
    } catch (error) {
      logger.error('Unable to read the public content version.', { error: error instanceof Error ? error.message : String(error) });
      res.status(503).json({ ok: false, error: 'unavailable' });
    }
  },
);

export const sendBookingReminders = onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'America/New_York', retryCount: 0, timeoutSeconds: 120, memory: '256MiB' },
  async () => {
    await sendDueReminders(deps());
  },
);
