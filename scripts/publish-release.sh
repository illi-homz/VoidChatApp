#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  error "Not inside a git repository"
fi

if ! git diff --quiet; then
  error "Working directory is not clean. Commit or stash changes first."
fi

# ── Load .env if present ─────────────────────────────────────────────
if [ -f "$ROOT/.env" ]; then
  set -a
  . "$ROOT/.env"
  set +a
  info "Loaded .env file"
fi

# ── Step 1: Check gh CLI ─────────────────────────────────────────────
if ! command -v gh &> /dev/null; then
  warn "GitHub CLI (gh) is not installed."
  warn "Install it with: brew install gh"
  warn "Then authenticate: gh auth login"
  exit 1
fi

# ── Step 2: Check env vars ───────────────────────────────────────────
MISSING_ENV=0
for VAR in ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_PASSWORD ANDROID_KEY_ALIAS TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID; do
  if [ -z "${!VAR:-}" ]; then
    warn "Missing env var: $VAR"
    MISSING_ENV=1
  fi
done
if [ "$MISSING_ENV" -eq 1 ]; then
  warn "Set missing vars and re-run. Continuing anyway (build may fail)..."
fi

# ── Step 3: Read version from package.json ───────────────────────────
VERSION="$(node -e "console.log(require('./package.json').version)")"
info "Version from package.json: v$VERSION"

# ── Step 4: Check git tag ────────────────────────────────────────────
TAG="v$VERSION"
if ! git rev-parse "$TAG" > /dev/null 2>&1; then
  error "Tag $TAG does not exist. Run 'npm run release:patch' (or :minor/:major) first."
fi
info "Git tag $TAG exists"

# ── Step 5: Copy keystore ────────────────────────────────────────────
KEYSTORE_SRC="/Users/mac/keystores/VoidChatApp-upload-keystore.jks"
KEYSTORE_DST="$ROOT/android/app/release.keystore"
if [ ! -f "$KEYSTORE_DST" ]; then
  if [ ! -f "$KEYSTORE_SRC" ]; then
    error "Keystore not found at $KEYSTORE_SRC"
  fi
  cp "$KEYSTORE_SRC" "$KEYSTORE_DST"
  info "Keystore copied to $KEYSTORE_DST"
else
  info "Keystore already in place"
fi

# ── Step 6: Build APK ────────────────────────────────────────────────
info "Building APK (arm64-v8a)..."
cd "$ROOT/android"
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
info "APK build complete"

# ── Step 7: Locate APK ───────────────────────────────────────────────
APK=$(find "$ROOT/android/app/build/outputs" -name "VoidChatApp-*.apk" -type f | head -1)
if [ -z "$APK" ]; then
  error "APK not found after build"
fi
APK_NAME="$(basename "$APK")"
info "APK at: $APK"

# ── Step 8: GitHub Release ───────────────────────────────────────────
cd "$ROOT"
if gh release view "$TAG" > /dev/null 2>&1; then
  info "Release $TAG already exists — uploading APK"
  gh release upload "$TAG" "$APK" --clobber
else
  info "Creating GitHub Release $TAG..."
  gh release create "$TAG" "$APK" --generate-notes
fi
info "GitHub Release ready"

# ── Step 9: Telegram notification ────────────────────────────────────
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  info "Sending Telegram notification..."

  NOTES=$(gh release view "$TAG" --json body --jq '.body' 2>/dev/null || echo "")
  if [ -n "$NOTES" ]; then
    NOTES=$(echo "$NOTES" | sed 's/\*\*\([^*]*\)\*\*/<b>\1<\/b>/g')
    if [ ${#NOTES} -gt 900 ]; then
      NOTES="${NOTES:0:900}..."
    fi
  fi

  REPO="illi-homz/VoidChatApp"

  {
    printf '<b>🚀 VoidChatApp %s released!</b>\n' "$TAG"
    printf '📦 %s\n' "$APK_NAME"
    printf '\n'
    if [ -n "$NOTES" ]; then
      printf '<b>📋 Что нового:</b>\n'
      printf '%s\n' "$NOTES"
      printf '\n'
    fi
    printf '🔗 <a href="https://github.com/%s/releases/tag/%s">Открыть релиз</a>\n' \
      "$REPO" "$TAG"
  } > /tmp/voidchat_caption.txt

  curl -s -S -X POST \
    -F "chat_id=${TELEGRAM_CHAT_ID}" \
    -F "document=@${APK}" \
    -F "caption=</tmp/voidchat_caption.txt" \
    -F "parse_mode=HTML" \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" || warn "Telegram notification failed (non-fatal)"
else
  warn "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping notification"
fi

# ── Step 10: Push tags ───────────────────────────────────────────────
info "Pushing tags..."
git push --follow-tags
info "Done! Release v$VERSION published successfully."
