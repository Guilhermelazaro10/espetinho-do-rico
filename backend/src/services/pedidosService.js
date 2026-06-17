const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const printerService = require('./printerService');
const auditoriaService = require('./auditoriaService');
const { publicar } = require('../lib/eventos');
const {
  STATUS_MESA,
  TIPOS_PEDIDO,
  STATUS_PEDIDO,
  STATUS_PEDIDO_EM_ABERTO,
  FORMAS_PAGAMENTO,
} = require('../constantes');

const STATUS_VALIDOS_FLUXO = [STATUS_PEDIDO.ABERTO, STATUS_PEDIDO.EM_PREPARO, STATUS_PEDIDO.ENTREGUE];

const INCLUDE_COMPLETO = {
  mesa: true,
  itens: { include: { produto: true } },
};

function validarItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new AppError('Pedido deve conter ao menos um item');
  }
  for (const item of itens) {
    if (!item || !Number.isInteger(item.produtoId) || item.produtoId <= 0) {
      throw new AppError('Cada item precisa de um produtoId inteiro positivo');
    }
    if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) {
      throw new AppError('Cada item precisa de quantidade inteira maior que zero');
    }
    if (item.quantidade > 9999) {
      throw new AppError('Quantidade máxima por item é 9999');
    }
    if (item.observacao != null && typeof item.observacao !== 'string') {
      throw new AppError('Observação do item deve ser texto');
    }
    if (typeof item.observacao === 'string' && item.observacao.length > 200) {
      throw new AppError('Observação muito longa (máx. 200 caracteres)');
    }
  }
}

// Validação por tipo: MESA exige mesa; DELIVERY exige dados de entrega;
// BALCÃO exige só o nome do cliente.
function validarCabecalho(dados) {
  const tipo = dados.tipo ?? TIPOS_PEDIDO.MESA;
  if (!Object.values(TIPOS_PEDIDO).includes(tipo)) {
    throw new AppError(`Tipo de pedido inválido. Use: ${Object.values(TIPOS_PEDIDO).join(', ')}`);
  }

  if (tipo === TIPOS_PEDIDO.MESA) {
    if (!Number.isInteger(dados.mesaId) || dados.mesaId <= 0) {
      throw new AppError('mesaId é obrigatório e deve ser um inteiro positivo');
    }
    return { tipo, mesaId: dados.mesaId, taxaEntrega: 0 };
  }

  const nome = (dados.clienteNome ?? '').trim();
  if (nome.length < 2) throw new AppError('Nome do cliente é obrigatório');

  if (tipo === TIPOS_PEDIDO.BALCAO) {
    return { tipo, mesaId: null, clienteNome: nome, taxaEntrega: 0 };
  }

  // DELIVERY
  const telefone = (dados.clienteTelefone ?? dados.telefone ?? '').trim();
  const endereco = (dados.clienteEndereco ?? dados.endereco ?? '').trim();
  const taxaEntrega = Number(dados.taxaEntrega ?? dados.taxa ?? 0);
  if (telefone.length < 8) throw new AppError('Telefone do cliente é obrigatório para delivery');
  if (endereco.length < 5) throw new AppError('Endereço de entrega é obrigatório para delivery');
  if (!Number.isInteger(taxaEntrega) || taxaEntrega < 0) {
    throw new AppError('Taxa de entrega deve ser um inteiro em centavos (zero ou mais)');
  }
  if (taxaEntrega > 1000000) {
    throw new AppError('Taxa de entrega excede o limite');
  }
  return {
    tipo,
    mesaId: null,
    clienteNome: nome,
    clienteTelefone: telefone,
    clienteEndereco: endereco,
    taxaEntrega,
  };
}

async function listar({ status, abertos, tipo, limite, pagina } = {}) {
  // abertos=true: visão operacional (salão/cozinha) — payload sempre limitado
  const where = {
    ...(abertos ? { status: { in: STATUS_PEDIDO_EM_ABERTO } } : status ? { status } : {}),
    ...(tipo ? { tipo } : {}),
  };

  const porPagina = Math.min(Math.max(Number(limite) || 100, 1), 500);
  const atual = Math.max(Number(pagina) || 1, 1);

  return prisma.pedido.findMany({
    where,
    include: INCLUDE_COMPLETO,
    orderBy: { criadoEm: 'desc' },
    take: porPagina,
    skip: (atual - 1) * porPagina,
  });
}

async function buscarPorId(id) {
  const pedido = await prisma.pedido.findUnique({ where: { id }, include: INCLUDE_COMPLETO });
  if (!pedido) throw new AppError('Pedido não encontrado', 404);
  return pedido;
}

