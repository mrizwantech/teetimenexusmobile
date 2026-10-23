# Tee Time Nexus push notification backend

Firebase Cloud Functions that deliver personalized app notifications. WordPress decides **when** something happens; this backend decides **who** receives it and sends it with the Firebase Admin SDK.

```
App ──JWT──▶ WordPress (/wp-json/ttn/v1/push/*) ──signed webhook──▶ wordpressEvents ──FCM──▶ user's devices
                  booking paid / changed / cancelled ─┘                sendBookingReminders (every minute)
```

- Booking/account messages never use FCM topics; each targets one WordPress user's registered devices (max 10 per user). The only topic is `public-content`, used for silent, non-personal content refresh signals (see below).
- Notification types: `booking_confirmed`, `booking_rescheduled`, `booking_cancelled`, `booking_reminder_15m`, `admin_message`, `marketing`.
- Android channels: `ttn-bookings` (high), `ttn-account`, `ttn-marketing` (opt-in only).
- Preferences: `booking_updates` and `booking_reminders` default on, `marketing` defaults off. Admin messages to one customer always arrive.
- Push is independent of Kisi door access and never carries access secrets.

## On-device notification history

The Home bell opens the app's Notifications screen. It has no badge when all saved
notifications are read, a red dot for one unread notification, and a numbered red
bubble for two or more (capped visually at `99+`). Opening an item or a push marks
that item read; **Mark all as read** clears the unread count without deleting history.

The app keeps the latest 100 notifications on that phone, separately for each
signed-in account and guests. Foreground messages and tapped pushes are saved.
Android also saves notification payloads through an entry-point background handler;
data-only messages are not processed. On launch and foregrounding, notifications
still in the system tray with usable delivery metadata are imported as well.
Android notifications predating the handler without delivery IDs cannot be imported
until tapped. Signing out clears the tray along with releasing the device
token, so another account does not import the previous account's notifications.
History survives app restarts, but is not a server inbox or a cross-device archive.
Notifications dismissed while the app was closed before it could save them cannot
be recovered (in particular on iOS, where background execution is not guaranteed).
Foreground storage/import errors appear with a retry action; background storage
failures are logged without notification contents. Rebuild/release the app so the
new custom Expo Router entry point runs in production.

Run `node --test tests/notification-history.test.mjs tests/notification-routes.test.mjs tests/push-notifications.test.mjs tests/typography.test.mjs`,
lint and typecheck. On physical iOS and Android devices, verify foreground receipt,
background/quit delivery and tapping, tray import on reopening, duplicate handling,
restart persistence, unread badges, mark-all-read, and sign-out/account isolation.
This app-only change does not require a Cloud Functions deployment.

## Refreshing app content (public content cache)

The app caches public website content (home, hours, competitions, bays, time slots, membership packages) until you publish a new content version. To make every app download fresh content:

1. Firebase Console > Firestore Database > collection `appConfig` > document `publicContent` (create it the first time).
2. Set field `version` to a new value: a whole number (`1`, `2`, ...) or a short token of letters/numbers/`. _ : -` such as `2026-11-01.1`. Changing other fields does nothing.

`publicContentChanged` (Firestore trigger) then sends one silent data-only message `{type: "content_refresh", version}` to topic `public-content` (Android high priority; APNs `apns-push-type: background`, priority 5, `content-available`). It shows nothing on the device and is not added to notification history. It is sent regardless of `NOTIFY_MODE` because it carries no personal data. Invalid versions are logged and ignored.

`publicContentVersion` (public `GET`, `Cache-Control: no-store`) returns `{"version": "<value>" | null}`. Apps call it on launch and when foregrounded, so phones that missed the silent push (iOS throttles background pushes; force-stopped Android apps receive nothing) still refresh. Apps keep showing cached content while refreshing, and keep it if the refresh fails.

Purge any WordPress/CDN cache for the changed pages first; the app requests with `cache: 'no-store'`, but a CDN can still serve an old response.

