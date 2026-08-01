/*
 * Ambiente fixo para os testes — roda ANTES de qualquer módulo ser carregado.
 *
 * Por que existe: `@prisma/client` carrega o `backend/.env` no momento em que é
 * importado. Como `helpers/token.js` lê o segredo no topo do arquivo, um teste
 * que NÃO mocka o Prisma acabava assinando o token com o segredo de
 * desenvolvimento e conferindo com o do `.env` — dois valores diferentes, e a
 * requisição voltava 401 sem nada de errado no código de produção.
 *
 * Pior: só quebrava na máquina de quem tem `.env` (ele é gitignored), então a
 * CI ficava verde e o time via falha local. Fixar aqui torna o resultado igual
 * em qualquer máquina, independente da ordem em que os módulos carregam.
 */
process.env.JWT_SECRET = 'segredo-fixo-para-os-testes-nao-usar-em-producao';
