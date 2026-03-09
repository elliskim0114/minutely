#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: npm run release:mac -- <version>"
  echo "example: npm run release:mac -- 0.1.1"
  exit 1
fi

VERSION="$1"
REPO_URL="$(git remote get-url origin 2>/dev/null || true)"
REPO_PATH="${REPO_URL#https://github.com/}"
REPO_PATH="${REPO_PATH%.git}"

if [[ -z "$REPO_PATH" || "$REPO_PATH" == "$REPO_URL" ]]; then
  echo "couldn't detect github repo from git remote origin."
  echo "set your remote first, then rerun."
  exit 1
fi

echo "bumping app version to $VERSION..."
npm version "$VERSION" --no-git-tag-version

echo "building mac zip..."
npm run desktop:dist

ZIP_PATH="dist-desktop/Minutely-${VERSION}.zip"
if [[ ! -f "$ZIP_PATH" ]]; then
  echo "build finished but $ZIP_PATH was not found."
  exit 1
fi

echo
echo "done. next commands:"
echo "git add package.json package-lock.json"
echo "git commit -m \"release v${VERSION}\""
echo "git tag v${VERSION}"
echo "git push origin main --tags"
echo
echo "then publish the release here:"
echo "https://github.com/${REPO_PATH}/releases/new?tag=v${VERSION}"
echo
echo "upload this file in release assets:"
echo "$ZIP_PATH"
