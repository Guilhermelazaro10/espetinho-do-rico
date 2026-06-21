# Agente de Impressão — Espetinho do Rico

Roda no **PC do caixa** (sempre ligado). Puxa os cupons da fila do PDV na nuvem
e imprime na **térmica de rede GET** via `tcp://IP:9100`, com a **logo** no topo.
A loja **não** fica exposta na internet — o agente só faz conexões **de saída**.

```
PDV (nuvem) enfileira cupom  ──▶  Agente (PC do caixa) puxa  ──▶  GET tcp:9100
```

## Pré-requisitos
- **Node 18+** no PC do caixa (https://nodejs.org).
- A impressora GET ligada no **cabo de rede** (mesmo roteador do PC).
- No servidor (VPS): `PRINT_MODE=queue` e `PRINT_AGENT_TOKEN=<segredo>`.

## Instalação (no PC do caixa)
1. Copie a pasta `agente-impressao` para o PC (ex.: `C:\espetinho\agente-impressao`).
2. Crie o `config.json` a partir do exemplo (`copy config.example.json config.json`)
   e preencha só **2 campos**:
   - `pdvUrl`: `https://espetinhodorico.com`
   - `token`: o **PRINT_AGENT_TOKEN** do servidor
   > O `impressora` pode ficar como **`"auto"`**: o agente **acha o IP da
   > impressora sozinho** varrendo a rede (porta 9100) e grava no config.

## Ligar (escolha um)
- **Iniciar automático com o Windows (recomendado):** dê **2 cliques** em
  **`instalar-inicio-automatico.bat`**. Ele instala as dependências, configura o
  agente para subir sozinho toda vez que o PC ligar (em segundo plano, sem janela)
  e já inicia agora. **Nunca mais precisa abrir terminal.**
  - Para desfazer: `remover-inicio-automatico.bat`.
- **Iniciar na mão (pra testar):** 2 cliques em **`iniciar-impressao.bat`**
  (abre uma janelinha; pode minimizar).

## Testar
- **Conexão com o PDV (sem impressora):** `node agente.cjs --dry`
- **Impressora + logo + acentos:** `node agente.cjs --teste`
  - Sai um cupom com a **logo** e um texto de teste. Se os acentos saírem tortos,
    troque no `config.json` o `characterSet` de `WPC1252` para `PC860_PORTUGUESE`.

## Logo
- A imagem é a `logo.png` desta pasta (já vem pronta, 384 px, otimizada p/ térmica).
- Para trocar: substitua o arquivo `logo.png` (de preferência ~384 px de largura,
  alto contraste). O backend marca onde a logo entra; o agente desenha a imagem.

## Como funciona a fila
- Cupom novo entra como `pendente`. O agente imprime e marca `impresso`.
- Falha (sem papel, impressora off) volta pra fila e tenta de novo, até 5x;
  depois marca `erro`. Nada se perde se o agente ficar offline um tempo.
- Se o IP da impressora mudar, o agente **redescobre sozinho** na próxima impressão.
