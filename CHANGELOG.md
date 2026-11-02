# Changelog

Mudanças relevantes do PDV do Espetinho do Rico.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento em [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

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
