## O que muda

<!-- Em uma frase: o que o usuário da loja passa a ver ou deixa de sofrer. -->

## Por quê

<!-- Problema que motivou. Se corrige bug: como ele aparecia na operação. -->

## Como testei

<!-- O que foi verificado de fato (tela, cupom, fluxo). Não vale "rodei o lint". -->

## Checklist

- [ ] `npm run verificar` passa (lint + testes + build)
- [ ] Valor monetário continua **inteiro em centavos**
- [ ] Total recalculado no servidor (cliente não manda preço)
- [ ] Ação sensível (dinheiro/correção) exige gerente e vai para a auditoria
- [ ] Mudança de schema veio com migration (`prisma migrate dev`)
- [ ] Data/hora usa o fuso da loja (`America/Fortaleza`)
- [ ] Fluxo de dinheiro alterado tem teste cobrindo
- [ ] Nenhum segredo (`.env`, token) foi commitado

## Deploy

- [ ] Precisa de migration
- [ ] Precisa de variável nova no `.env.production` — qual: 
- [ ] Precisa rebuildar o `.exe` do desktop
