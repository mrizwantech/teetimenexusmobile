#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: bash scripts/testflight-release.sh <version>}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || [ "${#VERSION}" -gt 24 ]; then
  echo "Error: Provide a release version such as 1.2.0 (at most 24 characters)."
  exit 1
fi
node functions/scripts/publish-content-version.mjs --check

BUILD_RESULT=$(mktemp)
trap 'rm -f "$BUILD_RESULT"' EXIT

echo "Building iOS release ${VERSION}; waiting for the completed build..."
npx eas-cli@latest build --platform ios --profile production --wait --json > "$BUILD_RESULT"
BUILD_ID=$(node -e '
const fs = require("node:fs");
const builds = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!Array.isArray(builds) || builds.length !== 1 || builds[0].status !== "FINISHED" ||
    builds[0].platform !== "IOS" || typeof builds[0].id !== "string" || !builds[0].id) {
  throw new Error("Expected exactly one successfully finished iOS build; content version was not changed.");
}
console.log(builds[0].id);
' "$BUILD_RESULT")

echo "Submitting build ${BUILD_ID}; waiting for successful submission..."
npx eas-cli@latest submit --platform ios --profile production --id "$BUILD_ID" --wait

echo "Build and submission succeeded. Refreshing public content for all compatible installations..."
if ! node functions/scripts/publish-content-version.mjs "$VERSION"; then
  echo "The app was submitted, but content refresh failed. Do not rebuild just to retry."
  echo "After fixing Firebase access, run: npm run content:publish -- ${VERSION}"
  exit 1
fi
