This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Website home content

### Header branding

- Launcher icons and the web favicon use the supplied Tee Time Nexus site-icon artwork. `assets/icon.png` is an opaque 1024-by-1024 export (the supplied source is 512-by-512); Android's foreground is padded to fit adaptive masks over a black background. The old Android background and monochrome assets are removed. Icon changes require native regeneration and a rebuild, not just Metro reload. The header wordmark and splash artwork remain separate and unchanged.
- Splash artwork uses the supplied branded Golden Hour image in `assets/teetimenexusspashscreen.png` (768-by-1365), replacing the unbranded course background. The existing splash plugin configuration is retained; rebuild the native app to pick up the image change.
- Shared headers use `assets/tee-time-nexus-header-logo.png`, a 384-by-80 crop of the original `assets/tee-time-nexus-text-logo.png` (crop origin: x=22, y=14). It preserves the exact white/green lettering and NEXUS divider lines, omits the tiny tagline, and displays at 168 points wide with proportional shrinking on narrow headers. Keep the original logo unchanged.

### Text readability

- Paragraphs and descriptions use `colors.text` (`#F5F5F5`), 17-point medium-weight (`500`) text with 26-point line height. Secondary labels use `colors.muted` (`#E0E0E0`); headings remain white.
- Keep the default platform system font and OS text scaling. Explicit text sizes are at least 14 points for small labels/hints and 16 points for form inputs; larger headings are unchanged. Increase associated line heights when increasing font sizes. Booking progress scrolls horizontally rather than shrinking or truncating its seven labels, and booking options wrap. Run `node --test tests/typography.test.mjs` for the minimum-size contract.
- Shared screens use 32-point section gaps and 24-point outer padding. Section cards use 24-point padding and 16-point child gaps; compact technology cards use 16-point padding and 10-point child gaps. Account forms rely on card gaps instead of stacked bottom margins. Keep technology grid widths in sync with their 16-point gutter.

### Mobile navigation

- Reservation lists use the stable WordPress account ID (`ttn_booking_user_id`), not a mutable login/contact email. Ownerless legacy records retain a case-insensitive email fallback; matching email must never override another account's owner ID. Apple relay-to-verified-email changes therefore preserve account-owned reservations and website edit/cancel authorization. Deploy bookings plugin `tee-time-nexus-bookings.php`, `inc/class-ttn-mobile-booking-api.php`, and theme `front-page.php`, `page-account.php`, and `page-my-bookings.php` together. Run theme `php tests/booking-ownership.php`. Ownerless records with an old relay email require support to verify and associate ownership; never infer ownership from a user-supplied previous email.

- Booking date limits come from uncached authenticated `/wp-json/ttn/v1/member/time-slots` on focus, alongside the user's allowed time slots. The website enforces non-member/PAR 7-day, BIRDIE 14-day, and ALBATROSS 21-day windows; active paid membership is required. The calendar uses the website's today/max dates, not a mobile tier map, and shows an explicit retryable error if rules cannot load. Deploy bookings plugin `tee-time-nexus-bookings.php` and `inc/class-ttn-mobile-booking-api.php` together before shipping the mobile update. Run `node --test tests/booking-rules.test.mjs` and theme `php tests/mobile-booking-window.php`.
- Booking setup uses side-by-side text-only Right-Handed and Dual-Handed cards, with centered descriptions and always-green borders. Selection uses a stronger surface background. No setup thumbnails are loaded. Keep the existing booking selection/filter identifiers unchanged.
- Actual bay choices use one full-width card per row, with numbered details over the thumbnail on a 65%-opaque black overlay. Cards have a compact 140-point minimum height and grow for wrapping/scaled text. Reservation cards share that presentation; bay names wrap rather than truncate.

