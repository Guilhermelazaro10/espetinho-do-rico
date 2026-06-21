#!/usr/bin/env bash
set -euo pipefail

# ===== Trancar a origem para aceitar SÓ o Cloudflare =====
# Depois deste script, 80/443 só aceitam as faixas de IP do Cloudflare.
# Ninguém consegue mais furar o proxy batendo direto no IP da VPS — todo
# tráfego passa obrigatoriamente pelo escudo (WAF/rate-limit/cache do CF).
# SSH (22) continua liberado. Idempotente: pode rodar de novo.
#
# Uso:  sudo bash deploy/firewall-cloudflare.sh

[ "$(id -u)" -eq 0 ] || { echo "Rode como root: sudo bash deploy/firewall-cloudflare.sh"; exit 1; }

CADDYFILE=/etc/caddy/Caddyfile

echo "==> 1/3 Caddy: certificado interno (o Cloudflare entrega o HTTPS público)."
# Com o proxy do CF na frente (modo Full), a origem não precisa de cert público.
# Trocar por 'tls internal' remove a renovação Let's Encrypt — que falharia
# quando o firewall bloquear o acesso direto do Let's Encrypt à porta 443.
if [ -f "$CADDYFILE" ] && ! grep -q 'tls internal' "$CADDYFILE"; then
  cp "$CADDYFILE" "$CADDYFILE.bak.$(date +%s)"
  sed -i 's|^\([[:space:]]*\)reverse_proxy 127.0.0.1:3001|\1tls internal\n\1reverse_proxy 127.0.0.1:3001|' "$CADDYFILE"
  if caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
    systemctl reload caddy
    echo "    OK — Caddy agora usa cert interno."
  else
    echo "    Caddyfile ficou inválido — revertendo (segue sem mexer no Caddy)."
    mv "$(ls -t "$CADDYFILE".bak.* | head -1)" "$CADDYFILE"
  fi
else
  echo "    (já estava com cert interno ou Caddyfile ausente — pulando)"
fi

echo "==> 2/3 Baixando as faixas de IP atuais do Cloudflare."
IPS_V4="$(curl -fsSL https://www.cloudflare.com/ips-v4)" || { echo "Falha ao baixar IPs do Cloudflare"; exit 1; }
[ -n "$IPS_V4" ] || { echo "Lista de IPs vazia — abortando p/ não trancar tudo"; exit 1; }

echo "==> 3/3 Reconfigurando o firewall (ufw)."
# remove o 'allow de qualquer lugar' nas portas web
ufw delete allow 80/tcp  >/dev/null 2>&1 || true
ufw delete allow 443/tcp >/dev/null 2>&1 || true

# libera 80/443 SOMENTE para as faixas do Cloudflare (IPv4; o IPv6 foi desligado)
while read -r faixa; do
  [ -n "$faixa" ] || continue
  ufw allow from "$faixa" to any port 80  proto tcp >/dev/null
  ufw allow from "$faixa" to any port 443 proto tcp >/dev/null
done <<< "$IPS_V4"

ufw reload >/dev/null

echo ""
echo "================================================================"
echo " PRONTO! A origem agora só aceita o Cloudflare em 80/443."
echo " SSH (22) segue liberado. O site continua em https://espetinhodorico.com"
echo ""
echo " Para REVERTER (ex.: se desligar o proxy laranja do Cloudflare):"
echo "   sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw reload"
echo "================================================================"
ufw status | grep -E '80|443|22' | head
