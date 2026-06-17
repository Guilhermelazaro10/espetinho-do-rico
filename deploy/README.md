# Deploy do PDV na VPS (Hostinger KVM1 — São Paulo)

Guia turnkey. Resultado: PDV em `https://seu-dominio`, acesso remoto do dono,
URL fixa pro garçom (fim do problema de IP) e impressão pela fila + agente local.

```
Navegador/Garçom ──HTTPS──> Caddy (443) ──> Node (127.0.0.1:3001) ──> SQLite (volume)
                                                     │
PC do caixa: agente ──puxa a fila──────────────────-┘──> imprime na GET tcp:9100
```

## 0. Pré-requisitos
- VPS Ubuntu 22/24 (Hostinger KVM1, **datacenter São Paulo**).
- Um **domínio** (a Hostinger dá 1 grátis) com **A-record apontando para o IP da VPS**.
  - Se usar **Cloudflare**: adicione o domínio, A-record para o IP, SSL/TLS = **Full (strict)**.

## 1. Subir o código para a VPS
No seu PC, envie o projeto para `/opt/espetinho` na VPS (exclua o que é gerado):
```bash
# opção A: git (se o repo estiver no GitHub)
ssh root@IP-DA-VPS 'git clone SEU_REPO /opt/espetinho'

# opção B: rsync (sem GitHub) — do seu PC, na raiz do projeto:
rsync -av --exclude node_modules --exclude dist --exclude dist-desktop \
  --exclude 'backend/prisma/dev.db*' --exclude .git \
  ./ root@IP-DA-VPS:/opt/espetinho/
```

## 2. Provisionar (um comando)
Na VPS, como root:
```bash
cd /opt/espetinho
sudo DOMAIN=pdv.seurestaurante.com.br bash deploy/setup-vps.sh
```
O script instala Node 20 + Caddy, cria o usuário de serviço, gera **segredos
aleatórios** (JWT + token do agente), roda as migrações, faz **seed só se o banco
estiver vazio**, builda o frontend, sobe o systemd (`pdv`), configura o Caddy
(HTTPS automático) e o firewall (só 22/80/443; o Node fica em `127.0.0.1`).

No fim ele imprime o **PRINT_AGENT_TOKEN** — guarde para o agente de impressão.

Acesse `https://seu-dominio` e entre (PINs dev: **1111** garçom / **9999** gerente).
**Troque os PINs em Equipe na hora.**

## 3. Backup contínuo (Litestream) — recomendado
```bash
# instala o litestream (binário oficial)
curl -L https://github.com/benbjohnson/litestream/releases/latest/download/litestream-linux-amd64.deb -o /tmp/ls.deb && dpkg -i /tmp/ls.deb
cp /opt/espetinho/deploy/litestream.yml.example /etc/litestream.yml
nano /etc/litestream.yml   # preencha bucket + credenciais (Backblaze B2 / Cloudflare R2)
systemctl enable --now litestream
```
Restaurar em desastre: `litestream restore -config /etc/litestream.yml /opt/espetinho/data/pdv.db`

## 4. Agente de impressão (no PC do caixa, na loja)
A impressora GET fica na LAN; a VPS não a alcança (e nem deve). O **agente** puxa
os cupons da fila e imprime. Veja `agente-impressao/README.md`. Resumo:
1. Copie a pasta `agente-impressao` para o PC do caixa (sempre ligado).
2. `config.json`: `pdvUrl=https://seu-dominio`, `token=<PRINT_AGENT_TOKEN do passo 2>`,
   `impressora=tcp://IP-DA-GET:9100`.
3. `npm install` → `npm run teste` (confere acentos) → `npm start`.

## 5. Atualizar depois
```bash
cd /opt/espetinho && sudo bash deploy/atualizar.sh
```
Pega o código novo, migra o banco, rebuilda o front e reinicia — **sem perder dados**.

## Endurecimento já incluído
- Node só em `127.0.0.1` (firewall fecha o resto); HTTPS pelo Caddy.
- `helmet` (headers de segurança) + `compression` (gzip) no backend.
- Segredo JWT por instalação; rate-limit no login; `PRINT_MODE=queue`.
- **Troque os PINs para 6 dígitos** (cadastro em Equipe) para exposição pública.

## Comandos úteis
```bash
systemctl status pdv           # estado do serviço
journalctl -u pdv -f           # logs ao vivo
systemctl restart pdv          # reiniciar
caddy validate --config /etc/caddy/Caddyfile
```