- The login form always offers Forgot password, including after invalid credentials. It opens the configured website's existing `/wp-login.php?action=lostpassword` flow in an in-app browser; no credentials are included in the URL. Users follow the emailed reset instructions and return to the app to log in. Run `node --test tests/password-reset.test.mjs`.
- The bottom bar contains Booking, Membership, and a hamburger Menu. The menu sheet includes Home and Profile cards; Profile opens `/account` for signed-in profile or guest login/signup. The previous reservations menu link remains removed. Signed-in users manage notifications through Profile > Settings > Manage Notifications; `/settings` waits for session restoration and redirects guests to `/account`. The guest account screen retains its notification-settings shortcut.
- Menu opens a dark/green bottom sheet with a two-column grid: Profile and Leagues & Tournaments on the first row, Membership and Home on the bottom row (Home on the right). The combined competition card opens `/competitions` with all events; Contact Us and Features are omitted. Membership is intentionally also available in the bottom bar. Booking is not duplicated in the sheet. The old secondary link list is removed. The sheet dismisses via backdrop, close button, Android back, or the Menu toggle; selecting a native destination closes it and navigates normally. The original bottom bar remains mounted and usable, with the sheet positioned above its measured height including the safe area. There is no `/menu` screen or modal navigation transition. Experience remains removed.
- Booking review and reservation details link to the website booking page's Terms and Conditions control for the current booking, cancellation, and refund policy. The website currently exposes the terms in a modal, so users must tap that control after opening the link. No separate policy text or refund calculations are maintained in mobile. Mobile cancellation/rescheduling still requires support; this does not implement the website's self-service cancellation flow.
- Bottom navigation respects the bottom safe area, including the door-access modal. Run `node --test tests/navigation-menu.test.mjs` to verify destinations and guest/member menu visibility.
- The bottom Menu button toggles local sheet visibility without changing the current route. Booking and Membership close the sheet before navigating. The door-access modal uses the same sheet; choosing a native destination also closes door access.
- The sheet stays mounted and animates its slide and backdrop opacity with the native Animated driver (280 ms opening, 220 ms closing). Closed sheet content ignores touches and is hidden from accessibility. Bottom-bar indicator space remains reserved so toggling Menu does not change its height.
- Hours & Access opens native `/hours` and loads public `GET /wp-json/ttn/v1/hours` on focus. The website's `page-hours.php` and the feed share `inc/hours-content.php`; update that shared source for website/mobile copy changes. Deploy `functions.php`, `inc/hours-content.php`, and `page-hours.php` together before release. No WebView or scraped HTML is used; unavailable/malformed content shows an explicit retryable error, and failed refreshes retain prior content with a warning. Member access remains 24/7; public hours remain 10 AM to 10 PM. Run `node --test tests/hours-content.test.mjs tests/navigation-menu.test.mjs` and theme `php tests/mobile-hours-content.php`.

- The guest home page loads `GET /wp-json/ttn/v1/home` from `EXPO_PUBLIC_API_URL` (default: `https://teetimenexus.com`) on each focus. The signed-in dashboard is unchanged.
- The WordPress theme's `inc/home-content.php` shares the three slide and six technology-panel settings/defaults with `front-page.php`. Deploy that file, `functions.php`, and `front-page.php` together to the active `golf-simulator-theme` before releasing the mobile update.
- Edit images, media URLs, titles, and descriptions in the existing WordPress Customizer. No mobile release is needed for content updates. The feed includes native booking/membership routes for the website's two hero actions.
- Hero content is presented as swipeable native cards with a next-card peek, snap scrolling, and tappable pagination. There are no desktop arrows or timed autoplay; images sit above the text, and card height grows with the content and text size.
- Images/GIFs use `expo-image`; GIF animations and videos play on tap, with only one media modal open at a time. Rebuild the development client after installing the new native modules.
- An unavailable or malformed feed shows an explicit error and retry action rather than substituted marketing content. A failed refresh retains previously loaded panels with a notice.
- Run content contract tests with `node --test tests/home-content.test.mjs`.
- In the theme directory, run `php tests/home-content.php` to verify setting overrides, media classification, the public route, and guest-page rendering without a WordPress database.

### Technology content

- The dedicated Experience screen, `/technology` route, and technology feed client are removed from mobile. The website's Experience page is unchanged.
- Home's six technology panels and their shared native media behavior remain available through the home feed. Run `node --test tests/navigation-menu.test.mjs tests/home-content.test.mjs` for regression coverage.
- Features opens native `/features`, using the same cached Home feed and its six technology panels in a two-column grid showing only media and titles, without section descriptions, card descriptions, or playback hints. Home keeps its full descriptions. It does not restore the removed Experience endpoint or screen. Media handling and explicit error/retry behavior match Home.

### Competition browsing

