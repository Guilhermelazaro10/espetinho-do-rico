# Espetinho do Rico — Sistema PDV

Sistema de ponto de venda (PDV) completo para o **Espetinho do Rico**: salão com
mapa de mesas, comandas, delivery/balcão, cozinha (KDS), caixa com turno e
gaveta, dashboard financeiro, gestão de equipe e impressão térmica com a logo da
casa. Roda na **nuvem** (acesso por qualquer aparelho) e também como **app de
desktop** ou **servidor de LAN** para uso offline.

> 💵 **Convenção central:** todo valor monetário é um **inteiro em centavos** —
> aritmética exata, sem ponto flutuante. A formatação para reais é só na borda (UI/cupom).

---

## Arquitetura

```
                 ☁️  espetinhodorico.com  (Cloudflare → Caddy → Node)
                                  │
        ┌─────────────────────────┼──────────────────────────┐
     Caixa (PC)            Garçom (celular)              Cozinha (tela)
     navegador                navegador                   navegador
        │
        └──► Agente de impressão (PC local) ──► Impressora térmica (rede, tcp:9100)
```

- **Nuvem (produção):** Cloudflare (HTTPS/escudo) → Caddy (reverse proxy) →
  Node/Express (127.0.0.1:3001) → SQLite. Frontend servido pelo próprio backend.
- **Impressão:** o backend enfileira o cupom; um **agente** no PC da loja puxa a
  fila e imprime na térmica de rede. A loja nunca fica exposta (só conexão de saída).
- **Tempo real:** SSE (`/api/eventos`) sinaliza mudanças; os clientes recarregam.

## Tecnologias
- **Backend:** Node.js, Express 5, Prisma 6, SQLite, JWT (login por PIN), Helmet.
- **Frontend:** React 19, Vite, Tailwind v4, Lucide. PWA + roteamento por hash.
- **Desktop:** Electron (empacotado com electron-builder).
- **Mobile:** Capacitor (APK Android do garçom).
- **Deploy:** VPS Ubuntu + Caddy + systemd + ufw + Litestream (backup).

## Estrutura do repositório

```
.
├── backend/            API Express + Prisma (SQLite)
│   ├── prisma/         schema, migrations e seed (cardápio real)
│   ├── src/
│   │   ├── routes/       rotas HTTP (1 arquivo por recurso; finas, chamam o serviço)
│   │   ├── services/     regra de negócio (fonte de verdade)
│   │   ├── middlewares/  auth, erros, rate-limit de login
│   │   ├── lib/          prisma, pin (scrypt), eventos (SSE), mutex, logger
│   │   ├── errors/       AppError (erros operacionais)
│   │   └── constantes.js valores canônicos (papéis, status, taxas)
│   └── tests/          Jest + Supertest
├── frontend/           SPA React (Vite) — também empacota o APK (Capacitor)
│   └── src/{pages,components,lib,ui}
├── agente-impressao/   agente local que imprime a fila na térmica de rede
├── deploy/             provisionamento da VPS (setup, firewall, systemd, Caddy)
├── desktop/            empacotamento Electron (.exe)
└── scripts/            utilitários (servidor de LAN)
```

## Rodando localmente

```bash
npm install                 # instala backend + frontend (workspaces)
npm run seed -w backend     # popula cardápio, mesas e usuários de teste
npm run dev  -w backend     # API em http://localhost:3001
npm run dev  -w frontend    # UI em http://localhost:5173
```

Outros modos:
- `npm run desktop` — abre como app Electron (backend embutido).
- `npm run lan` — sobe um servidor para acesso pela rede local.

## Testes e qualidade

```bash
npm test    -w backend      # Jest (rotas, serviços, concorrência, cupom)
npm run lint -w backend     # ESLint
npm run build -w frontend   # build de produção
```

A CI (GitHub Actions, `.github/workflows/ci.yml`) roda testes, lint e build a cada push.

## Deploy e operação
- **Subir/atualizar a VPS:** veja [`deploy/README.md`](deploy/README.md).
  - Provisionar: `sudo DOMAIN="espetinhodorico.com www.espetinhodorico.com" bash deploy/setup-vps.sh`
  - Atualizar: `sudo bash deploy/atualizar.sh`
  - Trancar a origem no Cloudflare: `sudo bash deploy/firewall-cloudflare.sh`
- **Impressora:** veja [`agente-impressao/README.md`](agente-impressao/README.md).

## Segurança (resumo)
- Login por **PIN** (scrypt + salt, comparação em tempo constante); rate-limit por IP real.
- Papéis **GERENTE/GARÇOM**: dinheiro, financeiro, RH e impressão são exclusivos do gerente.
- Totais sempre recalculados no servidor; preços congelados na venda; trilha de auditoria.
- Em produção: HTTPS via Cloudflare, API presa no loopback, firewall restrito ao Cloudflare.
