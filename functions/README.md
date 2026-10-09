# Tee Time Nexus push notification backend

Firebase Cloud Functions that deliver personalized app notifications. WordPress decides **when** something happens; this backend decides **who** receives it and sends it with the Firebase Admin SDK.

```
App ──JWT──▶ WordPress (/wp-json/ttn/v1/push/*) ──signed webhook──▶ wordpressEvents ──FCM──▶ user's devices
                  booking paid / changed / cancelled ─┘                sendBookingReminders (every minute)
```

- No FCM topics. Every message targets one WordPress user's registered devices (max 10 per user).
- Notification types: `booking_confirmed`, `booking_rescheduled`, `booking_cancelled`, `booking_reminder_15m`, `admin_message`, `marketing`.
- Android channels: `ttn-bookings` (high), `ttn-account`, `ttn-marketing` (opt-in only).
- Preferences: `booking_updates` and `booking_reminders` default on, `marketing` defaults off. Admin messages to one customer always arrive.
- Push is independent of Kisi door access and never carries access secrets.

## Safety while testing

Delivery is controlled by two parameters in `functions/.env` (git-ignored):

| Variable | Meaning |
| --- | --- |
| `NOTIFY_MODE` | Anything other than exactly `live` is test mode. |
| `TEST_WP_USER_IDS` | Comma-separated WordPress user IDs that may receive notifications in test mode. |
| `REMINDER_LEAD_MINUTES` | Optional, 1–120 (default 15). A shorter lead is only for device testing; remove it before release. Applies to bookings confirmed or rescheduled after the deploy. |

With an empty allowlist nobody receives anything. Keep `NOTIFY_MODE=test` until the app is released.

## One-time setup

1. Upgrade the Firebase project `tee-time-nexus` to the **Blaze** plan (Cloud Functions and Cloud Scheduler require it).
2. Firebase Console → Firestore Database → **Create database** → production mode → location `us-east1`.
3. Install and log in to the CLI: `npm install -g firebase-tools` then `firebase login`.
4. Store the webhook secret (the same value as `TTN_NOTIFY_WEBHOOK_SECRET` in WordPress `wp-config.php`):
   ```sh
   firebase functions:secrets:set TTN_NOTIFY_WEBHOOK_SECRET
   ```
5. Create `functions/.env`:
   ```sh
   NOTIFY_MODE=test
   TEST_WP_USER_IDS=12,34
   ```
   Find a user's ID in WordPress → Users (hover the name; the link shows `user_id=`).

`TTN_JWT_SECRET` is **not** needed in Firebase: the app talks only to WordPress, and Firebase trusts only WordPress's signature.

## Deploy

From the mobile repository root:

```sh
cd functions && npm install && cd ..
firebase deploy --only functions,firestore
```

`firebase.json` builds and runs the tests before deploying. The deploy prints the `wordpressEvents` URL. Add it to WordPress `wp-config.php` above "That's all, stop editing!":

```php
define( 'TTN_NOTIFY_WEBHOOK_URL', 'https://…/wordpressEvents' );
```

Then upload the bookings plugin (including `inc/class-ttn-push-notifications.php`) and purge the site cache.

## Verify, in this order

1. **One test device.** Sign in to the app on a physical phone as an allowlisted user and enable notifications (Settings → Manage Notifications). WordPress → Bookings Manager → **App Notifications** → send to that user's email. The result should say `Sent to 1 device(s)`. "Not on the Firebase test allowlist" means `TEST_WP_USER_IDS` needs the ID and a redeploy.
2. **Booking events.** As the same user, book and pay → "Booking confirmed". Change the time → "Booking updated". Cancel → "Booking cancelled".
3. **Reminder.** Book a slot starting 20–30 minutes from now; the reminder arrives 15 minutes before start (within about a minute). Bookings made less than 15 minutes ahead skip the reminder.
4. **Preferences.** Turn off Booking updates in the app and repeat step 2: nothing arrives, while an admin message still does.

Logs: `firebase functions:log` (tokens, secrets and message bodies are never logged). Failed WordPress deliveries are retried for about an hour and then reported on the App Notifications page and in the PHP error log.

## Going live

After release, set `NOTIFY_MODE=live` in `functions/.env`, remove any test `REMINDER_LEAD_MINUTES` override, and redeploy. Broadcasts reach only users who turned on Offers and news.

## Wire format (WordPress → `wordpressEvents`)

`POST` JSON with headers:

- `X-TTN-Timestamp`: Unix seconds (rejected if more than 5 minutes off).
- `X-TTN-Signature`: `v1=` + hex HMAC-SHA256 of `"<timestamp>.<raw body>"` with the shared secret.

Body: `{ "event_id", "type", "occurred_at", "data" }`. `event_id` (8–128 of `A-Za-z0-9._:-`) makes retries idempotent: an identical retry returns the original result, reusing an id with a different body is refused (409). Retries must resend the identical body with a fresh timestamp.

| `type` | `data` |
| --- | --- |
| `device.register` | `{ user_id, token, platform: "ios" \| "android" }` |
| `device.unregister` | `{ user_id, token }` |
| `preferences.get` | `{ user_id }` |
| `preferences.set` | `{ user_id, preferences: { booking_updates?, booking_reminders?, marketing? } }` |
| `booking.confirmed` / `booking.rescheduled` / `booking.cancelled` / `booking.removed` | `{ booking: { booking_id, customer_id, start_at, end_at, timezone, bay } }` |
| `message.user` | `{ user_id, title (≤65), body (≤240), route }` |
| `message.broadcast` | `{ title, body, route }` |

Times are ISO 8601 with an offset; `timezone` is the facility's IANA zone used for display. `route` must be one of `/`, `/book`, `/membership`, `/reservations`, `/account`, `/notifications`. `booking.removed` is silent and only cancels the reminder.

Responses: `200` ok, `400` invalid event, `401` bad signature, `409` in progress or id reused (retry later), `413` body too large, `500` processing failed (retry).

## Data (Firestore, no client access)

- `users/wp_{id}` preferences; `users/wp_{id}/devices/{sha256(token)}` tokens.
- `deviceOwners/{sha256(token)}` moves a phone to whichever account signed in last.
- `bookings/{id}` reminder schedule (`reminderState`: pending → sent / expired / cancelled).
- `wpEvents/{sha256(event_id)}` idempotency records, auto-deleted after 30 days (TTL on `expireAt`).

## Development

```sh
npm test          # node --test, in-memory store, no network
npm run typecheck
```