- Leagues & Tournaments opens the native `/competitions` screen. It fetches public `GET /wp-json/ttn/v1/competitions?limit=50` from `EXPO_PUBLIC_API_URL`, validates the response, and opens each event's website detail page in the system browser. Registration and payments are not implemented in this release.
- Deploy and activate `wp-content/plugins/tee-time-nexus-competitions` before releasing the app screen. Registration is web-based: players sign in to the site and complete paid registration through the existing WooCommerce checkout; the mobile app does not collect card details. In WordPress, use Golf Competitions > Create Missing Listing Pages, then add those pages to the primary menu if desired. Create and publish competitions with a future start date and a League or Tournament type.
- Feed failures and malformed responses show a retryable error instead of placeholder events. Run `node --test tests/competitions-content.test.mjs tests/navigation-menu.test.mjs` for feed and navigation contract coverage.

## Building with EAS

### Kisi door access

- For account-only early-access testing, optionally define `TTN_KISI_TEST_ACCESS_EMAIL` on the WordPress server as the intended account's current email. This switch remains enabled until removed; it bypasses only the start-time restriction, not ownership, active paid membership, booking/payment status, expiry, or reader proximity. Test starts are saved once per account so refreshes keep stable Kisi validity bounds, and the API clearly labels test access. Remove the constant to restore normal timing; existing test grants are revoked on status refresh or cron reconciliation, so revoke the user's grant immediately in Kisi when ending testing rather than relying on offline propagation. Never ship a global timing bypass or put account emails in app source.

- The Kisi SDK partner ID is 1053, configured in `app.json` under `extra.kisi.partnerId`. This is a non-secret integration identifier, not an administrative API key or a user credential.
- Administrative Kisi credentials and organization/group/entrance-lock IDs stay on the hosted WordPress server. Never include the administrative key in the app, source control, logs, or chat.
- Access is for the reservation owner with an active, paid membership and a confirmed, paid parent booking, starting 15 minutes before the booking and ending at completion (exclusive). Dates use the website timezone, including overnight bookings. Non-members enter through staff during public hours. No permanent member access may bypass the booking window.
- A local Expo module in `modules/kisi-access` packages the official SecureAccess iOS framework (upstream commit `c0a8641ba04928dceeff5d9c9a0d5587572eb197`) and Android ST2U 0.16 AAR. The vendored libraries remain subject to Kisi's licensing/partner terms; the wrapper's license does not relicense them. Native regeneration/autolinking includes them without manually patching generated projects.
- `initializeKisi` takes a server-issued, restricted per-user device login, organization ID, and booking window expressed as Unix milliseconds. Credentials are held in memory, rejected outside the window or for another organization, and cleared on logout. This local check supplements rather than replaces Kisi-side permission expiry. The SDK does not initialize automatically, persist device credentials, or restore them after a killed-app launch yet.
- Deploy bookings plugin `tee-time-nexus-bookings.php`, `inc/class-ttn-kisi-access.php`, and existing `inc/class-ttn-kisi-connection.php`, plus theme `inc/membership.php` together. Plugin includes are git-ignored; upload them explicitly. Server configuration constants are `TTN_KISI_API_KEY`, `TTN_KISI_ORGANIZATION_ID`, `TTN_KISI_BOOKING_GROUP_ID`, and `TTN_KISI_ENTRANCE_LOCK_ID`. The dedicated group must contain only the entrance, with Reader proximity restriction and Allow app access enabled and Reader tap to access restriction disabled (the latter would block the in-app fallback). Provisioning validates those settings. App-managed users must have no additional or team-based door permissions.
- Authenticated, uncached `GET /wp-json/ttn/v1/door-access?booking_id=ID` reports eligibility; explicit `POST /wp-json/ttn/v1/door-access/credentials` creates a managed user, Kisi-native bounded `group_basic` role, and restricted member device login. Only the currently selected, eligible booking is granted, never a min/max range spanning separate bookings. Existing external Kisi accounts/permissions fail explicitly instead of being taken over. Credentials are never logged or cached publicly; provisioning attempts, including failed attempts, are limited to once per minute per account.
- Booking metadata, deletion/trashing, order-status, and membership-save hooks revoke access. Failures queue retries and show an administrator notice. Five-minute WP-Cron reconciliation is backup, not expiry authority; configure a reliable server cron. Cancellation propagation and offline-reader behavior require physical tests; do not promise immediate offline revocation.
- Booking Details shows the Access card and door-access modal only when `/membership/current` reports an active, paid membership; it rechecks on focus and stays hidden while loading or after errors. The server still enforces eligibility.
- Door Access receives the real reservation ID; fake codes/countdowns are removed. Tap to Unlock uses the native SDK. Open Door reads a fresh entrance-reader proximity proof and uses the restricted member login directly with Kisi after rechecking website eligibility. No admin unlock or GPS bypass is used. Bluetooth and reader permissions are requested only after Enable Door Access. Rebuild native apps for the bridge and iOS location description; Expo Go/web/old builds fail explicitly.
- This initial flow is foreground-only: keep Door Access open. Closing it, backgrounding, logout, expiry, or a failed eligibility refresh clears native credentials. Re-enable after returning; killed-app and locked-phone restoration are not implemented. Do not supply administrative credentials to `initializeKisi`.
- Run `node --test tests/door-access.test.mjs tests/kisi-sdk.test.mjs tests/navigation-menu.test.mjs tests/typography.test.mjs`, lint, typecheck, and both native bridge builds. In the theme directory run `php tests/kisi-access.php` and `php tests/kisi-connection.php`. If native PHP is missing, `npm exec --yes --package=@php-wasm/cli -- php-wasm-cli tests/kisi-access.php` runs locally. Before release, test a physical Pro 2 reader, eligible/ineligible windows, cancellation, membership deactivation, proximity rejection, and denied permissions.
- The bookings plugin offers administrator-only Bookings Manager > Kisi Connection. Deploy `tee-time-nexus-bookings.php` and `inc/class-ttn-kisi-connection.php` together. The nonce-protected test reads the configured lock using the server-only API key, without unlocking, following redirects, or exposing response bodies/credentials. Run theme `php tests/kisi-connection.php`; HTTP 200 validates API authentication and lock lookup only, not SDK or booking access.

