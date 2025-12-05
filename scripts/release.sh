#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DATE="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT_DIR/release"
mkdir -p "$OUT_DIR/templates"

npm install
npm run build

zip -r "$OUT_DIR/serdo-frontend-$DATE.zip" dist
zip -r "$OUT_DIR/serdo-api-$DATE.zip" api -x "api/node_modules/**" "api/.git/**"
zip -r "$OUT_DIR/serdo-release-$DATE.zip" dist api -x "api/node_modules/**" ".git/**"

cp -f "$ROOT_DIR/deploy/templates/serdo-api.service" "$OUT_DIR/templates/serdo-api.service"
cp -f "$ROOT_DIR/deploy/templates/nginx-serdo.conf" "$OUT_DIR/templates/nginx-serdo.conf"

echo "$OUT_DIR"

