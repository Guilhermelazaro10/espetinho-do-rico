const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const auditoriaService = require('./auditoriaService');
const { publicar } = require('../lib/eventos');

/*
 * Configurações operacionais que o gerente muda pelo app, sem deploy.
 *
 * Diferente do loja.js (variáveis de ambiente, mudam só com restart), isto é
 * estado do dia a dia: "hoje não tem entregador". Fica no banco para
 * sobreviver a restart e entrar no backup do Litestream.
 *
 * Cache em memória: o cardápio público lê isso a cada acesso. Instância única
 * (VPS / Electron / LAN), então o cache é sempre coerente com a escrita.
 */
const CHAVES = Object.freeze({ DELIVERY_ATIVO: 'delivery_ativo' });

const cache = new Map();

async function ler(chave, padrao) {
  if (cache.has(chave)) return cache.get(chave);
  const linha = await prisma.configuracao.findUnique({ where: { chave } });
  const valor = linha ? linha.valor : padrao;
  cache.set(chave, valor);
  return valor;
}

async function gravar(chave, valor) {
  await prisma.configuracao.upsert({
    where: { chave },
    create: { chave, valor },
    update: { valor },
  });
  cache.set(chave, valor);
}

// Delivery nasce ATIVO: instalação nova (sem linha no banco) segue como antes.
async function deliveryAtivo() {
  return (await ler(CHAVES.DELIVERY_ATIVO, 'true')) === 'true';
}

async function definirDelivery(ativo, usuario) {
  if (typeof ativo !== 'boolean') {
    throw new AppError('Informe ativo: true (delivery ligado) ou false (só retirada)');
  }
  await gravar(CHAVES.DELIVERY_ATIVO, String(ativo));

  auditoriaService.registrar(
    usuario,
    ativo ? 'delivery_reativado' : 'delivery_pausado',
    ativo ? 'Delivery reativado no cardápio online' : 'Delivery pausado — cardápio online só aceita retirada'
  );
  publicar('loja', { deliveryAtivo: ativo });
  return { deliveryAtivo: ativo };
}

// Para os testes não vazarem estado entre suítes
function _limparCache() {
  cache.clear();
}

module.exports = { deliveryAtivo, definirDelivery, _limparCache };
