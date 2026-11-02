const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const AppError = require('../errors/AppError');
const prisma = require('../lib/prisma');
const { PAPEIS } = require('../constantes');

// O fallback vem de lib/ambiente porque é lá que ele é BARRADO em produção.
// Duplicar a string faria a barreira parar de valer no dia em que uma das duas
// cópias mudasse — e o boot passaria com o segredo público.
const { SEGREDO_DEV } = require('../lib/ambiente');

const SEGREDO = process.env.JWT_SECRET || SEGREDO_DEV;
const VALIDADE = '12h'; // um turno de trabalho

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nome: usuario.nome, papel: usuario.papel },
    SEGREDO,
    { expiresIn: VALIDADE }
  );
}

// O JWT vale um turno inteiro: sem conferir o banco, funcionário desligado
// seguiria com acesso por até 12h. Cache curto por id para não consultar o
// banco a cada requisição; desligar invalida a entrada na hora.
const CACHE_ATIVO_MS = 30 * 1000;
const cacheAtivo = new Map(); // id -> { ativo, ate }

async function usuarioAtivo(id) {
  const agora = Date.now();
  const guardado = cacheAtivo.get(id);
  if (guardado && agora < guardado.ate) return guardado.ativo;
  const usuario = await prisma.usuario.findUnique({ where: { id }, select: { ativo: true } });
  const ativo = Boolean(usuario?.ativo);
  cacheAtivo.set(id, { ativo, ate: agora + CACHE_ATIVO_MS });
  return ativo;
}

function invalidarUsuario(id) {
  cacheAtivo.delete(id);
}

// Exige token válido de usuário ainda ativo; anexa req.usuario {id, nome, papel}
async function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization;
  const token = cabecalho?.startsWith('Bearer ') ? cabecalho.slice(7) : null;
  if (!token) throw new AppError('Autenticação necessária', 401);
  let usuario;
  try {
    usuario = jwt.verify(token, SEGREDO);
  } catch {
    throw new AppError('Sessão inválida ou expirada', 401);
  }
  if (!Number.isInteger(usuario?.id) || !(await usuarioAtivo(usuario.id))) {
    throw new AppError('Sessão inválida ou expirada', 401);
  }
  req.usuario = usuario;
  next();
}

// Para os testes não vazarem estado entre suítes
function _limparCacheUsuarios() {
  cacheAtivo.clear();
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

module.exports = {
  gerarToken,
  autenticar,
  exigirPapel,
  somenteGerente,
  autenticarAgente,
  invalidarUsuario,
  _limparCacheUsuarios,
};