async function criar(dados) {
  const cabecalho = validarCabecalho(dados ?? {});
  validarItens(dados.itens);
  const { itens } = dados;

  if (cabecalho.tipo === TIPOS_PEDIDO.MESA) {
    const mesa = await prisma.mesa.findUnique({ where: { id: cabecalho.mesaId } });
    if (!mesa) throw new AppError('Mesa não encontrada', 404);
    if (mesa.status === STATUS_MESA.AGUARDANDO_PAGAMENTO) {
      throw new AppError(
        'Mesa aguardando pagamento — peça ao gerente para reabrir o consumo',
        409
      );
    }
  }

  // Total é SEMPRE calculado no servidor a partir dos preços atuais do banco,
  // e cada item CONGELA o preço unitário do momento da venda (centavos).
  const idsUnicos = [...new Set(itens.map((i) => i.produtoId))];
  const produtos = await prisma.produto.findMany({
    where: { id: { in: idsUnicos }, ativo: true }, // produto inativo não vende
  });
  if (produtos.length !== idsUnicos.length) {
    const encontrados = new Set(produtos.map((p) => p.id));
    const faltantes = idsUnicos.filter((id) => !encontrados.has(id));
    throw new AppError(`Produto(s) indisponível(is): ${faltantes.join(', ')}`, 404);
  }

  const precoPorId = new Map(produtos.map((p) => [p.id, p.preco]));
  const totalItens = itens.reduce((soma, i) => soma + precoPorId.get(i.produtoId) * i.quantidade, 0);
  const total = totalItens + (cabecalho.taxaEntrega ?? 0);

  const pedido = await prisma.$transaction(async (tx) => {
    if (cabecalho.mesaId) {
      await tx.mesa.update({
        where: { id: cabecalho.mesaId },
        data: { status: STATUS_MESA.OCUPADA },
      });
    }
    return tx.pedido.create({
      data: {
        ...cabecalho,
        total,
        itens: {
          create: itens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            precoUnitario: precoPorId.get(i.produtoId),
            observacao: i.observacao ?? null,
          })),
        },
      },
      include: INCLUDE_COMPLETO,
    });
  });

  // Cupom de produção: fire-and-forget, nunca atrasa nem derruba a resposta
  printerService.dispararImpressao(pedido);
  publicar('pedido_criado', { mesaId: cabecalho.mesaId, tipo: cabecalho.tipo });

  return pedido;
}

// Fluxo de produção (cozinha/garçom): aberto → em_preparo → entregue.
// Pago e cancelado têm endpoints próprios com permissão e auditoria.
async function atualizarStatus(id, status) {
  if (!STATUS_VALIDOS_FLUXO.includes(status)) {
    throw new AppError(`Status inválido. Use: ${STATUS_VALIDOS_FLUXO.join(', ')}`);
  }
  const { count } = await prisma.pedido.updateMany({
    where: { id, status: { in: STATUS_PEDIDO_EM_ABERTO } },
    data: { status },
  });
  if (count === 0) {
    const existe = await prisma.pedido.findUnique({ where: { id } });
    if (!existe) throw new AppError('Pedido não encontrado', 404);
    throw new AppError(`Pedido ${existe.status} não pode mudar para ${status}`, 409);
  }
  publicar('pedido_status', { pedidoId: id });
  return buscarPorId(id);
}

/**
 * Pagamento de pedido avulso (DELIVERY/BALCÃO) — exclusivo do GERENTE.
 * Mesas usam o fluxo de pagamentos parciais em mesasService.
 * Guard atômico: o updateMany só efetiva se o status ainda estiver em aberto.
 */
async function pagarPedido(id, formaPagamento, usuario) {
  if (!FORMAS_PAGAMENTO.includes(formaPagamento)) {
    throw new AppError(`Forma de pagamento inválida. Use: ${FORMAS_PAGAMENTO.join(', ')}`);
  }
  const pedido = await buscarPorId(id);
  if (pedido.tipo === TIPOS_PEDIDO.MESA) {
    throw new AppError('Pedidos de mesa são pagos pelo fechamento da mesa', 409);
  }
  if (pedido.status === STATUS_PEDIDO.PAGO) throw new AppError('Pedido já está pago', 409);
  if (pedido.status === STATUS_PEDIDO.CANCELADO) {
    throw new AppError('Pedido cancelado não pode ser pago', 409);
  }

  const pago = await prisma.$transaction(async (tx) => {
    const { count } = await tx.pedido.updateMany({
      where: { id, status: { in: STATUS_PEDIDO_EM_ABERTO } },
      data: { status: STATUS_PEDIDO.PAGO, formaPagamento },
    });
    if (count === 0) throw new AppError('Pedido já foi fechado por outro operador', 409);

    await tx.pagamento.create({
      data: { pedidoId: id, forma: formaPagamento, valor: pedido.total },
    });
    return tx.pedido.findUnique({ where: { id }, include: INCLUDE_COMPLETO });
  });

  auditoriaService.registrar(
    usuario,
    'pagamento_pedido',
    `${pedido.tipo} #${id} (${pedido.clienteNome ?? 'sem nome'}) pago via ${formaPagamento} — R$ ${(pedido.total / 100).toFixed(2)}`
  );
  publicar('pagamento', { pedidoId: id });
  return pago;
}

