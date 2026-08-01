/*
 * Conferência de ambiente no boot.
 *
 * O middleware de autenticação cai num segredo de desenvolvimento quando
 * JWT_SECRET não está definida — cômodo em dev, perigoso em produção: esse
 * valor está publicado no repositório, então quem o lê consegue forjar um token
 * de GERENTE e liberar as ações de dinheiro.
 *
 * O problema não é o fallback existir, é ele passar despercebido: a API sobe
 * inteira, atende pedidos e imprime cupom, sem nada indicando que a
 * autenticação virou enfeite. Aqui a falha vira barulho no deploy.
 */
const SEGREDO_DEV = 'espetinho-dev-secret-trocar-em-producao';

// 32 caracteres é o piso; o setup-vps gera 96 (openssl rand -hex 48).
const TAMANHO_MINIMO_SEGREDO = 32;

// Devolve a lista de problemas (vazia = pode subir). Recebe o env por parâmetro
// para o teste não precisar mexer no process.env do processo inteiro.
function conferirAmbiente(env = process.env) {
  if (env.NODE_ENV !== 'production') return [];

  const problemas = [];
  const segredo = env.JWT_SECRET;

  if (!segredo) {
    problemas.push(
      'JWT_SECRET não definida. Em produção ela é obrigatória — sem ela a API ' +
        'assinaria os tokens com o segredo de desenvolvimento, que está no repositório.'
    );
  } else if (segredo === SEGREDO_DEV) {
    problemas.push(
      'JWT_SECRET está com o segredo de desenvolvimento, que é público no ' +
        'repositório. Gere um novo: openssl rand -hex 48'
    );
  } else if (segredo.length < TAMANHO_MINIMO_SEGREDO) {
    // Nunca ecoa o valor: mensagem de erro costuma parar em log e alerta.
    problemas.push(
      `JWT_SECRET curta demais (${segredo.length} caracteres; o mínimo é ` +
        `${TAMANHO_MINIMO_SEGREDO}). Gere uma nova: openssl rand -hex 48`
    );
  }

  return problemas;
}

// Aborta o boot se o ambiente não estiver apto. `sair` e `registrar` são
// injetáveis para o teste observar sem derrubar o processo do jest.
function exigirAmbienteValido(env = process.env, opcoes = {}) {
  const { sair = (codigo) => process.exit(codigo), registrar = console.error } = opcoes;

  const problemas = conferirAmbiente(env);
  if (problemas.length === 0) return;

  registrar('Configuração de produção inválida — a API não vai subir:');
  for (const problema of problemas) registrar('  - ' + problema);
  registrar('Corrija o .env.production (deploy/README.md) e reinicie o serviço.');
  sair(1);
}

module.exports = { conferirAmbiente, exigirAmbienteValido, SEGREDO_DEV };
