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

## Velocidade da impressão (entrega imediata)

O agente **não** fica perguntando de tempos em tempos se há cupom novo: ele
deixa a requisição pendurada e o servidor responde no instante em que o cupom
entra na fila. Medido em bancada, do clique até os dados chegarem na
impressora: **~1,6 s antes → ~46 ms agora**.

Ajustes no `config.json` (raramente necessários):

| Campo | Padrão | Para que serve |
|---|---|---|
| `esperaMs` | `25000` | Quanto o servidor pode segurar a resposta esperando cupom. `0` desliga a entrega imediata e volta a só perguntar. |
| `intervaloMs` | `2000` | Pausa entre tentativas **quando o PDV está fora do ar** ou é uma versão antiga sem entrega imediata. |

Se o cupom voltar a demorar, confira nesta ordem:
1. `esperaMs` está `0` no `config.json`? Coloque `25000`.
2. O PDV está atualizado? Versão antiga ignora a entrega imediata e o agente
   cai no `intervaloMs` (2 s) — sem quebrar nada, só mais lento.
3. A impressora responde? Se o IP não responder, o agente **varre a rede**
   antes de imprimir, e isso custa alguns segundos.

## Se o agente não achar a impressora

Ele varre só as faixas **privadas** (`10.x`, `172.16-31.x`, `192.168.x`) e faz
duas passadas — a segunda mais paciente, para rede Wi-Fi lenta. Achando, grava
o IP no `config.json` e nas próximas vezes é instantâneo. Se ainda assim falhar:

1. **Descubra o IP pela impressora:** ligue-a segurando o botão de avanço de
   papel. Sai a auto-teste com `[Current Network]` e o IP dela.
2. Confirme que esse IP está na **mesma faixa** do PC (`ipconfig`). Se a
   impressora estiver em `192.168.0.x` e o PC em `192.168.1.x`, elas não se
   enxergam — é caso de mexer no roteador, não no agente.
3. Como último recurso, fixe no `config.json`:
   `"impressora": "tcp://192.168.1.81:9100"`.

> **Dica:** o IP vem por DHCP e pode mudar sozinho. Crie uma **reserva** no
> roteador para o MAC da impressora (aparece na auto-teste) e ele nunca muda.
