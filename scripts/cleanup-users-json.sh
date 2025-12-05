#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT_DIR/api/data/users.json"
BACKUP_DIR="$ROOT_DIR/backups"
mkdir -p "$BACKUP_DIR"
if [ -f "$TARGET" ]; then
  cp "$TARGET" "$BACKUP_DIR/users.json.$(date +%Y%m%d%H%M%S)"
  rm -f "$TARGET"
  echo "removed users.json (backup retained)"
else
  echo "users.json not found"
fi

