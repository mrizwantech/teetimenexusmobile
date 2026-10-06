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

- The guest home page loads `GET /wp-json/ttn/v1/home` from `EXPO_PUBLIC_API_URL` (default: `https://teetimenexus.com`) on each focus. The signed-in dashboard is unchanged.
- The WordPress theme's `inc/home-content.php` shares the three slide and six technology-panel settings/defaults with `front-page.php`. Deploy that file, `functions.php`, and `front-page.php` together to the active `golf-simulator-theme` before releasing the mobile update.
- Edit images, media URLs, titles, and descriptions in the existing WordPress Customizer. No mobile release is needed for content updates. The feed includes native booking/membership routes for the website's two hero actions.
- Hero content is presented as swipeable native cards with a next-card peek, snap scrolling, and tappable pagination. There are no desktop arrows or timed autoplay; images sit above the text, and card height grows with the content and text size.
- Images/GIFs use `expo-image`; GIF animations and videos play on tap, with only one media modal open at a time. Rebuild the development client after installing the new native modules.
- An unavailable or malformed feed shows an explicit error and retry action rather than substituted marketing content. A failed refresh retains previously loaded panels with a notice.
- Run content contract tests with `node --test tests/home-content.test.mjs`.
- In the theme directory, run `php tests/home-content.php` to verify setting overrides, media classification, the public route, and guest-page rendering without a WordPress database.

## Building with EAS

### Firebase push notifications (iOS and Android)

- Firebase project: `tee-time-nexus`; iOS bundle ID and Android package: `com.teetimenexus.app`. The local `GoogleService-Info.plist` and `google-services.json` are git-ignored but included in EAS archives by `.easignore`. Do not add service-account keys or APNs private keys to this repository.
- RNFirebase 26 uses Swift Package Manager by default and requires dynamic iOS frameworks. Keep `expo-build-properties` configured with `useFrameworks: "dynamic"`; do not add older static-framework workarounds.
- After changing native plugins, run `npx expo prebuild --platform ios --no-install` before `pod install` or rebuilding an existing native project. A stale generated `Podfile.properties.json` without `ios.useFrameworks: "dynamic"` causes the RNFirebase SPM/static-linkage error even when app configuration is correct. Do not patch the generated Podfile; also ensure `USE_FRAMEWORKS=static` is not overriding the configured linkage.
- Direct FCM delivery uses a shared native adapter on iOS and Android. Web/Expo Go show an explicit unsupported state without initializing Firebase. Android creates `ttn-updates` before requesting notification permissions; this is also the default FCM channel configured in the manifest. Use that channel ID for Firebase Console campaigns or FCM HTTP v1 payloads when specifying a channel.
- Open Profile > Notifications (also available on the guest account screen), tap Enable Notifications, and use Show Test Token for Firebase Console > Messaging > Send test message. Permission is never requested automatically. Tokens are not logged or stored against WordPress users.
- On first Home launch with undetermined permission, an explanation card offers Enable Notifications or Not Now. Only Enable triggers the OS prompt; either choice is remembered in SecureStore. The guest launch-signup popup waits until this choice is resolved, and already-authorized/denied/unsupported devices skip the explanation. SecureStore preferences may survive reinstalls on iOS.
- Upload an Apple APNs authentication key to Firebase Project Settings > Cloud Messaging, enable Push Notifications for the Apple bundle ID, and rebuild/sign the app with a compatible provisioning profile. Expo Go and an old development client cannot run the Firebase native modules; verify delivery on a physical iPhone.
- Notification payloads display through APNs/FCM while backgrounded/quit (Android force-stop must be followed by manually reopening the app). Foreground messages use an in-app alert. Optional FCM custom data `route` is restricted to `/`, `/book`, `/membership`, `/reservations`, `/account`, or `/notifications`. Missing/unsupported routes open Home. Data-only background processing and personalized server delivery are not implemented.
- Token refreshes and app foregrounding recheck permission and the current FCM token. Disabled permission clears the displayed token; device settings control opt-out. Errors are shown in the notification settings and a visible app notice.
- On iOS Simulator, permission can be granted but RNFirebase skips APNs registration. Settings show a neutral physical-iPhone notice rather than attempting token registration. Real-device token failures preserve the granted permission status and surface a separate connection error.
- Run `node --test tests/notification-routes.test.mjs` along with lint and typecheck. Complete a device test for foreground/background/quit delivery, tapping notifications, denied permissions, and reinstall/token changes before release.

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