### Membership browsing and checkout

- EAGLE is the display name of the existing ALBATROSS tier. Keep the `albatross` checkout/product key, prices, and 21-day booking benefit unchanged. Current membership returns `package_name` for display and `package_key` for identity; older responses are normalized in mobile without exposing unsupported controls.
- Membership and Profile refresh uncached account status on focus. Native Change Plan uses authenticated `POST /wp-json/ttn/v1/membership/manage` with the current server revision. Upgrades use server-calculated prorated WooCommerce checkout and preserve the current paid-period end; failed/abandoned checkout never activates an upgrade. Cancelling and downgrading are scheduled for the verified paid-period end and can be undone beforehand. Current benefits remain until then. A downgraded tier becomes pending and requires a new payment; these are one-time WooCommerce products, not automatic subscription billing, and no automatic refund is issued.
- Deploy theme `inc/membership.php`, new `inc/membership-management.php`, `inc/mobile-membership-api.php`, and `page-account.php`, plus bookings plugin `inc/class-ttn-kisi-access.php` together. Scheduled changes use WP-Cron with retry and are also applied on membership reads if cron is late. Configure reliable hosted cron. Unknown/past paid-period dates fail explicitly and need support verification; do not infer a new paid period. Scheduled changes cap new Kisi grants and reconcile previously longer grants; offline revocation propagation remains a limitation.
- Run `node --test tests/membership-management.test.mjs tests/booking-rules.test.mjs tests/door-access.test.mjs`, plus theme `php tests/mobile-membership-management.php`, `php tests/mobile-membership-packages.php`, and `php tests/kisi-access.php`.

- Apple login passes optional given/family names along with the formatted display name. Deploy the bookings plugin's `inc/class-ttn-jwt-auth.php` and `inc/class-ttn-mobile-checkout-bridge.php` together: new Apple accounts store structured profile names, and checkout fills missing billing contact fields from profile data without replacing existing billing values. Apple may omit names on subsequent logins; missing checkout fields remain editable and use normal WooCommerce validation. No phone number is supplied by Apple.

- Membership cards load from `/wp-json/ttn/v1/membership/packages`; no login or account form is required to browse. Guests enter account details in a bottom sheet only after choosing a package, then proceed through the existing guest checkout API. Signed-in checkout is unchanged.
- The feed includes optional `thumbnail_url`, resolving the matching published package's Package Thumbnail first, then its default-tier thumbnail. Deploy the theme's `inc/mobile-membership-api.php` for thumbnails to appear; older responses without the field remain supported. Pricing/features still use the existing WordPress default-tier settings.
- Membership thumbnails show the entire image without cropping in a centered, compact frame (up to 240 wide and 140 high), preserving the source aspect ratio.
- Run `php tests/mobile-membership-packages.php` in the theme directory to check thumbnail precedence, missing-image behavior, and package response compatibility.

