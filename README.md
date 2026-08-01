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
│   │   ├── lib/          prisma, pin (scrypt), eventos (SSE), mutex, logger,
│   │   │                 rede (IP real/proxy), desligamento gracioso, versão
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

Node **20** (fixado em `.nvmrc` — a VPS e a CI usam a mesma versão).

```bash
npm install                 # instala backend + frontend (workspaces)
npm run seed                # popula cardápio, mesas e usuários de teste
npm run dev:backend         # API em http://localhost:3001
npm run dev:frontend        # UI em http://localhost:5173
```

Outros modos:
- `npm run desktop` — abre como app Electron (backend embutido).
- `npm run lan` — sobe um servidor para acesso pela rede local.

## Testes e qualidade

```bash
npm run verificar           # lint + testes + build (o mesmo que a CI roda)
npm test                    # 102 testes de backend + 49 de frontend
npm run lint
```

A CI (`.github/workflows/ci.yml`) roda lint, testes, build, aplica as
migrations num banco do zero e audita as dependências a cada push —
vulnerabilidade alta no que vai para produção **trava o merge**.

Convenções obrigatórias do domínio (dinheiro em centavos, papéis, auditoria,
fuso da loja) estão em [`CONTRIBUTING.md`](CONTRIBUTING.md). Histórico de
versões em [`CHANGELOG.md`](CHANGELOG.md).

## Deploy e operação
- **Subir/atualizar a VPS:** veja [`deploy/README.md`](deploy/README.md).
  - Provisionar: `sudo DOMAIN="espetinhodorico.com www.espetinhodorico.com" bash deploy/setup-vps.sh`
  - Atualizar: `sudo bash deploy/atualizar.sh`
  - Trancar a origem no Cloudflare: `sudo bash deploy/firewall-cloudflare.sh`
- **Conferir o que está no ar:** `curl -s https://espetinhodorico.com/health`
  — o campo `versao` deve bater com o `version` do `package.json` da raiz.
- **Impressora:** veja [`agente-impressao/README.md`](agente-impressao/README.md).

O reinício é gracioso: ao receber o SIGTERM a API para de aceitar conexão
nova, termina as requisições em voo e só então fecha o banco — atualizar no
meio do movimento não corta um pagamento.

## Segurança (resumo)
- Login por **PIN** (scrypt + salt, comparação em tempo constante); rate-limit
  por IP real — o header de IP do proxy só é aceito com `TRUST_PROXY` ligado,
  senão qualquer cliente forjaria o próprio IP e furaria o bloqueio.
- Papéis **GERENTE/GARÇOM**: dinheiro, financeiro, RH e impressão são exclusivos do gerente.
- Totais sempre recalculados no servidor; preços congelados na venda; trilha de auditoria.
- Em produção: HTTPS via Cloudflare, API presa no loopback, firewall restrito ao Cloudflare.
