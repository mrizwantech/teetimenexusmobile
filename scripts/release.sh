#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Tee Time Nexus Mobile - Release Preparation & TestFlight Script
# ==============================================================================
# Usage:
#   ./scripts/release.sh [version]
# Example:
#   ./scripts/release.sh 1.1.0
# ==============================================================================

VERSION="${1:-1.1.0}"
RELEASE_BRANCH="release/v${VERSION}"
DATE=$(date +'%Y-%m-%d')

echo "=================================================="
echo " Preparing Release v${VERSION} for TestFlight"
echo "=================================================="

# 1. Check working directory status
if ! git diff --quiet || ! git diff --staged --quiet; then
  echo "Error: Working directory has uncommitted changes. Please commit or stash them first."
  git status --short
  exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: ${CURRENT_BRANCH}"

# 2. Ensure we start from an updated main branch or allow branch creation
if [ "$CURRENT_BRANCH" != "main" ]; then
  read -p "You are on '${CURRENT_BRANCH}', not 'main'. Do you want to switch to 'main' first? (y/N): " -r confirm_main
  if [[ "$confirm_main" =~ ^[Yy]$ ]]; then
    git checkout main
    git pull origin main || true
  fi
fi

# 3. Create or switch to release branch
if git show-ref --quiet --heads "${RELEASE_BRANCH}"; then
  echo "Branch '${RELEASE_BRANCH}' already exists. Switching to it..."
  git checkout "${RELEASE_BRANCH}"
else
  echo "Creating and switching to release branch '${RELEASE_BRANCH}'..."
  git checkout -b "${RELEASE_BRANCH}"
fi

# 4. Synchronize versions in configuration files
echo "Updating versions in app.json and package.json to ${VERSION}..."

# Update app.json
node -e "
const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
app.expo.version = '${VERSION}';
fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
"

# Update package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '${VERSION}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update package-lock.json if present
if [ -f "package-lock.json" ]; then
  node -e "
  const fs = require('fs');
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  lock.version = '${VERSION}';
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = '${VERSION}';
  }
  fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  "
fi

# 5. Generate / Update Release Notes
RELEASE_NOTES_FILE="RELEASE_NOTES_${VERSION}.md"
if [ ! -f "${RELEASE_NOTES_FILE}" ]; then
  echo "Creating ${RELEASE_NOTES_FILE}..."
  cat << 'EOF' > "${RELEASE_NOTES_FILE}"
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
EOF
fi

# 6. Run validations (typecheck & tests)
echo "Running typecheck and test suite..."
npx tsc --noEmit
node --test tests/*.test.mjs

echo "Typecheck and tests passed!"

# 7. Commit changes to release branch
if ! git diff --quiet || ! git diff --staged --quiet; then
  git add app.json package.json package-lock.json "${RELEASE_NOTES_FILE}"
  git commit -m "chore(release): prepare v${VERSION} [skip ci]

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  echo "Committed version bump and release notes to '${RELEASE_BRANCH}'."
else
  echo "No changes to commit (already up to date)."
fi

# 8. Push release branch to origin
echo ""
echo "--------------------------------------------------"
echo "Pushing release branch to origin..."
echo "Command: git push -u origin ${RELEASE_BRANCH}"
echo "--------------------------------------------------"
read -p "Push '${RELEASE_BRANCH}' to origin now? (y/N): " -r confirm_push
if [[ "$confirm_push" =~ ^[Yy]$ ]]; then
  git push -u origin "${RELEASE_BRANCH}"
  echo "Pushed '${RELEASE_BRANCH}' to origin."
fi

# 9. TestFlight build trigger with Expo / EAS
echo ""
echo "=================================================="
echo " Building & Submitting to TestFlight"
echo "=================================================="
echo ""
echo "You can build and submit directly to TestFlight using Expo EAS:"
echo "  Option A (Recommended one-liner):"
echo "    npx testflight"
echo "    (or: npx eas-cli build --platform ios --profile production --auto-submit)"
echo ""
echo "  Option B (Two-step process):"
echo "    1. Build IPA:   npx eas-cli build --platform ios --profile production"
echo "    2. Submit IPA:  npx eas-cli submit --platform ios"
echo ""

read -p "Do you want to trigger the TestFlight build now? (y/N): " -r trigger_build
if [[ "$trigger_build" =~ ^[Yy]$ ]]; then
  echo "Running EAS build with auto-submit to TestFlight..."
  npx eas-cli build --platform ios --profile production --auto-submit
fi

echo ""
echo "=================================================="
echo " Next Steps for Pull Request to Main"
echo "=================================================="
echo ""
echo "Since direct pushes to 'main' are restricted:"
echo "1. Create a Pull Request on GitHub:"
echo "   Branch: ${RELEASE_BRANCH} -> main"
echo "   Title:  Release v${VERSION}"
echo "   Notes:  Use ${RELEASE_NOTES_FILE}"
echo ""
echo "2. Once PR is approved and merged into 'main':"
echo "   git checkout main"
echo "   git pull origin main"
echo "   git tag -a v${VERSION} -m 'Release v${VERSION}'"
echo "   git push origin v${VERSION}"
echo "=================================================="

