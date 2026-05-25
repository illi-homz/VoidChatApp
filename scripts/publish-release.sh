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

# ── Step 8: Push main branch first ────────────────────────────────────
cd "$ROOT"
info "Pushing main branch..."
git push origin main

# ── Step 9: Read RELEASE_NOTES.md for Telegram (before it's deleted) ──
cd "$ROOT"
RELEASE_NOTES_FILE="$ROOT/RELEASE_NOTES.md"
NOTES=""
if [ -f "$RELEASE_NOTES_FILE" ]; then
  NOTES=$(sed \
    -e 's/### \(.*\)/<b>\1<\/b>/g' \
    -e 's/\*\*\([^*]*\)\*\*/<b>\1<\/b>/g' \
    -e 's/\*\([^*]*\)\*/<i>\1<\/i>/g' \
    -e 's/^[-*] /• /g' \
    -e 's/^# //g' \
    "$RELEASE_NOTES_FILE")
  if [ ${#NOTES} -gt 900 ]; then
    NOTES="${NOTES:0:900}..."
  fi
fi

# ── Step 10: GitHub Release ─────────────────────────────────────────
RELEASE_ARGS=("$TAG" "$APK" "--target" "main")
if [ -f "$RELEASE_NOTES_FILE" ]; then
  RELEASE_ARGS+=("--notes-file" "$RELEASE_NOTES_FILE")
  info "Using release notes from RELEASE_NOTES.md"
else
  RELEASE_ARGS+=("--generate-notes")
fi

if gh release view "$TAG" > /dev/null 2>&1; then
  info "Release $TAG already exists — uploading APK"
  gh release upload "$TAG" "$APK" --clobber
  if [ -f "$RELEASE_NOTES_FILE" ]; then
    gh release edit "$TAG" --notes-file "$RELEASE_NOTES_FILE"
    info "Release notes updated"
  fi
else
  info "Creating GitHub Release $TAG..."
  gh release create "${RELEASE_ARGS[@]}"
fi

# Если использовали RELEASE_NOTES.md — удаляем, чтобы не засорять историю
if [ -f "$RELEASE_NOTES_FILE" ]; then
  rm "$RELEASE_NOTES_FILE"
  info "RELEASE_NOTES.md cleaned up"
fi
info "GitHub Release ready"

# ── Step 10: Push tag (triggers CI, but release already exists) ──────
info "Pushing tag $TAG..."
if ! git ls-remote --tags origin | grep -qE "refs/tags/$TAG$"; then
  git push origin "$TAG"
  info "Tag $TAG pushed to remote"
else
  info "Tag $TAG already exists on remote (created by gh release in step 10)"
fi

# ── Step 11: Telegram notification ───────────────────────────────────
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  info "Sending Telegram notification..."

  REPO="illi-homz/VoidChatApp"
  CHANGELOG_URL="https://github.com/${REPO}/releases/tag/${TAG}"

  {
    printf '<b>🚀 VoidChatApp %s</b>\n' "$TAG"
    printf '\n'
    if [ -n "$NOTES" ]; then
      printf '<b>📋 Что нового:</b>\n'
      printf '%s\n' "$NOTES"
      printf '\n'
    fi
    printf '📦 <code>%s</code>\n' "$APK_NAME"
    printf '🔗 <a href="%s">Полный список изменений</a>\n' "$CHANGELOG_URL"
  } > /tmp/voidchat_caption.txt

  # Пробуем отправить APK с caption. Если caption не проходит (macOS curl),
  # отправляем текст отдельным сообщением.
  if curl -s -S -X POST \
    -F "chat_id=${TELEGRAM_CHAT_ID}" \
    -F "document=@${APK}" \
    -F "caption=</tmp/voidchat_caption.txt" \
    -F "parse_mode=HTML" \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" 2>/dev/null | grep -q '"ok":true'; then
    : # success
  else
    warn "Telegram sendDocument failed, sending APK + text..."
    curl -s -S -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" \
      -F "chat_id=${TELEGRAM_CHAT_ID}" \
      -F "document=@${APK}" \
      -F "caption=${TAG}" > /dev/null 2>&1 || true
    NOTES_FLAT=$(echo "$NOTES" | tr '\n' ' ' | head -c 400)
    curl -s -S -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "parse_mode=HTML" \
      -d "text=<b>VoidChatApp ${TAG}</b>

<b>Что нового:</b>
${NOTES_FLAT}

<a href=\"${CHANGELOG_URL}\">Полный список изменений</a>" > /dev/null 2>&1 || true
    info "Telegram notification sent as two messages"
  fi
else
  warn "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping notification"
fi

# ── Step 12: Push main (no-op, main already pushed in step 8) ────────
info "Pushing main branch..."
git push origin main
info "Done! Release v$VERSION published successfully."