### Firebase push notifications (iOS and Android)

- Firebase project: `tee-time-nexus`; iOS bundle ID and Android package: `com.teetimenexus.app`. The local `GoogleService-Info.plist` and `google-services.json` are git-ignored but included in EAS archives by `.easignore`. Do not add service-account keys or APNs private keys to this repository.
- RNFirebase 26 uses Swift Package Manager by default and requires dynamic iOS frameworks. Keep `expo-build-properties` configured with `useFrameworks: "dynamic"`; do not add older static-framework workarounds.
- After changing native plugins, run `npx expo prebuild --platform ios --no-install` before `pod install` or rebuilding an existing native project. A stale generated `Podfile.properties.json` without `ios.useFrameworks: "dynamic"` causes the RNFirebase SPM/static-linkage error even when app configuration is correct. Do not patch the generated Podfile; also ensure `USE_FRAMEWORKS=static` is not overriding the configured linkage.
- Direct FCM delivery uses a shared native adapter on iOS and Android. Web/Expo Go show an explicit unsupported state without initializing Firebase. Android creates `ttn-bookings` (confirmations, changes, reminders), `ttn-account` (admin messages) and `ttn-marketing` (opt-in offers) before requesting permissions; their IDs must match `ANDROID_CHANNELS` in `functions/src/messages.ts`. `ttn-updates` remains the manifest default channel for Firebase Console test messages.
- Open Profile > Settings > Manage Notifications (also available directly on the guest account screen), tap Enable Notifications, and use Show Test Token for Firebase Console > Messaging > Send test message. Open Device Settings lets users change permissions or disable notifications after enabling them. Permission is never requested automatically. Tokens are never logged; signed-in devices are linked to the WordPress account through `POST /wp-json/ttn/v1/push/devices` and released (server unregister plus FCM `deleteToken`) before sign-out clears the session. The same screen shows Booking updates / Booking reminders / Offers and news toggles stored by the backend; offers default off and account messages always arrive.
- On first Home launch with undetermined permission, an explanation card offers Enable Notifications or Not Now. Only Enable triggers the OS prompt; either choice is remembered in SecureStore. The guest launch-signup popup waits until this choice is resolved, and already-authorized/denied/unsupported devices skip the explanation. SecureStore preferences may survive reinstalls on iOS.
- Upload an Apple APNs authentication key to Firebase Project Settings > Cloud Messaging, enable Push Notifications for the Apple bundle ID, and rebuild/sign the app with a compatible provisioning profile. Expo Go and an old development client cannot run the Firebase native modules; verify delivery on a physical iPhone.
- Notification payloads display through APNs/FCM while backgrounded/quit (Android force-stop must be followed by manually reopening the app). Foreground messages use an in-app alert. Optional FCM custom data `route` is restricted to `/`, `/book`, `/membership`, `/reservations`, `/account`, or `/notifications`. Missing/unsupported routes open Home. Data-only background processing is not implemented. Personalized delivery is described below.
- Token refreshes and app foregrounding recheck permission and the current FCM token. Disabled permission clears the displayed token; device settings control opt-out. Errors are shown in the notification settings and a visible app notice.
- On iOS Simulator, permission can be granted but RNFirebase skips APNs registration. Settings show a neutral physical-iPhone notice rather than attempting token registration. Real-device token failures preserve the granted permission status and surface a separate connection error.
- Personalized delivery: WordPress (`inc/class-ttn-push-notifications.php` in the bookings plugin) signs events with `TTN_NOTIFY_WEBHOOK_SECRET` and posts them to the `wordpressEvents` Cloud Function in `functions/`. Firebase owns tokens, preferences, delivery and the every-minute 15-minute-reminder scheduler. No FCM topics are used; every booking message targets one user's devices. While `NOTIFY_MODE` is not `live`, only WordPress user IDs in `TEST_WP_USER_IDS` receive anything. See `functions/README.md` for setup, deployment and the wire format. The app and website never hold Firebase service-account credentials; push is independent of Kisi door access and payloads carry no access secrets.
- Run `node --test tests/notification-routes.test.mjs tests/push-notifications.test.mjs` along with lint and typecheck; run `npm test` in `functions/` after backend changes. Complete a device test for foreground/background/quit delivery, tapping notifications, denied permissions, and reinstall/token changes before release.

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
