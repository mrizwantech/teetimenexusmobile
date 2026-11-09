# Release Notes - v1.1.0

## What's New in This Release (v1.1.0)
- **Apple Sign-In & Passkeys**: Fast, secure biometric authentication using Touch ID / Face ID passkeys and Apple ID.
- **Enhanced Booking Experience**:
  - Live bay availability validation.
  - Calendar export support (Apple Calendar on iOS & Google Calendar).
  - Robust handling for competing checkouts and instant refund notice if tee time is taken.
- **Push Notifications**: Firebase Cloud Messaging (FCM) integration with granular permission controls in Settings.
- **Kisi Door Access**: Secure Bluetooth and proximity-based facility access for eligible members.
- **Leagues & Tournaments**: Native browsing for upcoming competitions and club events.
- **UI & UX Refinements**: High-contrast text readability, responsive layouts, and bug fixes across account & checkout flows.

## What to Test in TestFlight
1. **Booking & Competing Checkout**: Reserve a bay, verify calendar export (Apple & Google), and test edge cases.
2. **Authentication**: Sign in with Apple and set up device passkeys.
3. **Door Access (Kisi)**: Verify proximity reader detection on eligible member profiles.
4. **Push Notifications**: Verify opt-in prompt and toggling in Profile > Settings.
5. **Leagues & Tournaments**: Browse events and open external registration links.

## Comparison: v1.0.0 vs v1.1.0
| Feature | v1.0.0 (Initial) | v1.1.0 (Current) |
|---|---|---|
| **Authentication** | Standard email & password | Added Sign in with Apple & Passkeys |
| **Calendar Integration** | None | Apple Calendar (native) & Google Calendar URL |
| **Notifications** | Not configured | Firebase FCM push notifications & settings |
| **Facility Access** | None | Native Kisi SDK integration for door unlocking |
| **Competitions** | Not available | Native Leagues & Tournaments feed |
| **Checkout Resilience** | Basic webview checkout | Competing checkout conflict handling & slot auto-recovery |

## Android follow-up (requires a new native release)

- Booking date selection no longer schedules a delayed animated scroll into the next options. Step controls remount on forward/Back transitions to avoid retaining pressed state; completed selections remain editable.
- Reservation Directions offers Apple Maps (iOS), Google Maps, and Waze rather than always launching Apple Maps. Each targets the same venue address as calendar events; unavailable apps offer an explicit browser action and launch errors are visible.
- Directions remembers the last successfully opened maps app on this device across restarts. Use Change maps app on reservation details to switch; Cancel and failed launches preserve the previous choice. Native preferences use SecureStore; web uses local storage. Storage errors are displayed rather than silently losing the selection.
- Android allows rotation and resizable windows, including tablets, foldables, and split-screen. The Android config plugin overrides the shared portrait setting; iOS orientation is unchanged.
- Screens, checkout, navigation, and the menu respect landscape cutouts and system insets. Media dialogs scroll in short windows.
- Release builds retain R8 minification, resource shrinking, and optimizing ProGuard defaults. Do not remove library keep rules needed for JNI or reflection merely to raise a score.
- After building, run `npm run android:verify-release -- /path/to/app-release.aab` on the **exact AAB to upload**. This requires `unzip`, reads bundled R8 metadata, and fails if any of optimization, shrinking, or obfuscation is below 25%, disabled, or missing. A class-renaming count is not the Play score.
- For an existing native Android project, regenerate with `npx expo prebuild --platform android --no-install`, then build using `npx eas-cli@latest build --platform android --profile production`. Download and verify that build's AAB before uploading it. An OTA update cannot apply these native changes.
- SDK 57 already uses edge-to-edge. Keep status-bar styling limited to icon appearance rather than legacy color/translucency parameters. Expo/React Native and AndroidX still include backward-compatible window APIs; do not strip these or lower the target SDK to hide Play warnings. Any remaining warning needs the exact API/caller list from Play Console to identify the responsible dependency.
- Before release, test Android 15/16 in portrait/landscape, gesture/three-button navigation, tablet/foldable layouts, split-screen resizing, keyboard entry, checkout, and door-access/menu dialogs. Also test authentication, push, calendar, and Kisi in the minified release binary.

References: [Expo SDK 57 status bar](https://docs.expo.dev/versions/v57.0.0/sdk/status-bar/), [Android 16 large-screen changes](https://developer.android.com/about/versions/16/behavior-changes-16#large-screens), [Play DEX optimization metrics](https://developer.android.com/google/play/vitals/code-optimization).
