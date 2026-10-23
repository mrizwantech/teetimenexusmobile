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