/**
 * Cancela uma comanda inteira, com motivo obrigatório — exclusivo do GERENTE.
 */
async function cancelar(id, motivo, usuario) {
  if (typeof motivo !== 'string' || motivo.trim().length < 3) {
    throw new AppError('Informe o motivo do cancelamento (mínimo 3 caracteres)');
  }
  const pedido = await buscarPorId(id);

  const cancelado = await prisma.$transaction(async (tx) => {
    const { count } = await tx.pedido.updateMany({
      where: { id, status: { in: STATUS_PEDIDO_EM_ABERTO } },
      data: { status: STATUS_PEDIDO.CANCELADO, motivoCancelamento: motivo.trim() },
    });
    if (count === 0) {
      throw new AppError(`Pedido ${pedido.status} não pode ser cancelado`, 409);
    }
    if (pedido.mesaId) {
      const abertosNaMesa = await tx.pedido.count({
        where: { mesaId: pedido.mesaId, status: { in: STATUS_PEDIDO_EM_ABERTO } },
      });
      if (abertosNaMesa === 0) {
        await tx.mesa.update({
          where: { id: pedido.mesaId },
          data: { status: STATUS_MESA.LIVRE, taxaAtiva: false },
        });
      }
    }
    return tx.pedido.findUnique({ where: { id }, include: INCLUDE_COMPLETO });
  });

  auditoriaService.registrar(
    usuario,
    'cancelamento_comanda',
    `Comanda #${id} cancelada — motivo: ${motivo.trim()}`
  );
  publicar('cancelamento', { mesaId: pedido.mesaId });
  return cancelado;
}

/**
 * Remove um item da comanda (erro de lançamento) recalculando o total.
 * Comanda que ficar vazia é cancelada automaticamente.
 */
async function removerItem(pedidoId, itemId, usuario) {
  const pedido = await buscarPorId(pedidoId);
  if (!STATUS_PEDIDO_EM_ABERTO.includes(pedido.status)) {
    throw new AppError(`Pedido ${pedido.status} não pode ser alterado`, 409);
  }
  const item = pedido.itens.find((i) => i.id === itemId);
  if (!item) throw new AppError('Item não encontrado nesta comanda', 404);

  const atualizado = await prisma.$transaction(async (tx) => {
    await tx.itemPedido.delete({ where: { id: itemId } });
    const restantes = await tx.itemPedido.findMany({ where: { pedidoId } });
    const novoTotal =
      restantes.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0) + pedido.taxaEntrega;

    if (restantes.length === 0) {
      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          status: STATUS_PEDIDO.CANCELADO,
          total: 0,
          motivoCancelamento: 'todos os itens removidos',
        },
      });
      if (pedido.mesaId) {
        const abertosNaMesa = await tx.pedido.count({
          where: { mesaId: pedido.mesaId, status: { in: STATUS_PEDIDO_EM_ABERTO } },
        });
        if (abertosNaMesa === 0) {
          await tx.mesa.update({
            where: { id: pedido.mesaId },
            data: { status: STATUS_MESA.LIVRE, taxaAtiva: false },
          });
        }
      }
    } else {
      await tx.pedido.update({ where: { id: pedidoId }, data: { total: novoTotal } });
    }
    return tx.pedido.findUnique({ where: { id: pedidoId }, include: INCLUDE_COMPLETO });
  });

  auditoriaService.registrar(
    usuario,
    'remocao_item',
    `Item "${item.produto.nome}" x${item.quantidade} removido da comanda #${pedidoId}`
  );
  publicar('pedido_alterado', { mesaId: pedido.mesaId });
  return atualizado;
}

async function reimprimir(id) {
  const pedido = await buscarPorId(id);
  printerService.dispararImpressao(pedido);
  return { ok: true, pedidoId: id };
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizarStatus,
  pagarPedido,
  cancelar,
  removerItem,
  reimprimir,
};
