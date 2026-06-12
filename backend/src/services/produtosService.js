const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const { publicar } = require('../lib/eventos');

function validarDados({ nome, preco, categoria }) {
  if (!nome || typeof nome !== 'string' || !nome.trim()) {
    throw new AppError('Nome do produto é obrigatório');
  }
  // Preço em CENTAVOS: inteiro positivo (R$ 12,00 = 1200)
  if (!Number.isInteger(preco) || preco <= 0) {
    throw new AppError('Preço deve ser um inteiro em centavos maior que zero');
  }
  if (!categoria || typeof categoria !== 'string' || !categoria.trim()) {
    throw new AppError('Categoria do produto é obrigatória');
  }
  return { nome: nome.trim(), preco, categoria: categoria.trim() };
}

// Por padrão só produtos ativos (cardápio); gestão pede incluirInativos
async function listar({ incluirInativos = false } = {}) {
  return prisma.produto.findMany({
    where: incluirInativos ? undefined : { ativo: true },
    orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
  });
}

async function buscarPorId(id) {
  const produto = await prisma.produto.findUnique({ where: { id } });
  if (!produto) throw new AppError('Produto não encontrado', 404);
  return produto;
}

async function criar(dados) {
  const produto = await prisma.produto.create({ data: validarDados(dados) });
  publicar('cardapio');
  return produto;
}

async function atualizar(id, dados) {
  await buscarPorId(id);
  const produto = await prisma.produto.update({ where: { id }, data: validarDados(dados) });
  publicar('cardapio');
  return produto;
}

// SOFT DELETE: nunca apaga a linha — vendas passadas continuam íntegras
// nos relatórios; o produto apenas some do cardápio.
async function desativar(id) {
  const produto = await buscarPorId(id);
  if (!produto.ativo) throw new AppError('Produto já está inativo', 409);
  const atualizado = await prisma.produto.update({ where: { id }, data: { ativo: false } });
  publicar('cardapio');
  return atualizado;
}

async function reativar(id) {
  await buscarPorId(id);
  const atualizado = await prisma.produto.update({ where: { id }, data: { ativo: true } });
  publicar('cardapio');
  return atualizado;
}

module.exports = { listar, buscarPorId, criar, atualizar, desativar, reativar };
