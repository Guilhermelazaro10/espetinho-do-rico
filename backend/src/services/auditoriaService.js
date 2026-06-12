const prisma = require('../lib/prisma');
const logger = require('../lib/logger');

// Registro de auditoria de ações sensíveis. Nunca falha o fluxo principal:
// auditoria indisponível vira log de erro, não exceção.
async function registrar(usuario, acao, detalhe) {
  const quem = usuario ? `${usuario.nome} (${usuario.papel})` : 'sistema';
  try {
    await prisma.auditoria.create({ data: { usuario: quem, acao, detalhe } });
  } catch (erro) {
    logger.erro('falha ao gravar auditoria', { acao, detalhe, erro: erro.message });
  }
}

async function listar({ limite = 100 } = {}) {
  return prisma.auditoria.findMany({
    orderBy: { criadoEm: 'desc' },
    take: Math.min(Number(limite) || 100, 500),
  });
}

module.exports = { registrar, listar };
