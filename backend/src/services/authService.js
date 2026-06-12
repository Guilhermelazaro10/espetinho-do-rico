const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const { verificarPin } = require('../lib/pin');
const { gerarToken } = require('../middlewares/auth');

async function loginComPin(pin) {
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
    throw new AppError('Informe um PIN de 4 a 6 dígitos');
  }
  // Funcionário desligado (soft delete) tem o PIN automaticamente revogado
  const usuarios = await prisma.usuario.findMany({ where: { ativo: true } });
  const usuario = usuarios.find((u) => verificarPin(pin, u.pinHash));
  if (!usuario) throw new AppError('PIN não reconhecido', 401);

  return {
    token: gerarToken(usuario),
    usuario: { id: usuario.id, nome: usuario.nome, papel: usuario.papel },
  };
}

module.exports = { loginComPin };
