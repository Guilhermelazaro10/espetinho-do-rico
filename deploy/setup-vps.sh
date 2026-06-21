#!/usr/bin/env bash
set -euo pipefail

# ===== Espetinho do Rico — provisiona a VPS (Ubuntu 22/24) =====
# Uso:  sudo DOMAIN=pdv.seurestaurante.com.br bash deploy/setup-vps.sh
# Pré: o repositório já está em /opt/espetinho e o A-record do domínio aponta p/ a VPS.
# É idempotente: pode rodar de novo. NÃO apaga dados (só faz seed se o banco estiver vazio).

[ "$(id -u)" -eq 0 ] || { echo "Rode como root: sudo DOMAIN=... bash deploy/setup-vps.sh"; exit 1; }
DOMAIN="${DOMAIN:-${1:-}}"
[ -n "$DOMAIN" ] || { echo "Defina o domínio: sudo DOMAIN=pdv.exemplo.com bash deploy/setup-vps.sh"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$APP_DIR/data"
ENV_FILE="$APP_DIR/backend/.env.production"

# DOMAIN pode ser uma lista separada por espaço (ex.: "exemplo.com www.exemplo.com").
# O primeiro é o principal; todos entram no Caddy e no ALLOWED_ORIGINS.
read -ra DOMAINS <<< "$DOMAIN"
PRIMARY_DOMAIN="${DOMAINS[0]}"
CADDY_SITE=""
ALLOWED_ORIGINS=""
for d in "${DOMAINS[@]}"; do
  CADDY_SITE="${CADDY_SITE:+$CADDY_SITE, }$d"
  ALLOWED_ORIGINS="${ALLOWED_ORIGINS:+$ALLOWED_ORIGINS,}https://$d"
done
echo "==> App: $APP_DIR | Domínio(s): $DOMAIN"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg ufw apt-transport-https openssl

# Node 20
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE 'v(2[0-9]|[3-9][0-9])'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
NODE_BIN="$(command -v node)"

# Caddy (HTTPS automático)
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y && apt-get install -y caddy
fi

# Usuário de serviço (sem shell)
id espetinho >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin espetinho

mkdir -p "$DATA_DIR" "$APP_DIR/backend/cupons"
cd "$APP_DIR"
npm ci
( cd backend && DATABASE_URL="file:$DATA_DIR/pdv.db" npx prisma generate )

# .env de produção — gera segredos SÓ na primeira vez
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3001
HOST=127.0.0.1
DATABASE_URL=file:$DATA_DIR/pdv.db
JWT_SECRET=$(openssl rand -hex 48)
PRINT_AGENT_TOKEN=$(openssl rand -hex 24)
ALLOWED_ORIGINS=$ALLOWED_ORIGINS
ALLOW_LAN_ORIGINS=false
FRONTEND_DIST=$APP_DIR/frontend/dist
PRINT_MODE=queue
EOF
  echo "==> .env.production criado com segredos aleatórios."
fi

# Migra o schema (idempotente)
( cd backend && set -a; . "$ENV_FILE"; set +a; npx prisma migrate deploy )

# Seed APENAS se o banco estiver vazio (preserva produção em re-runs)
USUARIOS="$( cd backend && set -a; . "$ENV_FILE"; set +a; node -e "new (require('@prisma/client').PrismaClient)().usuario.count().then(n=>console.log(n)).catch(()=>console.log('err')).finally(()=>process.exit())" )"
if [ "$USUARIOS" = "0" ]; then
  ( cd backend && set -a; . "$ENV_FILE"; set +a; node prisma/seed.js )
  echo "==> Seed inicial aplicado (banco estava vazio)."
else
  echo "==> Banco já tem dados ($USUARIOS usuário(s)); seed NÃO aplicado."
fi

npm run build -w frontend

chown -R espetinho:espetinho "$DATA_DIR" "$APP_DIR/backend/cupons"
chmod 600 "$ENV_FILE"

# systemd
cat > /etc/systemd/system/pdv.service <<EOF
[Unit]
Description=Espetinho do Rico - PDV
After=network.target

[Service]
Type=simple
User=espetinho
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN src/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable pdv >/dev/null 2>&1 || true
systemctl restart pdv

# Caddy
cat > /etc/caddy/Caddyfile <<EOF
$CADDY_SITE {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3001
}
EOF
systemctl reload caddy 2>/dev/null || systemctl restart caddy

# Firewall: só SSH + HTTP/HTTPS (Node fica em 127.0.0.1, nunca exposto)
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
yes | ufw enable >/dev/null 2>&1 || true

echo ""
echo "================================================================"
echo " PRONTO!  Acesse:  https://$PRIMARY_DOMAIN"
echo " Token do agente de impressão (cole no config.json do PC do caixa):"
grep PRINT_AGENT_TOKEN "$ENV_FILE"
echo " PINs de desenvolvimento: 1111 (garçom) / 9999 (gerente)"
echo " >>> TROQUE os PINs em Equipe assim que entrar. <<<"
echo "================================================================"
