#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 {major|minor|patch}" >&2
  exit 1
fi

PART="$1"
if [[ "$PART" != "major" && "$PART" != "minor" && "$PART" != "patch" ]]; then
  echo "Error: argument must be 'major', 'minor' or 'patch', got '$PART'" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: not inside a git repository" >&2
  exit 1
fi

if ! git diff --quiet; then
  echo "Error: working directory is not clean. Commit or stash changes first." >&2
  exit 1
fi

CURRENT="$(node -e "console.log(require('./package.json').version)")"
IFS='.' read -r MAJ MIN PATCH <<< "$CURRENT"

case "$PART" in
  major)
    MAJ=$((MAJ + 1))
    MIN=0
    PATCH=0
    ;;
  minor)
    MIN=$((MIN + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="${MAJ}.${MIN}.${PATCH}"

# Update package.json version
node -e "
const pkg = require('./package.json');
pkg.version = '$NEW_VERSION';
require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update android/gradle.properties
CURRENT_CODE=$(node -e "
  const props = require('fs').readFileSync('android/gradle.properties', 'utf8');
  const m = props.match(/^VERSION_CODE=(\d+)/m);
  console.log(m ? m[1] : '1');
")
NEW_CODE=$((CURRENT_CODE + 1))

node -e "
const fs = require('fs');
let props = fs.readFileSync('android/gradle.properties', 'utf8');
props = props.replace(/^VERSION_NAME=.*/m, 'VERSION_NAME=$NEW_VERSION');
props = props.replace(/^VERSION_CODE=.*/m, 'VERSION_CODE=$NEW_CODE');
fs.writeFileSync('android/gradle.properties', props);
"

git add package.json android/gradle.properties
git commit -m "chore: bump version to $NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "release v$NEW_VERSION"

echo ""
echo "Version bumped to $NEW_VERSION (VERSION_CODE=$NEW_CODE)"
echo "Run 'git push --follow-tags' to trigger the release pipeline"
