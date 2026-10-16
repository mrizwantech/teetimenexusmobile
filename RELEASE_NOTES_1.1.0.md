# Release Notes — Version 1.1.0

**Target Build**: TestFlight (iOS) / Internal Release  
**Bundle ID**: `com.teetimenexus.app`  
**Expo SDK**: 57  

---

## 1. What’s New in 1.1.0

### 🔐 Authentication & Security
- **Sign in with Apple**: Native Sign in with Apple flow for iOS users with automatic credential persistence.
- **Passkeys (Touch ID / Face ID)**: Added biometrics/passkey management under `Profile > Settings > Manage Passkeys` for passwordless sign-in.
- **Lost Password Reset**: Direct in-app web browser recovery flow via `/wp-login.php?action=lostpassword`.

### 📅 Booking & Calendar Export
- **Add to Calendar**:
  - Direct export to **Apple Calendar** on iOS using native event creation (`expo-calendar`).
  - Web fallback to **Google Calendar** with pre-filled bay details, reservation date, duration, and player count.
- **Availability & Conflict Handling**:
  - Live availability check before completing booking.
  - Competing checkout detection (`booking_failed=1` / `booking_error`) with immediate alert and automated slot recovery.
  - Duration-dependent calendar selection safeguards.

### 🔔 Push Notifications
- **Firebase Cloud Messaging (FCM)**: Native push notification integration on iOS and Android.
- **Permission & Privacy Management**: Opt-in prompt flow and in-app management under `Profile > Settings > Manage Notifications`.

### 🚪 Kisi Facility Access
- **Member Door Access**: Integrated native Kisi SDK for Bluetooth & proximity-based door unlocking during reserved member hours.
- Direct status indicators and reader scanning.

### 🏆 Leagues & Tournaments
- **Competitions Directory**: Dedicated native `/competitions` screen for exploring upcoming tournaments and leagues.

### 🎨 Typography, Layout & Styling
- Readability improvements with high-contrast text (`#F5F5F5`), 17pt font sizing with 26pt line height, and responsive card padding.
- The Home slider shows one slide across the available content width on tablet layouts (600 points or wider), instead of multiple narrow panels. Phones and narrow split-screen layouts retain the next-slide preview. Swipe and pagination remain available in portrait and landscape.

---

## Android release code optimization

- Release builds enable R8 minification/obfuscation and resource shrinking through `expo-build-properties` in `app.json`. The `with-android-release-optimization` config plugin selects `proguard-android-optimize.txt` without replacing library/application keep rules. Debug builds are unchanged.
- The Kisi Android bridge explicitly includes its Luch 0.4 beacon-scanning dependency from a group-restricted JitPack repository. The vendored ST2U AAR does not declare it; R8 otherwise reports missing `aga.android.luch` classes used by reader proximity scanning.
- For an existing native project, regenerate Android with `npx expo prebuild --platform android --no-install`. EAS generates Android automatically because the native directory is excluded from its archive.
- Build a new signed production App Bundle with `npx eas-cli@latest build --platform android --profile production`. An OTA update cannot change DEX optimization.
- Before publishing, test the optimized release on a physical Android device, especially Kisi/Bluetooth access, passkeys, notifications (foreground/background/quit), and checkout.
- Inspect the downloaded bundle with `unzip -p app.aab BUNDLE-METADATA/com.android.tools/r8.json` and `unzip -l app.aab | grep -E 'r8.json|proguard.map|\.dex$'`. Retain the matching R8 mapping for crash deobfuscation; verify Play Console has the mapping after upload. If metadata is missing, inspect the build outputs before publishing.
- Verify the rebuilt version's obfuscation, shrinking, and optimization scores in Play Console against the reported 25% threshold. Enabling R8 is not proof of a particular score; dependency keep rules affect the result. Avoid blanket keep rules or disabling warnings to work around release-build failures.
- Local release-bundle validation passed with R8 metadata indicating 80.73% obfuscation, 80.31% optimization, and 80.86% shrinking eligibility (`100 - stats.no*Percentage`), all above 25%; the bundle also contains its ProGuard mapping. These are local metadata results, not confirmation from Play Console. The generated local project uses debug signing, so use the EAS production build for store submission and recheck that artifact.
- Configuration regression tests: `node --test tests/android-release-optimization.test.mjs`.

## 2. Release Comparison (v1.0.0 vs v1.1.0)

| Capability / Area | v1.0.0 (Baseline) | v1.1.0 (Current Release) |
|---|---|---|
| **Version Configuration** | `1.0.0` in `app.json` / `package.json` | `1.1.0` in `app.json` / `package.json` |
| **Authentication** | Email / Password only | Email/Password + **Sign in with Apple** + **Passkeys** |
| **Calendar Sync** | None | **Apple Calendar** (`expo-calendar`) & **Google Calendar** URL |
| **Push Notifications** | Not configured | **Firebase Cloud Messaging (FCM)** + settings UI |
| **Facility Access** | None | **Kisi Mobile SDK** for Bluetooth / proximity door access |
| **Tournaments / Leagues** | Web link only | Native `/competitions` screen & API integration |
| **Checkout Flow** | Basic web checkout redirect | Conflict/competing checkout detection & error recovery |
| **Typography & Theme** | Initial design | System text scaling, WCAG high contrast, 17pt body |

---

## 3. TestFlight “What to Test” (App Store Connect)

Copy and paste this section into the **What to Test** field in TestFlight:

```text
Please test the key updates in version 1.1.0:
1. Booking Flow: Select a bay, choose a time slot, and verify the checkout and confirmation screens.
2. Calendar Export: On the confirmation screen, tap "Apple Calendar" (iOS) and "Google Calendar" to verify event details.
3. Authentication: Test Sign in with Apple, standard email login, and setting up a passkey in Profile > Settings.
4. Notifications: Test the notification opt-in prompt and toggle settings under Profile > Settings > Notifications.
5. Door Access (Members): Test Kisi door unlocking if you have an eligible member account.
6. Leagues & Tournaments: Browse the competitions list from the navigation menu.
```
