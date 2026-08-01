#!/usr/bin/env bash
set -euo pipefail
# Atualiza o PDV na VPS: pega o código novo, migra, rebuilda o front e reinicia.
[ "$(id -u)" -eq 0 ] || { echo "Rode como root: sudo bash deploy/atualizar.sh"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

ENV_FILE="$APP_DIR/backend/.env.production"

echo "==> Buscando código novo (git pull)…"
# Duas situações que ANTES viravam a mesma mensagem amigável: "não uso git aqui"
# (upload manual — legítimo, segue) e "o pull não passou" (arquivo editado na
# VPS, histórico divergente). No segundo caso o script seguia adiante, rebuildava
# e anunciava "Atualizado e no ar" rodando o código ANTIGO — o deploy mentia.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git remote get-url origin >/dev/null 2>&1; then
  if ! git pull --ff-only; then
    echo "" >&2
    echo "!! O 'git pull' não passou — NADA foi atualizado." >&2
    echo "   Causa comum: algum arquivo editado direto na VPS, ou histórico divergente." >&2
    echo "   Veja o que está pendente antes de repetir o deploy:" >&2
    echo "     cd $APP_DIR && git status" >&2
    exit 1
  fi
else
  echo "   (sem git/remoto — você sobe por upload; seguindo)"
fi

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

# SSH nunca pode ficar trancado: na instalação original o 'ufw allow OpenSSH'
# falhou em silêncio e a VPS ficou acessível só pelo console da Hostinger.
# A regra explícita é idempotente — garante em todo deploy.
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
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
