const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const { STATUS_PEDIDO_EM_ABERTO } = require('../constantes');

// Fonte de verdade da gaveta: tabela `pagamentos` (valores líquidos,
// troco já descontado, parciais incluídos).

function inicioDoDia(data = new Date()) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function intervaloDoPeriodo(periodo) {
  const hoje = inicioDoDia();
  if (periodo === 'dia') {
    return { inicio: hoje, fim: new Date(hoje.getTime() + 86400000), rotulo: 'Hoje' };
  }
  if (periodo === 'semana') {
    // últimos 7 dias corridos, incluindo hoje
    return {
      inicio: new Date(hoje.getTime() - 6 * 86400000),
      fim: new Date(hoje.getTime() + 86400000),
      rotulo: 'Últimos 7 dias',
    };
  }
  if (periodo === 'mes') {
    return {
      inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
      fim: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1),
      rotulo: 'Mês atual',
    };
  }
  throw new AppError('Período inválido. Use: dia, semana, mes');
}

/**
 * Faturamento do período (dia | semana | mes), agrupado por forma de pagamento.
 * Inclui série diária para o gráfico do dashboard.
 */
async function faturamento(periodo = 'dia') {
  const { inicio, fim, rotulo } = intervaloDoPeriodo(periodo);
  const janela = { gte: inicio, lt: fim };

  const [porForma, pagamentos, pagos, cancelados, abertosAgora] = await Promise.all([
    prisma.pagamento.groupBy({
      by: ['forma'],
      where: { criadoEm: janela },
      _sum: { valor: true },
      _count: true,
    }),
    prisma.pagamento.findMany({
      where: { criadoEm: janela },
      select: { valor: true, criadoEm: true },
    }),
    prisma.pedido.aggregate({
      where: { status: 'pago', criadoEm: janela },
      _sum: { total: true, taxaServico: true, taxaEntrega: true },
      _count: true,
    }),
    prisma.pedido.aggregate({
      where: { status: 'cancelado', criadoEm: janela },
      _sum: { total: true },
      _count: true,
    }),
    prisma.pedido.count({ where: { status: { in: STATUS_PEDIDO_EM_ABERTO } } }),
  ]);

  // Série diária (faturamento por dia dentro da janela)
  const porDia = new Map();
  for (const p of pagamentos) {
    const chave = inicioDoDia(new Date(p.criadoEm)).toISOString().slice(0, 10);
    porDia.set(chave, (porDia.get(chave) ?? 0) + p.valor);
  }
  const serie = [];
  for (let d = new Date(inicio); d < fim && d <= new Date(); d = new Date(d.getTime() + 86400000)) {
    const chave = d.toISOString().slice(0, 10);
    serie.push({ dia: chave, valor: porDia.get(chave) ?? 0 });
  }

  // Produtos mais vendidos no período (a partir dos pedidos pagos)
  const pagosComItens = await prisma.pedido.findMany({
    where: { status: 'pago', criadoEm: janela },
    select: {
      itens: {
        select: { quantidade: true, precoUnitario: true, produto: { select: { nome: true } } },
      },
    },
  });
  const ranking = new Map();
  for (const pedido of pagosComItens) {
    for (const item of pedido.itens) {
      const nome = item.produto?.nome ?? '—';
      const atual = ranking.get(nome) ?? { nome, quantidade: 0, valor: 0 };
      atual.quantidade += item.quantidade;
      atual.valor += item.precoUnitario * item.quantidade;
      ranking.set(nome, atual);
    }
  }
  const topProdutos = [...ranking.values()]
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  const recebidoTotal = porForma.reduce((s, f) => s + (f._sum.valor ?? 0), 0);
  const qtdPagos = pagos._count ?? 0;

  return {
    topProdutos,
    periodo,
    rotulo,
    de: inicio.toISOString().slice(0, 10),
    ate: new Date(fim.getTime() - 86400000).toISOString().slice(0, 10),
    recebido: {
      total: recebidoTotal,
      porForma: Object.fromEntries(
        porForma.map((f) => [f.forma, { valor: f._sum.valor ?? 0, lancamentos: f._count }])
      ),
    },
    pedidosPagos: {
      quantidade: qtdPagos,
      produtos: pagos._sum.total ?? 0,
      taxaServico: pagos._sum.taxaServico ?? 0,
      taxaEntrega: pagos._sum.taxaEntrega ?? 0,
      ticketMedio: qtdPagos > 0 ? Math.round((pagos._sum.total ?? 0) / qtdPagos) : 0,
    },
    cancelados: {
      quantidade: cancelados._count ?? 0,
      valor: cancelados._sum.total ?? 0,
    },
    comandasAbertasAgora: abertosAgora,
    serieDiaria: serie,
  };
}

module.exports = { faturamento };
