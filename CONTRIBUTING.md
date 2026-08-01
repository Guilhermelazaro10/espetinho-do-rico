# Como mexer neste projeto

Este é o sistema que a loja usa **em produção, todo dia, com dinheiro real**.
Um bug aqui não é um teste vermelho: é troco errado no caixa ou pedido que não
chega na cozinha. As regras abaixo existem por causa disso.

## Ambiente

Node **20** (fixado em [`.nvmrc`](.nvmrc); a VPS e a CI usam a mesma versão).

```bash
npm install              # instala backend + frontend (workspaces)
npm run seed             # cardápio, mesas e usuários de teste
npm run dev:backend      # API   → http://localhost:3001
npm run dev:frontend     # UI    → http://localhost:5173
```

Antes de commitar, rode a mesma coisa que a CI roda:

```bash
npm run verificar        # lint + testes (backend e frontend) + build
```

## Regras invioláveis

Estas não são preferências de estilo. Quebrar qualquer uma causa prejuízo
financeiro ou perda de dado.

### 1. Dinheiro é inteiro em centavos

`R$ 12,50` é `1250`. **Nunca** use ponto flutuante para valor monetário —
`0.1 + 0.2 !== 0.3` vira diferença no fechamento do caixa. A conversão para
reais acontece só na borda (`moeda()` na UI, formatação no cupom).

### 2. Quem calcula o total é o servidor

O cliente manda *quais itens*, nunca *quanto custa*. O backend busca o preço
atual no banco e **congela** o preço unitário no item vendido
(`precoUnitario`), para que um reajuste futuro não reescreva o histórico.

### 3. Nada de apagar de verdade (soft delete)

Produto esgotado e funcionário desligado viram `ativo: false`. Apagar a linha
quebraria os relatórios e a auditoria de vendas passadas.

### 4. Dinheiro e correção são exclusivos do gerente

Pagamento, cancelamento, remoção de item, transferência de mesa, financeiro e
RH passam por `somenteGerente`. Garçom lança pedido e pede a pré-conta — só.

### 5. Ação sensível vai para a auditoria

Todo caminho que mexe em dinheiro ou desfaz algo chama
`auditoriaService.registrar(usuario, acao, detalhe)`. O registro guarda o nome
de quem fez, imutável, mesmo que o usuário mude depois.

### 6. O fuso é o da loja, não o do servidor nem o do aparelho

Sempre `America/Fortaleza` (helpers em `frontend/src/lib/datas.js` e
`relatoriosService`). A VPS roda em UTC: usar o fuso do servidor faz o dia
financeiro virar às 21:00 e joga a venda da noite no dia seguinte.

### 7. Schema só muda por migration

`npx prisma migrate dev --name descricao-curta`. Editar o schema sem gerar a
migration passa nos testes (que usam mock) e só quebra no deploy — por isso a
CI aplica as migrations num banco do zero.

### 8. Nunca comprimir o SSE

O stream `/api/eventos` fica de fora do `compression` (já tratado em
`app.js`). O buffer do compressor segura os eventos e mata o tempo real.

## Testes

Cobertura obrigatória para qualquer caminho que toque em dinheiro: pagamento,
troco, taxa, fechamento de caixa, cancelamento.

```bash
npm run test:backend     # Jest + Supertest (rotas, serviços, concorrência)
npm run test:frontend    # Vitest + Testing Library
```

O backend testa com o Prisma mockado — testes rápidos e sem banco de verdade.
Ao corrigir um bug, **escreva antes o teste que falha**; foi assim que o
bypass do rate-limit de login foi confirmado antes de ser fechado.

## Estilo

- Código, comentários e mensagens de commit em **português**.
- Comentário explica *por que*, não *o que*. Se o código já diz, não comente.
- Rotas são finas: validam a entrada e chamam o serviço. A regra de negócio
  mora em `services/` — essa é a fonte de verdade.
- Erros esperados usam `AppError` (vira resposta HTTP tratada). Erro
  inesperado sobe para o handler global.

## Deploy

```bash
cd /opt/espetinho && sudo bash deploy/atualizar.sh
```

O script atualiza o código, aplica migrations, rebuilda o front, sincroniza a
unit do systemd, reinicia e **confere se o serviço subiu**. Depois, confirme a
versão no ar:

```bash
curl -s https://espetinhodorico.com/health
```

O campo `versao` deve bater com o `version` do `package.json` da raiz.

## Segurança

- Segredo (`.env`, `.env.production`, `config.json` do agente) **nunca** entra
  no repositório — já estão no `.gitignore`.
- `TRUST_PROXY` só pode ser `true` onde existe proxy de verdade na frente
  (a VPS). Ligar sem proxy deixa qualquer cliente forjar o próprio IP e furar
  o bloqueio de força-bruta do PIN.
- Dependência de produção com vulnerabilidade alta **trava o merge** na CI.
  Ferramenta de build só gera aviso (não sobe para o servidor).
