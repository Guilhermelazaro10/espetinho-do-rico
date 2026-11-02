const crypto = require('crypto');
const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const auditoriaService = require('./auditoriaService');
const { gerarHashPin, verificarPin } = require('../lib/pin');
const { PAPEIS, TAMANHO_PIN_GERENTE } = require('../constantes');
const { invalidarUsuario } = require('../middlewares/auth');

// RH — cadastro de equipe com geração de PIN (4 a 6 dígitos; gerente sempre 6).
// O PIN é exibido UMA única vez na criação; no banco só existe o hash.

async function listar() {
  return prisma.usuario.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    select: { id: true, nome: true, papel: true, ativo: true }, // nunca expõe pinHash
  });
}

function validarTamanhoPin(tamanhoPin, papel) {
  if (papel === PAPEIS.GERENTE) {
    if (tamanhoPin != null && Number(tamanhoPin) !== TAMANHO_PIN_GERENTE) {
      throw new AppError(`PIN de gerente deve ter ${TAMANHO_PIN_GERENTE} digitos`);
    }
    return TAMANHO_PIN_GERENTE;
  }
  const tamanho = Number(tamanhoPin ?? 4);
  if (!Number.isInteger(tamanho) || tamanho < 4 || tamanho > 6) {
    throw new AppError('PIN deve ter entre 4 e 6 digitos');
  }
  return tamanho;
}

async function algumConfere(pin, usuarios) {
  const confere = await Promise.all(usuarios.map((u) => verificarPin(pin, u.pinHash)));
  return confere.some(Boolean);
}

// Gera PIN que não colide com nenhum usuário ativo (login é só por PIN)
async function gerarPinLivre(usuarios, tamanho = 4) {
  const limite = 10 ** tamanho;
  const ativos = usuarios.filter((u) => u.ativo);
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const pin = String(crypto.randomInt(0, limite)).padStart(tamanho, '0');
    if (!(await algumConfere(pin, ativos))) return pin;
  }
  throw new AppError('Não foi possível gerar um PIN único — tente novamente', 500);
}

async function criar({ nome, papel, tamanhoPin }, usuarioLogado) {
  if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
    throw new AppError('Nome do funcionário é obrigatório');
  }
  const papelFinal = papel ?? PAPEIS.GARCOM;
  if (!Object.values(PAPEIS).includes(papelFinal)) {
    throw new AppError(`Papel inválido. Use: ${Object.values(PAPEIS).join(', ')}`);
  }

  const tamanho = validarTamanhoPin(tamanhoPin, papelFinal);
  const existentes = await prisma.usuario.findMany();
  const pin = await gerarPinLivre(existentes, tamanho);

  const criado = await prisma.usuario.create({
    data: { nome: nome.trim(), papel: papelFinal, pinHash: await gerarHashPin(pin) },
  });

  auditoriaService.registrar(
    usuarioLogado,
    'cadastro_funcionario',
    `${criado.nome} (${criado.papel}) cadastrado`
  );

  // O PIN em claro só existe nesta resposta
  return { id: criado.id, nome: criado.nome, papel: criado.papel, ativo: criado.ativo, pin };
}

// Desligamento é soft delete: preserva auditoria e histórico
async function desativar(id, usuarioLogado) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw new AppError('Funcionário não encontrado', 404);
  if (!usuario.ativo) throw new AppError('Funcionário já está desligado', 409);
  if (usuario.id === usuarioLogado?.id) {
    throw new AppError('Você não pode desligar a si mesmo', 409);
  }

  await prisma.usuario.update({ where: { id }, data: { ativo: false } });
  invalidarUsuario(id); // corta o token dele já na próxima requisição
  auditoriaService.registrar(
    usuarioLogado,
    'desligamento_funcionario',
    `${usuario.nome} (${usuario.papel}) desligado — PIN revogado`
  );
}

// Novo PIN para funcionário ativo (esqueceu o PIN)
async function regerarPin(id, usuarioLogado) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario || !usuario.ativo) throw new AppError('Funcionário não encontrado', 404);

  const existentes = await prisma.usuario.findMany({ where: { id: { not: id } } });
  const tamanho = usuario.papel === PAPEIS.GERENTE ? TAMANHO_PIN_GERENTE : 4;
  const pin = await gerarPinLivre(existentes, tamanho);
  await prisma.usuario.update({ where: { id }, data: { pinHash: await gerarHashPin(pin) } });

  auditoriaService.registrar(
    usuarioLogado,
    'novo_pin_funcionario',
    `Novo PIN gerado para ${usuario.nome}`
  );
  return { id, nome: usuario.nome, pin };
}

// Troca do próprio PIN (qualquer usuário autenticado), validando o PIN atual
async function trocarPin(usuarioLogado, pinAtual, pinNovo) {
  if (!/^\d{4,6}$/.test(String(pinNovo ?? ''))) {
    throw new AppError('Novo PIN deve ter de 4 a 6 dígitos');
  }
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioLogado.id } });
  if (!usuario || !usuario.ativo) throw new AppError('Usuário não encontrado', 404);
  if (usuario.papel === PAPEIS.GERENTE && String(pinNovo).length !== TAMANHO_PIN_GERENTE) {
    throw new AppError(`PIN de gerente deve ter ${TAMANHO_PIN_GERENTE} digitos`);
  }
  if (!(await verificarPin(String(pinAtual ?? ''), usuario.pinHash))) {
    throw new AppError('PIN atual incorreto', 401);
  }
  // Login é só por PIN: precisa continuar único entre os ativos
  const outros = await prisma.usuario.findMany({ where: { ativo: true, id: { not: usuario.id } } });
  if (await algumConfere(String(pinNovo), outros)) {
    throw new AppError('Esse PIN já está em uso por outro funcionário');
  }
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { pinHash: await gerarHashPin(String(pinNovo)) },
  });
  auditoriaService.registrar(usuarioLogado, 'troca_pin', `${usuario.nome} trocou o próprio PIN`);
}

module.exports = { listar, criar, desativar, regerarPin, trocarPin };
