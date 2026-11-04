# Deploy da versão 1.5.0

Roteiro para subir a branch `visual-premium` (visual novo e responsividade).
Leia tudo antes de começar.

**Esta versão não tem migration.** Nada muda no banco nem na API: é só o
front (e um teste). O deploy é o `atualizar.sh` de sempre.

## 1. Quando fazer

**Fora do horário de funcionamento.** O serviço reinicia por alguns segundos
e cada aparelho precisa recarregar o app uma vez (passo 5). A equipe vai ver
telas com outra cara: avise antes (passo 6).

## 2. Backup (na VPS)

Sem migration, o risco ao banco é baixo, mas o backup é um minuto e é o que
garante o rollback tranquilo:

```bash
sudo su -c 'cd /opt/espetinho/backend && set -a && . ./.env.production && set +a && \
  npx prisma db execute --stdin --schema prisma/schema.prisma' <<< "VACUUM INTO '/opt/espetinho/data/pdv-antes-1.5.0.db';"
sudo ls -lh /opt/espetinho/data/pdv.db /opt/espetinho/data/pdv-antes-1.5.0.db
```

> Não use `npm run backup` na VPS: ele copia o banco de desenvolvimento
> (`backend/prisma/dev.db`), não o de produção.

## 3. Subir o código (no PC)

```bash
git push origin visual-premium
# merge na main (pelo GitHub, ou localmente:)
git checkout main && git merge --ff-only visual-premium
git push origin main
```

Espere a CI ficar verde na `main` antes de seguir.

## 4. Atualizar a VPS

```bash
cd /opt/espetinho && sudo bash deploy/atualizar.sh
```

O script faz `git pull --ff-only`, `npm ci` (instala as fontes locais
`@fontsource/*`), `prisma migrate deploy` (não há nada novo para aplicar),
rebuilda o front, reinicia o serviço e confere se ele subiu.

## 5. Verificação pós-deploy

1. **Versão no ar:**
   ```bash
   curl -s https://espetinhodorico.com/health
   ```
   O campo `versao` deve ser `1.5.0`.
2. **Recarregar o app em cada aparelho** (PC do caixa, tablet da cozinha,
   celulares dos garçons no navegador). O HTML vem sempre da rede e os
   arquivos novos têm nome novo, então **uma recarga basta**. Se algum
   aparelho continuar com a cara antiga, feche a aba e abra de novo.
3. **Cardápio do cliente no celular de alguém de fora da loja**, no 4G (sem
   o Wi-Fi da loja), em `https://espetinhodorico.com/cardapio`:
   - o topo mostra "Aberto agora" ou "Fechado · abre ..." conforme o horário;
   - adicione 3 itens, abra a sacola, avance e confira a taxa ao escolher o
     bairro;
   - **não envie** o pedido (ou envie e recuse no PDV com o motivo "teste").
4. **Delivery/Balcão no PC do caixa**: venda rápida em dinheiro com troco e
   cancelamento logo em seguida (o estorno sai na mesma forma).
5. **Cozinha no tablet**: o pedido mais antigo fica em cima em cada coluna.
6. **Login**: PIN errado mostra "PIN não reconhecido".

## 6. Avisar a equipe

Os botões fazem as mesmas coisas, nos mesmos lugares. O que muda na prática:

- **Celular (gerente):** embaixo ficam Salão, Delivery, Cozinha e Caixa. O
  resto (Financeiro, Equipe, Cardápio, Impressão, Garçom) está no botão
  **Mais**.
- **Delivery/Balcão:** pedido online novo aparece como uma **faixa verde**
  com Aceitar/Recusar. "Em andamento" virou uma opção do controle de cima
  (no celular, "Fila"). No celular, o carrinho fica numa **barra embaixo**:
  toque nela para revisar e enviar.
- **Salão:** a mesa com conta pedida agora fica **amarela** e com "Conta".
- **Cozinha:** a ordem agora é por chegada (o mais antigo em cima).

## 7. APK novo para os garçons que usam o app Android

O Capacitor **embute o front dentro do APK**: quem usa o app instalado
continua com o visual antigo até instalar um APK novo. Siga
`frontend/CONSTRUIR-APK.md`:

```bash
npm run apk:build   # gera frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Instale o APK novo em cada celular de garçom (por cima do antigo; o
endereço do servidor salvo no app continua). Até lá, o garçom pode usar o
navegador.

## 8. Rollback

Como não há migration, voltar é só voltar o código. **Não faça `git checkout`
de um commit antigo na VPS:** o `atualizar.sh` usa `git pull --ff-only`, que
falha com o repositório fora da `main`. Reverta na `main` (no PC) e atualize
como sempre:

```bash
# no PC: desfaz os commits da 1.5.0 num commit novo (o histórico fica)
git checkout main
git log --oneline -25                       # ache o 1º commit da 1.5.0 (Docs: PRODUCT.md ...)
git revert --no-commit <1o-commit-da-1.5.0>^..HEAD
git commit -m "Volta para a 1.4.0"
git push origin main

# na VPS
cd /opt/espetinho && sudo bash deploy/atualizar.sh
curl -s https://espetinhodorico.com/health   # versao deve voltar a 1.4.0
```

Lembre de recarregar os aparelhos de novo depois do rollback.

O backup do passo 2 só é necessário se algo inesperado tiver acontecido com
o banco (esta versão não escreve nada novo nele).
