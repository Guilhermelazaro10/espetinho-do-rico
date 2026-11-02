const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const { verificarPin } = require('../lib/pin');
const { gerarToken } = require('../middlewares/auth');
const { PAPEIS, TAMANHO_PIN_GERENTE } = require('../constantes');

async function loginComPin(pin) {
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
    throw new AppError('Informe um PIN de 4 a 6 dígitos');
  }
  // Funcionário desligado (soft delete) tem o PIN automaticamente revogado
  const usuarios = await prisma.usuario.findMany({ where: { ativo: true } });
  const confere = await Promise.all(usuarios.map((u) => verificarPin(pin, u.pinHash)));
  const usuario = usuarios.find((_, i) => confere[i]);
  if (!usuario) throw new AppError('PIN não reconhecido', 401);

  const resposta = {
    token: gerarToken(usuario),
    usuario: { id: usuario.id, nome: usuario.nome, papel: usuario.papel },
  };
  // Gerente antigo com PIN curto não é barrado (travaria a loja), só avisado
  if (usuario.papel === PAPEIS.GERENTE && pin.length < TAMANHO_PIN_GERENTE) {
    resposta.avisoPinCurto = true;
  }
  return resposta;
}

module.exports = { loginComPin };
