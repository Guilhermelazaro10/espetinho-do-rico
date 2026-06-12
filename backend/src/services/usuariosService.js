const crypto = require('crypto');
const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const auditoriaService = require('./auditoriaService');
const { gerarHashPin, verificarPin } = require('../lib/pin');
const { PAPEIS } = require('../constantes');

// RH — cadastro de equipe com geração de PIN de 4 dígitos.
// O PIN é exibido UMA única vez na criação; no banco só existe o hash.

async function listar() {
  return prisma.usuario.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    select: { id: true, nome: true, papel: true, ativo: true }, // nunca expõe pinHash
  });
}

// Gera PIN que não colide com nenhum usuário ativo (login é só por PIN)
function validarTamanhoPin(tamanhoPin = 4) {
  const tamanho = Number(tamanhoPin);
  if (!Number.isInteger(tamanho) || tamanho < 4 || tamanho > 6) {
    throw new AppError('PIN deve ter entre 4 e 6 digitos');
  }
  return tamanho;
}

async function gerarPinLivre(usuarios, tamanho = 4) {
  const limite = 10 ** tamanho;
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const pin = String(crypto.randomInt(0, limite)).padStart(tamanho, '0');
    const colide = usuarios.some((u) => u.ativo && verificarPin(pin, u.pinHash));
    if (!colide) return pin;
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

  const tamanho = validarTamanhoPin(tamanhoPin);
  const existentes = await prisma.usuario.findMany();
  const pin = await gerarPinLivre(existentes, tamanho);

  const criado = await prisma.usuario.create({
    data: { nome: nome.trim(), papel: papelFinal, pinHash: gerarHashPin(pin) },
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
  const pin = await gerarPinLivre(existentes);
  await prisma.usuario.update({ where: { id }, data: { pinHash: gerarHashPin(pin) } });

  auditoriaService.registrar(
    usuarioLogado,
    'novo_pin_funcionario',
    `Novo PIN gerado para ${usuario.nome}`
  );
  return { id, nome: usuario.nome, pin };
}

module.exports = { listar, criar, desativar, regerarPin };
