#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
ZIP_PATH="$DIST_DIR/url-picker-v1.1.0.zip"

mkdir -p "$DIST_DIR"
rm -f "$ZIP_PATH"

cd "$ROOT_DIR/extension"
zip -r "$ZIP_PATH" . -x "*.DS_Store" "__MACOSX/*"

echo "Created $ZIP_PATH"
