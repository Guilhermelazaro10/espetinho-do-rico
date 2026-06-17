# Agente de Impressão — Espetinho do Rico

Roda no **PC do caixa** (sempre ligado). Puxa os cupons da fila do PDV na nuvem
e imprime na **térmica de rede GET** via `tcp://IP:9100`. A loja **não** fica
exposta na internet — o agente só faz conexões **de saída** pro PDV.

```
PDV (nuvem) enfileira cupom  ──▶  Agente (PC do caixa) puxa  ──▶  GET tcp:9100
```

## Pré-requisitos
- **Node 18+** no PC do caixa (https://nodejs.org).
- A impressora GET na rede com **IP fixo** (reserva de DHCP no roteador).
- No servidor (VPS), as variáveis `PRINT_MODE=queue` e `PRINT_AGENT_TOKEN=<segredo>`.

## Instalação (no PC do caixa)
1. Copie a pasta `agente-impressao` para o PC.
2. Crie o `config.json` a partir do exemplo:
   ```
   copy config.example.json config.json
   ```
3. Edite o `config.json`:
   - `pdvUrl`: a URL do seu PDV (ex.: `https://pdv.seurestaurante.com.br`)
   - `token`: **o mesmo** `PRINT_AGENT_TOKEN` configurado no servidor
   - `impressora`: `tcp://IP-DA-IMPRESSORA:9100` (ou USB, ex.: `printer:GET` no Windows)
   - `characterSet`: `WPC1252` (se acentos saírem tortos, teste `PC860_PORTUGUESE`)
4. Instale as dependências:
   ```
   npm install
   ```

## Validar antes de pôr pra rodar
- **Testar a conexão com o PDV (sem impressora):**
  ```
  npm run dry
  ```
  Ele puxa os cupons da fila e mostra no console. Se aparecer "sem conexão",
  confira `pdvUrl`/`token`/internet.
- **Testar a impressora (acentos + corte):**
  ```
  npm run teste
  ```
  Sai um cupom de teste. Se os acentos saírem tortos, troque o `characterSet`.

## Rodar em produção
```
npm start
```
Para iniciar **junto com o Windows**, crie um atalho do comando acima na pasta
de inicialização (tecla Win+R → `shell:startup`) apontando para um `.bat`:
```bat
cd /d C:\espetinho\agente-impressao
node agente.cjs
```
(ou use o **Agendador de Tarefas** / **NSSM** para rodar como serviço.)

## Como funciona a fila
- Cupom novo entra como `pendente`. O agente imprime e marca `impresso`.
- Falha (sem papel, impressora off) volta pra fila e tenta de novo, até 5x;
  depois marca `erro`. Nada se perde se o agente ficar offline um tempo.
