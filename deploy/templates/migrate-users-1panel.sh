#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/serdo}"
SERVICE_NAME="${SERVICE_NAME:-serdo-api}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

cd "$INSTALL_DIR"

echo "[migrate] backing up users.json"
mkdir -p "$INSTALL_DIR/backups"
if [ -f "$INSTALL_DIR/api/data/users.json" ]; then
  cp "$INSTALL_DIR/api/data/users.json" "$INSTALL_DIR/backups/users.json.$(date +%Y%m%d%H%M%S)"
fi

echo "[migrate] installing sqlite dependency"
cd "$INSTALL_DIR/api"
npm i better-sqlite3 --omit=dev

echo "[migrate] running migration"
cd "$INSTALL_DIR"
node scripts/migrate-users-to-sqlite.js || { echo "migration failed, rollback"; exit 1; }

echo "[migrate] enabling USE_SQLITE"
export USE_SQLITE=true
systemctl restart "$SERVICE_NAME" || true

echo "[migrate] cleanup old backups"
find "$INSTALL_DIR/backups" -name 'users.json.*' -mtime +"$BACKUP_KEEP_DAYS" -type f -delete || true

echo "[migrate] done"

