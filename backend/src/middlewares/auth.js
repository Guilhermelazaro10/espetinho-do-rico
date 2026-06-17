const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const AppError = require('../errors/AppError');
const { PAPEIS } = require('../constantes');

const SEGREDO = process.env.JWT_SECRET || 'espetinho-dev-secret-trocar-em-producao';
const VALIDADE = '12h'; // um turno de trabalho

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nome: usuario.nome, papel: usuario.papel },
    SEGREDO,
    { expiresIn: VALIDADE }
  );
}

// Exige token válido; anexa req.usuario {id, nome, papel}
function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization;
  const token = cabecalho?.startsWith('Bearer ') ? cabecalho.slice(7) : null;
  if (!token) throw new AppError('Autenticação necessária', 401);
  try {
    req.usuario = jwt.verify(token, SEGREDO);
  } catch {
    throw new AppError('Sessão inválida ou expirada', 401);
  }
  next();
}

// Restringe a rota a determinados papéis (GERENTE sempre passa)
function exigirPapel(...papeis) {
  return (req, res, next) => {
    const papel = req.usuario?.papel;
    if (papel !== PAPEIS.GERENTE && !papeis.includes(papel)) {
      throw new AppError('Permissão insuficiente para esta ação', 403);
    }
    next();
  };
}

// Atalho semântico para as rotas exclusivas do gerente (pagamentos, RH, financeiro)
const somenteGerente = exigirPapel();

// Comparação de tokens em tempo constante (evita timing attack no segredo)
function tokensIguais(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Autenticação do AGENTE de impressão (máquina, não usuário): token fixo
// compartilhado via PRINT_AGENT_TOKEN no backend e no agente.
function autenticarAgente(req, res, next) {
  const esperado = process.env.PRINT_AGENT_TOKEN;
  if (!esperado) throw new AppError('Fila de impressão não configurada no servidor', 503);
  const cabecalho = req.headers.authorization;
  const token = cabecalho?.startsWith('Bearer ') ? cabecalho.slice(7) : null;
  if (!token || !tokensIguais(token, esperado)) {
    throw new AppError('Agente de impressão não autorizado', 401);
  }
  next();
}

module.exports = { gerarToken, autenticar, exigirPapel, somenteGerente, autenticarAgente };
