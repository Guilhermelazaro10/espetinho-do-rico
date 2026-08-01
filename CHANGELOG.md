# Changelog

Mudanças relevantes do PDV do Espetinho do Rico.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento em [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Interface (auditoria de acessibilidade e UX)
- **Contraste WCAG AA em todo o app.** O tom de texto secundário media 3,62:1
  (reprovado para texto pequeno); o novo tom `#856b52` mede 4,86:1 mantendo o
  marrom quente da marca. Botão "Aceitar" (2,54:1) e links de WhatsApp também
  corrigidos para verdes que passam.
- **Foco de teclado visível** em todos os elementos interativos (a auditoria
  encontrou zero) — anel na cor da marca, só para navegação por teclado.
- **Alvos de toque ≥40px** nos botões de operação (pills de categoria eram
  28px; Editar/Esgotou 32px; abas 36px) — menos toque errado no corre.
- **Salão:** cada mesa ocupada mostra **há quanto tempo** está com comanda
  aberta; esqueleto de carregamento no lugar da tela em branco; estado vazio
  com instrução; a legenda (livres/ocupadas/aguardando) não some mais no
  celular.
- Respeito a `prefers-reduced-motion` e seleção de texto na cor da marca.

### Segurança
- **Corrigido bypass do bloqueio de força-bruta do PIN.** O header
  `CF-Connecting-IP` era aceito sem validação: bastava variá-lo a cada
  tentativa para cair sempre num balde novo e nunca ser bloqueado (o PIN tem
  4 dígitos). Agora o header só é considerado quando `TRUST_PROXY` declara que
  existe proxy de verdade na frente. Coberto por teste de regressão.
- `trust proxy` configurado no Express, para `req.ip` refletir o cliente real
  atrás do Caddy.
- Auditoria de dependências na CI: vulnerabilidade alta no que vai para
  produção passa a **travar o merge**; ferramenta de build só avisa.
- Zeradas as vulnerabilidades conhecidas das dependências (`npm audit`: 6
  altas + 1 crítica → 0).

### Desempenho
- **Cupom sai na hora do clique.** O agente perguntava ao servidor de 2 em 2
  segundos se havia cupom novo; agora ele fica pendurado e o servidor responde
  no instante em que o cupom entra na fila. Medido em bancada (impressora
  simulada, sem latência de internet): **1572 ms → 46 ms**, 34× mais rápido.
  Compatível nos dois sentidos — agente antigo com servidor novo, e vice-versa,
  seguem funcionando no ritmo antigo.
- Agente passa a considerar o PDV online por até 45 s (antes 15 s), porque
  durante a espera ele fica conectado e quieto — o painel o marcaria offline
  sem motivo.

### Adicionado
- Desligamento gracioso (SIGTERM/SIGINT): o servidor para de aceitar conexão
  nova, espera as requisições em voo, derruba o SSE após o prazo e só então
  fecha o banco — deploy não corta mais pagamento pela metade.
- `/health` agora informa a `versao`, permitindo confirmar de fora se o deploy
  subiu o código novo.
- `deploy/atualizar.sh` sincroniza a unit do systemd, completa variáveis novas
  no `.env.production` e falha se o serviço não subir.
- `CONTRIBUTING.md` com as regras invioláveis do domínio; `.editorconfig`,
  `.gitattributes` e `.nvmrc`; Dependabot; template de PR.
- Scripts na raiz: `npm test`, `npm run lint`, `npm run verificar`.

### Alterado
- `uncaughtException` agora **encerra o processo** (o systemd sobe um limpo).
  Seguir rodando após exceção não tratada arriscava gravar valor errado.
- Ferramentas de build (`tailwindcss`, `@capacitor/cli`, ...) movidas para
  `devDependencies` — não vão para o servidor.
- CI: versão do Node vinda do `.nvmrc`, cancelamento de execuções obsoletas,
  permissões mínimas e verificação de que as migrations aplicam do zero.

## [1.3.1] — 2026-07-05

### Adicionado
- Garçom identificado na comanda, no cupom e no card do delivery (`criadoPor`).
- Financeiro: "Vendas por atendente" e tela de **Auditoria**.
- Fechamento de caixa sai impresso na térmica (recebido por forma, gaveta,
  esperado × contado e diferença).
- Transferir mesa inteira (juntar mesas) e transferir item entre mesas.
- Dividir conta: atalhos ÷2, ÷3 e ÷4 no pagamento.

### Corrigido
- Dia financeiro fechava às 21:00 (fuso do servidor em UTC): as vendas do fim
  da noite caíam no dia seguinte. Agora vira à meia-noite do Ceará.
- Data/hora exibidas e impressas passam a usar o fuso da loja
  (`America/Fortaleza`), não o do aparelho.
- Telas do gerente sem estouro horizontal no celular (375px).

### Alterado
- `DeliveryBalcao.jsx` e `Pedir.jsx` divididos em componentes; helpers de tempo
  unificados em `lib/datas.js`.
- Testes: 93 → 102 no backend; 34 → 49 no frontend.

## [1.3.0] — 2026-07-01

### Adicionado
- Cardápio online: aceitar/recusar pedido, acompanhamento de status pelo
  cliente, agendamento com a loja fechada e aba "Meus pedidos".
- Pagamento pretendido e troco no pedido online; taxa por bairro.
- Produto "Esgotado" some na hora do cardápio online e da tela dos garçons.
- Delivery/Balcão: busca, filtro por categoria, telefone clicável (WhatsApp),
  endereço no mapa, tempo decorrido e resumo do dia.

## [1.2.0] e anteriores

Salão com mapa de mesas e comandas, caixa com turno/sangria/conferência cega,
cozinha (KDS) em tempo real via SSE, dashboard financeiro, gestão de equipe,
impressão térmica com fila em nuvem, APK do garçom (Capacitor), app desktop
(Electron) e deploy em VPS com Caddy, systemd e Litestream.
