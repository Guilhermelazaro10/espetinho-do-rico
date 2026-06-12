const jwt = require('jsonwebtoken');
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

module.exports = { gerarToken, autenticar, exigirPapel, somenteGerente };
