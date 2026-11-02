# Deploy da versão 1.4.0

Roteiro para subir a branch `melhorias-nov-2026` (venda rápida, pausa do
delivery e correções de segurança). Leia tudo antes de começar.

## 1. Quando fazer

**Fora do horário de funcionamento.** O serviço reinicia, e o login de quem
estiver usando cai por alguns segundos. Os tablets e celulares também precisam
recarregar o app depois (passo 7).

## 2. Backup antes de tudo (na VPS)

Este deploy tem duas migrations, ambas só **adicionam** coisa (nada é apagado
nem reescrito):

| Migration | O que faz |
|---|---|
| `20261102120000_venda_rapida_pausa_delivery` | `ADD COLUMN pedidos.pago_antecipado` (padrão `false`) e `CREATE TABLE configuracoes` |
| `20261102130000_codigo_acompanhamento` | `ADD COLUMN pedidos.codigo_acompanhamento` (vazio nos pedidos antigos) e `CREATE UNIQUE INDEX` nessa coluna |

Mesmo assim, faça o backup:

```bash
# Opção A: sqlite3 (o setup-vps.sh NÃO instala; instale uma vez se precisar)
sudo apt-get install -y sqlite3
sudo sqlite3 /opt/espetinho/data/pdv.db ".backup /opt/espetinho/data/pdv-antes-1.4.0.db"

# Opção B: sem instalar nada, pelo próprio Prisma (do mesmo jeito que o
# atualizar.sh roda as migrations). Cópia consistente com o serviço no ar.
sudo su -c 'cd /opt/espetinho/backend && set -a && . ./.env.production && set +a && \
  npx prisma db execute --stdin --schema prisma/schema.prisma' <<< "VACUUM INTO '/opt/espetinho/data/pdv-antes-1.4.0.db';"
```

Confira que o arquivo existe e tem tamanho parecido com o original:

```bash
sudo ls -lh /opt/espetinho/data/pdv.db /opt/espetinho/data/pdv-antes-1.4.0.db
```

> **Não use `npm run backup` na VPS.** O script `backend/scripts/backup-db.js`
> copia `backend/prisma/dev.db` (o banco de desenvolvimento), não o
> `/opt/espetinho/data/pdv.db` de produção. O Litestream continua replicando
> normalmente; este backup é a cópia "um clique antes" para o rollback.

## 3. Subir o código (no PC)

```bash
git push origin melhorias-nov-2026
# merge na main (pelo GitHub, ou localmente:)
git checkout main && git merge --ff-only melhorias-nov-2026
git push origin main
```

Espere a CI ficar verde na `main` antes de seguir.

## 4. Atualizar a VPS

```bash
cd /opt/espetinho && sudo bash deploy/atualizar.sh
```

O script faz `git pull --ff-only`, `npm ci`, `prisma migrate deploy` (aplica
as duas migrations acima), rebuilda o front, reinicia o serviço e confere se
ele subiu. Se o `git pull` falhar, ele para sem mexer em nada.

## 5. Verificação pós-deploy

1. **Versão no ar:**
   ```bash
   curl -s https://espetinhodorico.com/health
   ```
   O campo `versao` deve ser `1.4.0`.
2. **Login como gerente.** Se o PIN do gerente ainda tiver 4 dígitos, entra
   normal e aparece o aviso "Troque seu PIN". Isso é esperado.
3. **Venda rápida de teste e cancelamento** (Delivery/Balcão → aba "Venda
   rapida"):
   - Lance 1 item em **Dinheiro**, com "valor recebido" maior que o total, e
     confira o troco na tela.
   - Marque **"Entregue na hora"** para não imprimir comanda na chapa.
   - Cancele a venda com um motivo ("teste deploy").
   - No **Caixa**, confira que entrou o valor e saiu o mesmo valor (estorno
     negativo): o saldo do turno não muda. Na **Auditoria** devem aparecer
     `venda_rapida` e `cancelamento_comanda` com o estorno.
4. **Pausar e reativar o delivery** (botão no topo da tela Delivery/Balcão):
   - Pausado: o banner amarelo aparece, e o cardápio online
     (`/cardapio`) mostra "Entrega — Pausado hoje", abrindo em Retirada.
   - Reative e confira que a Entrega volta no cardápio.
5. **Cardápio no celular** (4G, fora do Wi-Fi da loja): abra `/cardapio`,
   monte um pedido de **retirada** e confira o acompanhamento na tela de
   sucesso. Recuse esse pedido no PDV depois.
6. **Entrega com bairro:** se o `LOJA_BAIRROS` estiver configurado, um pedido
   de entrega precisa ter um bairro escolhido (antes, sem bairro, a taxa saía
   zerada).

## 6. Regra no Cloudflare (manual, não é código)

Security → WAF → **Rate limiting rules** → Create rule:

- **If:** `URI Path` *equals* `/api/auth/login`
- **Rate:** 10 requests por **1 minute**, contando por **IP**
- **Then:** **Block** por **10 minutes**

Todos os aparelhos da equipe no Wi-Fi da loja saem pelo mesmo IP. 10 logins
por minuto sobra para a troca de turno, mas se a equipe crescer muito, suba
esse número.

## 7. Avisar a equipe

- **Gerentes com PIN de 4 dígitos** devem trocar para 6: Equipe → "Trocar meu
  PIN". O sistema não deixa mais criar, gerar ou trocar PIN de gerente com
  menos de 6 dígitos. Garçom continua com 4.
- **Todo celular/tablet da equipe deve recarregar o app uma vez** (fechar e
  abrir, ou puxar para atualizar). O service worker novo apaga os dados do
  caixa e dos pedidos que as versões antigas guardavam no aparelho.
- Clientes que tinham pedidos antigos em "Meus pedidos" no cardápio online
  continuam vendo a lista, mas sem o status ao vivo desses pedidos antigos.
  Os pedidos novos são acompanhados normalmente.

## 8. Rollback

1. **Antes de voltar, feche as vendas rápidas em aberto** (marque como
   entregue ou cancele). O código antigo não sabe que elas já foram pagas:
   ele as mostraria como "em aberto" e deixaria cobrar de novo.
2. Volte o código para a versão anterior (`8848acc`, a `main` antes deste
   deploy) e rode o `atualizar.sh`:
   ```bash
   # no PC
   git checkout main && git revert --no-edit 8848acc..HEAD && git push origin main
   # na VPS
   cd /opt/espetinho && sudo bash deploy/atualizar.sh
   ```
   As migrations são só aditivas: o código antigo funciona com as colunas e a
   tabela novas no banco (ele simplesmente as ignora). Não é preciso desfazer
   nenhuma migration.
3. Depois do rollback, o service worker antigo volta a guardar respostas da
   API no aparelho. Se o motivo do rollback não for urgente, prefira corrigir
   para frente.
4. **Só em último caso**, restaure o backup do passo 2 (perde tudo o que foi
   vendido depois do backup):
   ```bash
   sudo systemctl stop pdv litestream
   sudo cp /opt/espetinho/data/pdv.db /opt/espetinho/data/pdv-com-problema.db
   sudo cp /opt/espetinho/data/pdv-antes-1.4.0.db /opt/espetinho/data/pdv.db
   sudo rm -f /opt/espetinho/data/pdv.db-wal /opt/espetinho/data/pdv.db-shm
   sudo chown espetinho:espetinho /opt/espetinho/data/pdv.db
   sudo systemctl start litestream pdv
   ```
   Se o Litestream não estiver instalado, tire o `litestream` dos dois
   `systemctl`. A réplica na nuvem passa a seguir o banco restaurado.
