# Changelog

Mudanças relevantes do PDV do Espetinho do Rico.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento em [SemVer](https://semver.org/lang/pt-BR/).

## [1.5.0] — 2026-11-04

Visual novo em todo o sistema, sem mudar onde ficam os botões nem o que eles
fazem. Funciona do celular pequeno (320px) até a TV de 1920px.

### Cardápio do cliente (o que o cliente vê no celular)
- **Topo novo da loja**: logo, nome e se está **aberto agora (até que horas)**
  ou **fechado (e quando abre)**. Mostra "entrega a partir de R$ X" (a menor
  taxa dos bairros), "só retirada hoje" quando o delivery está pausado, o
  endereço com link para o Google Maps e um botão de WhatsApp.
- **Cardápio inteiro numa lista só**, com os nomes das categorias. A barra de
  categorias fica presa no topo ao rolar e mostra em qual o cliente está;
  tocar numa categoria leva até ela. A busca procura no cardápio todo.
- **Botão "+" vira "− 2 +"** na própria linha do produto. Com 1 unidade, o
  "−" vira lixeira.
- **Sacola numa barra só** ("3 · Ver sacola · R$ 24,00"). Ela abre por baixo,
  com os itens, as observações e o botão **Avançar para a entrega**.
- **Finalizar pedido**: resumo do pedido no topo, taxa de entrega que já
  aparece ao escolher o bairro, e o aviso de erro **ao lado do campo** que
  falta (nome, telefone, endereço, bairro, pagamento). O celular sugere nome,
  telefone e endereço sozinho.
- **No computador**, o cardápio fica com a sacola fixa ao lado, e o
  checkout com o resumo à direita.

### Delivery e balcão (tela mais usada do caixa)
- Corrigido: **a tela "passava da borda" no celular** e precisava arrastar
  para o lado.
- **Pedido online novo vira uma faixa** com Aceitar e Recusar, em vez de uma
  caixa grande.
- **Venda rápida, Delivery, Balcão e Em andamento** num controle só, com a
  contagem de pedidos em andamento. No celular aparece como "Rápida" e "Fila".
  Em andamento mostra os pedidos de delivery, balcão e venda rápida (mesa não
  entra).
- **No celular, o carrinho vira uma barra embaixo** ("3 itens · R$ 34,00 ·
  Revisar e enviar") que abre o formulário e o botão de enviar.
- **No notebook do caixa**, produtos à esquerda e o carrinho fixo à direita.
  Em telas bem largas (1536px ou mais), uma terceira coluna com os pedidos em
  andamento.
- **Nomes de produto inteiros** (antes, a 1024 e 1366px, todos apareciam como
  "Espeto ...").
- Card de pedido com **Pix, Dinheiro e Cartão numa linha própria**, e
  imprimir/cancelar como ícones.
- Os três quadros do topo (em andamento, novos online, em aberto) saíram: a
  contagem foi para o controle, os pedidos online viraram faixas e o total em
  aberto aparece em cima da lista de em andamento.

### Navegação
- **No celular**: Salão, Delivery, Cozinha e Caixa fixos embaixo, e um botão
  **Mais** com Financeiro, Equipe, Cardápio, Impressão e Garçom. O garçom vê
  só o que usa. Antes, 4 das 9 telas ficavam escondidas numa rolagem lateral.
- Botões do topo viram ícones no celular (o nome aparece ao segurar e para
  leitor de tela).

### Salão e garçom
- **Card de mesa sempre do mesmo tamanho**, com o número sempre no mesmo
  lugar, com ou sem consumo. Status curto: **Livre, Ocupada, Conta** (a conta
  pedida agora em amarelo, igual à legenda).
- Mesa com **taxa de serviço** mostra **10%** no card.
- Celular: 2 colunas de mesas até nas telas pequenas.

### Cozinha
- Corrigido: **o pedido mais novo aparecia em cima.** Agora cada coluna vai do
  mais antigo para o mais novo, na ordem de chegada.
- **Letra maior para ler de longe** (20px no tablet), quantidade destacada e
  observação em amarelo.
- Selo **"Pago · venda rápida"** nos pedidos que já foram pagos no balcão.
- Em telas de 1280px ou mais, **três colunas**: fila, na chapa e a
  continuação da fila.

### Financeiro e caixa
- Gráfico da semana com **o valor em cima de cada barra** ("R$ 1,2 mil") e o
  dia embaixo.
- No celular, os indicadores (dia, 7 dias, mês) ficam lado a lado.
- **Nomes inteiros** em "Vendas por atendente" e "Mais vendidos" (antes até
  "Davi" aparecia cortado no celular).
- Caixa: o botão **Fechar caixa** desabilitado agora diz por quê ("Informe o
  valor contado para fechar"). Sangria aparece com "−" em vermelho e
  suprimento com "+" em verde.

### Equipe, cardápio e impressão
- **Equipe no celular** em cartões, com Novo PIN e Desligar à mão (antes as
  colunas de status e ações ficavam escondidas). Ao escolher **Gerente**, o
  cadastro avisa que o PIN tem 6 dígitos.
- **Cardápio (gerente)** no celular em linhas compactas, com um menu "⋯" para
  Editar e Esgotou. **Novo produto** abre um painel em vez de ficar fixo no
  topo da tela.
- **Impressão**: cupom com erro mostra o selo vermelho e o **Reimprimir** ao
  lado. Os tipos aparecem certos: Cupom, Pré-conta, Fechamento, Teste.

### Login
- Fundo mais limpo (sem o logo grande desfocado).
- Os pontos mostram **quantos dígitos você já digitou**, sem fixar 4 ou 6.
- PIN errado: aparece **"PIN não reconhecido"** e o campo dá uma leve tremida.

### Para todo o sistema
- **Acentos corrigidos** em todos os textos (Salão, Balcão, Garçom, Cardápio,
  Cartão, Observação, Endereço...). Plural certo ("1 item", "3 itens").
- **Datas no formato dd/mm** (o Financeiro mostrava "2026-10-27 ate ...").
- **Botões e campos de no mínimo 44px** no celular e no tablet: menos toque
  errado no corre. Nenhum texto menor que 12px.
- **Contraste** melhor em textos secundários, campos e botões desabilitados.
- **Fontes da loja embutidas no app**: funcionam no APK sem internet e a tela
  abre mais rápido.
- Rótulos sem CAIXA ALTA.

### Interno
- Auditoria visual automática (`npm run auditoria:visual`): 939 problemas
  antes, 0 depois, em 11 telas e 7 larguras.
- Componentes base em `frontend/src/ui` (Botao, Campo, Selo, Segmentado,
  Sheet, AcaoTopo).
- Teste do limite global de login deixou de falhar às vezes em máquina lenta.
- `cenario-demo.js` usava um status de mesa que a API recusa; corrigido.

## [1.4.0]

### Operação do balcão
- **Venda rápida no balcão** (gerente): só itens + forma de pagamento, sem
  cadastrar cliente. O pagamento entra na hora no caixa do turno; em dinheiro,
  o "valor recebido" calcula o troco. A comanda vai pra chapa e o pedido fecha
  sozinho como pago quando sair "entregue". "Entregue na hora" (ex.: só
  bebida) não imprime nem passa pela cozinha. Cancelar gera estorno negativo
  na mesma forma — o pagamento original nunca é apagado.
- **Pausar delivery** (gerente): botão na tela Delivery/Balcão. Pausado, o
  cardápio online mostra só retirada e a API recusa entrega (vale mesmo com a
  página do cliente aberta antes da pausa). Fica gravado no banco, sobrevive a
  restart e vai para a auditoria.
- Corrigido: **entrega saía de graça** quando o cliente não escolhia o bairro.
  Agora, com a lista de bairros configurada, o pedido de entrega só passa com
  um bairro da lista — e a taxa é sempre a desse bairro.
- Corrigido: **loja aparecia fechada na madrugada do próprio turno.** Num
  horário como 17:00 às 02:00, à 01:00 de domingo o cardápio dizia "fechado"
  (o turno é de sábado) — e na terça à 01:00 dizia "aberto", embora segunda
  não abra. O horário também passou a seguir o relógio do Ceará.
- Corrigido: tirar item de uma comanda **no mesmo instante em que ela era
  paga** mexia no total de um pedido já fechado. Agora a remoção é recusada e
  o gerente vê a comanda como ficou.
- **Gerente usa PIN de 6 dígitos.** Cadastro, "novo PIN" e "trocar meu PIN"
  de gerente exigem 6 dígitos. Gerente que ainda tem PIN de 4 continua
  entrando normalmente, mas vê um aviso pedindo a troca (Equipe → Trocar meu
  PIN). Garçom continua com 4.
- **Acompanhar pedido online por link próprio.** O cliente acompanha pelo
  código que recebe ao pedir, não mais pelo número do pedido. Pedidos feitos
  antes desta versão continuam na lista "Meus pedidos", só sem o status ao
  vivo.
- Cardápio online com título e dados da loja (endereço, tipo de comida) que o
  Google entende — ajuda a aparecer na busca por "espetinho em Jaguaruana".
- **Campainha de pedido online**: quando entra pedido pelo cardápio, toca um
  "din-don" e aparece aviso em QUALQUER tela do PDV — ninguém mais precisa
  vigiar a aba Delivery. (O som destrava no primeiro toque na tela, exigência
  dos navegadores.)
- **Remover só uma unidade**: em "3x carne", o gerente agora escolhe entre
  tirar 1 (−1) ou o item inteiro — antes só dava para remover os 3 e relançar.
- **Pré-conta agrupada**: cerveja pedida em 3 rodadas sai como "5x Cerveja"
  numa linha só — o cliente confere de uma olhada. Preços congelados
  diferentes (reajuste no meio do consumo) não se misturam.
- **Cards com entrada animada**: pedido novo desliza e o online pulsa uma vez
  (anel verde) — o olho do operador vai direto no que mudou. Como a animação
  só roda em card recém-montado, quem já estava na tela não pisca.
- Corrigido: o campo `tipo` do detalhe dos eventos SSE sobrescrevia o NOME do
  evento (pedido_criado virava "DELIVERY") — filtros por tipo nunca casavam.

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
- **Funcionário desligado perde o acesso na hora.** Antes, quem já estava
  logado continuava usando o PDV até o fim do turno (até 12h). Agora o
  sistema confere a cada poucos segundos se o funcionário segue ativo, e o
  desligamento corta o acesso dele imediatamente.
- **Login não trava mais o sistema.** A conferência do PIN deixou de
  "congelar" o servidor a cada tentativa — uma enxurrada de PINs errados não
  derruba mais o caixa e a cozinha. Os PINs atuais continuam valendo.
- **Bloqueio contra ataque de vários endereços ao mesmo tempo.** Além do
  bloqueio por aparelho, se o sistema receber mais de 30 PINs errados em um
  minuto (somando todos), o login fica pausado por 1 minuto para endereços
  desconhecidos. Os aparelhos e o Wi-Fi da loja que fizeram login nos
  últimos 7 dias continuam entrando normalmente, e quem já está logado não é
  afetado.
- **Tablet/celular não guarda mais dados do caixa depois do logout.** O app
  guardava no aparelho respostas como caixa e pedidos para usar sem internet;
  agora só o cardápio público fica guardado, e sair do PDV apaga o que havia
  ficado das versões anteriores. Cada aparelho precisa recarregar o app uma
  vez após a atualização.
- **Ninguém consegue mais somar o faturamento online pelo acompanhamento.**
  O número do pedido era sequencial: bastava testar 1, 2, 3... para ver o
  valor de cada pedido. O código de acompanhamento novo é impossível de
  adivinhar.
- **Anti-spam do cardápio online não é mais burlável** trocando um cabeçalho
  da requisição (o mesmo furo que já tinha sido fechado no login).
- **Textos gigantes são recusados**: nome (até 60 letras), telefone (20),
  endereço e motivo de cancelamento/recusa (200). Evita travar a impressora
  e encher o banco com lixo.
- O tempo real (avisos de "algo mudou") tem teto de conexões por endereço,
  folgado o bastante para todos os aparelhos da loja no mesmo Wi-Fi.
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
