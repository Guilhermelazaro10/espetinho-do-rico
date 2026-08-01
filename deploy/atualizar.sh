#!/usr/bin/env bash
set -euo pipefail
# Atualiza o PDV na VPS: pega o código novo, migra, rebuilda o front e reinicia.
[ "$(id -u)" -eq 0 ] || { echo "Rode como root: sudo bash deploy/atualizar.sh"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

ENV_FILE="$APP_DIR/backend/.env.production"

echo "==> Buscando código novo (git pull)…"
git pull --ff-only 2>/dev/null || echo "   (sem git/remoto — se você sobe por upload, ignore)"

# Variáveis novas não entram sozinhas em instalações antigas: o setup-vps só
# escreve o .env na primeira vez. Cada linha é "CHAVE=valor padrão".
garantir_variavel() {
  local chave="${1%%=*}" linha="$1"
  if ! grep -q "^${chave}=" "$ENV_FILE" 2>/dev/null; then
    echo "$linha" >> "$ENV_FILE"
    echo "   + $chave adicionado ao .env.production"
  fi
}

if [ -f "$ENV_FILE" ]; then
  echo "==> Conferindo variáveis obrigatórias…"
  # Sem isto a API não confia no CF-Connecting-IP e joga todos os clientes no
  # mesmo balde de rate-limit (um atacante travaria a equipe inteira).
  garantir_variavel "TRUST_PROXY=true"
  # Prazo do desligamento gracioso; precisa ser < TimeoutStopSec do systemd.
  garantir_variavel "SHUTDOWN_TIMEOUT_MS=10000"
fi

npm ci
( cd backend && set -a; . .env.production; set +a; npx prisma generate && npx prisma migrate deploy )
npm run build -w frontend

# A unit pode ter mudado (ex.: TimeoutStopSec do desligamento gracioso).
if ! cmp -s "$SCRIPT_DIR/pdv.service" /etc/systemd/system/pdv.service; then
  echo "==> Atualizando a unit do systemd…"
  cp "$SCRIPT_DIR/pdv.service" /etc/systemd/system/pdv.service
  systemctl daemon-reload
fi

systemctl restart pdv

# Confere que subiu de verdade em vez de avisar "ok" com o serviço caído.
sleep 2
if systemctl is-active --quiet pdv; then
  echo "==> Atualizado e no ar. (Litestream segue replicando o banco.)"
else
  echo "!! O serviço NÃO subiu. Veja: journalctl -u pdv -n 50 --no-pager" >&2
  exit 1
fi