### Automatic refresh after a release

`npm run release` requires a clean `main` branch (including no untracked files) and
runs `git pull --ff-only origin main` before displaying versions. Merge your intended
changes into main first. A wrong branch, dirty worktree, failed/diverged pull, or
existing local release branch stops the script; it never silently continues with stale main
or reuses a release branch.

It displays the local app/package versions and the Firebase content
version, then asks for the next app version (for example, `1.2.0`). You can also
pass it directly with `npm run release -- 1.2.0`; current versions are still shown.
The Firebase version is a content cache revision, not the published App Store version.
Reading versions makes no changes; unavailable Firebase access stops the release.
Use `npm run content:publish -- --show` to read only the Firebase content version.

The release script offers a TestFlight build. If accepted, it runs
`scripts/testflight-release.sh`: check Firebase read access, wait for one successful
iOS build, submit that exact build and wait for submission success, then merge a
unique `version` into `tee-time-nexus/appConfig/publicContent` and verify it.
Values look like `1.2.0-20261022T001500000Z-a1b2c3d4`; repeated releases remain unique.
Other document fields are preserved. Failed/skipped builds or failed submissions
do not publish a content version. Submission success is upload to App Store Connect,
not Apple approval or public availability. The refresh affects all compatible
installations, not just TestFlight testers.
The wrapper uses `npx --yes` so EAS CLI installation cannot block on a confirmation
prompt hidden in the captured build JSON output.

One-time local authentication uses Google Application Default Credentials (ADC):

```sh
gcloud auth application-default login
gcloud auth application-default set-quota-project tee-time-nexus
npm run content:publish -- --check
```

The Google Cloud CLI (`gcloud`) must be installed first. `firebase login` and EAS login
are separate from ADC. Use an authorized Google account with Firestore document
read/write permissions (for example, the `roles/datastore.user` role) and permission
to use the quota project. The preflight only checks reads; a missing write permission
will fail explicitly at publishing. CI should use workload identity/ADC instead of
checked-in service-account keys. Never place credentials in app configuration or source.

After publishing website changes and purging its cache, you can also run:

```sh
npm run content:publish -- 1.2.0
```

This sends a refresh without building the app. If publishing fails after submission,
fix authentication/permissions and retry just this command, not the build.
The existing `npm run testflight` command remains build/auto-submit only;
automatic content publishing is wired to the release script's build option.

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

The deploy also creates `publicContentChanged` (Firestore trigger; Firebase may ask to enable Eventarc on the first deploy) and `publicContentVersion`. The app's default version URL is `https://us-east1-tee-time-nexus.cloudfunctions.net/publicContentVersion`; set `EXPO_PUBLIC_CONTENT_VERSION_URL` if the deploy prints a different URL. Content-refresh topic delivery requires the rebuilt app.

## Verify, in this order

1. **One test device.** Sign in to the app on a physical phone as an allowlisted user and enable notifications (Settings → Manage Notifications). WordPress → Bookings Manager → **App Notifications** → send to that user's email. The result should say `Sent to 1 device(s)`. "Not on the Firebase test allowlist" means `TEST_WP_USER_IDS` needs the ID and a redeploy.
2. **Booking events.** As the same user, book and pay → "Booking confirmed". Change the time → "Booking updated". Cancel → "Booking cancelled".
3. **Reminder.** Book a slot starting 20–30 minutes from now; the reminder arrives 15 minutes before start (within about a minute). Bookings made less than 15 minutes ahead skip the reminder.
4. **Preferences.** Turn off Booking updates in the app and repeat step 2: nothing arrives, while an admin message still does.
5. **Content refresh.** `curl https://us-east1-tee-time-nexus.cloudfunctions.net/publicContentVersion` returns `{"version":null}` before the document exists. Change a website Hours line, purge the site cache, then set `appConfig/publicContent.version` to `1`: the open Hours screen updates within seconds with no visible notification, and the curl returns `{"version":"1"}`.

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
