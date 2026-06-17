#!/usr/bin/env bash
set -euo pipefail
# Atualiza o PDV na VPS: pega o código novo, migra, rebuilda o front e reinicia.
[ "$(id -u)" -eq 0 ] || { echo "Rode como root: sudo bash deploy/atualizar.sh"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

echo "==> Buscando código novo (git pull)…"
git pull --ff-only 2>/dev/null || echo "   (sem git/remoto — se você sobe por upload, ignore)"

npm ci
( cd backend && set -a; . .env.production; set +a; npx prisma generate && npx prisma migrate deploy )
npm run build -w frontend

systemctl restart pdv
echo "==> Atualizado e reiniciado. (Litestream segue replicando o banco.)"
