const AppError = require('../errors/AppError');
const logger = require('../lib/logger');

// Middleware global de erros — último da cadeia.
// Express 5 encaminha automaticamente rejeições de handlers async para cá,
// então nenhum erro (síncrono ou assíncrono) derruba o processo.
function errorHandler(err, req, res, next) {
  // Erros operacionais lançados pela aplicação
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ erro: err.message });
  }

  // Corpo JSON malformado (lançado pelo express.json)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON malformado no corpo da requisição' });
  }

  // Origem bloqueada pelo CORS
  if (err.message === 'Origem não permitida pelo CORS') {
    return res.status(403).json({ erro: 'Origem não permitida' });
  }

  // Erros conhecidos do Prisma
  if (err.code === 'P2025') {
    return res.status(404).json({ erro: 'Registro não encontrado' });
  }
  if (err.code === 'P2003') {
    return res.status(409).json({ erro: 'Operação viola vínculo com outros registros' });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ erro: 'Registro duplicado: valor único já existe' });
  }

  // Inesperado: loga o detalhe no servidor, responde genérico ao cliente
  logger.erro('erro não tratado', {
    rota: `${req.method} ${req.originalUrl}`,
    erro: err.message,
    stack: err.stack,
  });
  return res.status(500).json({ erro: 'Erro interno do servidor' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ erro: `Rota ${req.method} ${req.originalUrl} não existe` });
}

module.exports = { errorHandler, notFoundHandler };
