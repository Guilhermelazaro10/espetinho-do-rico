# Product

<!-- impeccable:product-schema 1 -->

<!-- Fontes: CLAUDE.md, CONTRIBUTING.md, README.md, CHANGELOG.md e o briefing
     visual da versão 1.5.0 (PROMPT-VISUAL-CLAUDE-CODE.md, ADENDO-MCP-SKILLS.md,
     propostas-visuais.html). Valores visuais (cores, fontes, escala) não moram
     aqui: ficam no DESIGN.md / src/index.css. -->

## Platform

web

React SPA (Vite + Tailwind v4) servida pelo backend. O mesmo front também roda
empacotado como APK Android do garçom (Capacitor) e como app desktop (Electron).
São invólucros do site, não uma linguagem de design nativa.

## Users

Dois públicos, com objetivos opostos:

- **Clientes da loja**, que pedem pelo celular no cardápio online
  (`/cardapio`, delivery ou retirada). Muitos são de fora da loja, chegam pela
  busca ou pelo WhatsApp e não conhecem o sistema. Querem escolher, conferir
  o total e enviar o pedido rápido.
- **A equipe do PDV**, em pleno movimento:
  - **Gerente** no caixa (PC ou notebook): salão, delivery/balcão, venda
    rápida, caixa e turno, financeiro, equipe, cardápio e impressão. Dinheiro e
    correções são exclusivos do gerente.
  - **Garçom** no celular (navegador ou APK): lança pedidos nas mesas e pede a
    pré-conta, mais nada.
  - **Cozinha/chapa** num tablet ou tela (KDS): fila de pedidos lida à
    distância.

## Product Purpose

PDV em produção do **Espetinho do Rico** (Jaguaruana/CE). Uma única loja usa
o sistema todo dia, com dinheiro real, desde o salão com mapa de mesas e as
comandas até delivery/balcão, cozinha em tempo real, caixa com turno e gaveta,
financeiro, equipe, impressão térmica e o cardápio online do cliente.
Funcionar bem significa troco certo, pedido que chega na cozinha e caixa que
fecha. Um bug vira prejuízo no balcão.

## Positioning

É um sistema feito sob medida para uma loja, não um SaaS genérico de
restaurante. O cardápio, os bairros e as taxas de entrega, o horário que
passa da meia-noite (o turno de sábado vai até domingo de madrugada), a
impressão na térmica da casa e as regras do gerente refletem a operação real
do Espetinho do Rico.

## Operating Context

- Serviço noturno corrido. As telas são usadas de pé, com uma mão, em toque,
  e às vezes lidas de longe (a cozinha).
- Aparelhos: PC/notebook no caixa, celulares dos garçons (Android/APK),
  tablet na chapa (deitado ou em pé) e o celular do cliente. As larguras vão
  de 320 a 1920px.
- Tempo real por SSE: pedido online toca um "din-don" em qualquer tela do PDV.
- O cupom sai na térmica de rede da loja por um agente local.
- Fuso sempre `America/Fortaleza`.

## Capabilities and Constraints

- Regras invioláveis do domínio estão em `CONTRIBUTING.md`: dinheiro em
  centavos inteiros, total calculado pelo servidor, soft delete, ações de
  dinheiro só do gerente, auditoria e fuso da loja.
- Os papéis são GERENTE (PIN de 6 dígitos) e GARÇOM (PIN de 4).
- **Os fluxos do PDV não mudam.** Os botões fazem as mesmas coisas, nos mesmos
  lugares lógicos. A equipe não pode precisar de treinamento novo. Trabalho
  visual não altera regra de negócio, rotas da API nem cálculos.
- Não entram bibliotecas de UI (shadcn, MUI etc.). Só Tailwind e
  `lucide-react`.
- O texto visível fica em português correto (acentos). Identificadores, rotas
  (`#/garcom`) e valores de API não são renomeados.
- Responsivo tem critério medível (`scripts/auditoria-visual.mjs`): sem
  rolagem horizontal, nada fora da tela, nome de produto nunca cortado, alvos
  de 44x44px em toque abaixo de 1024px, texto de no mínimo 12px e console sem
  erro.
- Decisão pendente: fotos e descrição de produtos (exigem migration, só com
  autorização do dono).

## Brand Commitments

- A identidade é **brasa, carvão e madeira**: o logo vermelho e amarelo sobre
  madeira (`frontend/public/logo_*.png`) e a fonte de destaque Alfa Slab One,
  com Inter no resto. A paleta e a fonte de destaque se mantêm e só se
  refinam. Os valores estão em `frontend/src/index.css`.
- O cardápio do cliente é a vitrine e o único lugar com ousadia. O resto do
  sistema é sóbrio.
- O tom é direto, em português do dia a dia da loja, e os rótulos ficam em
  sentence case.

## Evidence on Hand

- O cardápio real está no seed (`backend/prisma`). Endereço: Rua Adolfo
  Francisco da Rocha, 608, Bairro Juazeiro, Jaguaruana/CE (JSON-LD em
  `frontend/index.html`).
- Logo em `frontend/public/` (`logo_full.png`, `logo_clean.png`, ícones).
- A referência visual aprovada da 1.5.0 é `propostas-visuais.html` (cardápio
  do cliente e Delivery/Balcão, em 390 e 1366px).
- **Não há fotos de produto.** Não se usa imagem falsa, gerada ou placeholder
  genérico. Também não há depoimentos, avaliações nem números para exibir.

## Product Principles

1. **Dinheiro certo antes de tudo.** Nenhum ganho visual justifica arriscar
   um valor, um total ou um pagamento.
2. **Memória muscular da equipe é patrimônio.** Melhore como a tela aparece e
   não onde as coisas estão.
3. **Legível no corre.** Toque grande, texto que se lê à distância, estado
   claro de relance e nome de produto sempre inteiro.
4. **Vitrine para o cliente, ferramenta para a equipe.** A marca se mostra
   com força no cardápio online e com precisão no PDV.
5. **Verdade sobre enfeite.** Dados reais, sem foto inventada e sem efeito
   decorativo. O movimento só responde a uma ação.

## Accessibility & Inclusion

- WCAG AA: contraste de pelo menos 4.5:1 em texto normal e 3:1 em texto grande,
  inclusive em placeholders e botões desabilitados.
- Foco de teclado visível, `aria-label` em botão só de ícone, `Sheet` com foco
  preso e fechamento com Esc.
- Respeito a `prefers-reduced-motion`.
