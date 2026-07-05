const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const auditoriaService = require('./auditoriaService');
const printerService = require('./printerService');
const { publicar } = require('../lib/eventos');
const {
  STATUS_MESA,
  STATUS_PEDIDO,
  STATUS_PEDIDO_EM_ABERTO,
  FORMAS_PAGAMENTO,
  PERCENTUAL_TAXA_SERVICO,
} = require('../constantes');

async function listar() {
  return prisma.mesa.findMany({ orderBy: { numero: 'asc' } });
}

async function buscarPorId(id) {
  const mesa = await prisma.mesa.findUnique({
    where: { id },
    include: {
      pedidos: {
        where: { status: { in: STATUS_PEDIDO_EM_ABERTO } },
        include: { itens: { include: { produto: true } } },
      },
    },
  });
  if (!mesa) throw new AppError('Mesa não encontrada', 404);
  return mesa;
}

async function atualizarStatus(id, status) {
  if (!Object.values(STATUS_MESA).includes(status)) {
    throw new AppError(`Status inválido. Use: ${Object.values(STATUS_MESA).join(', ')}`);
  }
  const mesa = await prisma.mesa.findUnique({ where: { id } });
  if (!mesa) throw new AppError('Mesa não encontrada', 404);
  const atualizada = await prisma.mesa.update({ where: { id }, data: { status } });
  publicar('mesa_status', { mesaId: id });
  return atualizada;
}

// Taxa de serviço 10% da conta atual — decisão do gerente, persiste na mesa
async function definirTaxa(id, ativa) {
  const mesa = await prisma.mesa.findUnique({ where: { id } });
  if (!mesa) throw new AppError('Mesa não encontrada', 404);
  const atualizada = await prisma.mesa.update({
    where: { id },
    data: { taxaAtiva: Boolean(ativa) },
  });
  publicar('mesa_status', { mesaId: id });
  return atualizada;
}

// Cálculo da conta corrente da mesa (única fonte de verdade do saldo)
async function calcularConta(clientePrisma, mesa) {
  const abertos = await clientePrisma.pedido.findMany({
    where: { mesaId: mesa.id, status: { in: STATUS_PEDIDO_EM_ABERTO } },
    include: { itens: { include: { produto: true } } },
  });
  const parciais = await clientePrisma.pagamento.findMany({
    where: { mesaId: mesa.id, liquidado: false },
    orderBy: { criadoEm: 'asc' },
  });

  const subtotal = abertos.reduce((s, p) => s + p.total, 0);
  const taxa = mesa.taxaAtiva
    ? abertos.reduce((s, p) => s + Math.round(p.total * PERCENTUAL_TAXA_SERVICO), 0)
    : 0;
  const totalDevido = subtotal + taxa;
  const pago = parciais.reduce((s, p) => s + p.valor, 0);

  return {
    comandas: abertos,
    pagamentosParciais: parciais,
    subtotal,
    taxa,
    taxaAtiva: mesa.taxaAtiva,
    totalDevido,
    pago,
    saldoDevedor: Math.max(totalDevido - pago, 0),
  };
}

// Extrato da conta para o caixa (GET /mesas/:id/conta)
async function obterConta(id) {
  const mesa = await prisma.mesa.findUnique({ where: { id } });
  if (!mesa) throw new AppError('Mesa não encontrada', 404);
  const conta = await calcularConta(prisma, mesa);
  return { mesa: { id: mesa.id, numero: mesa.numero, status: mesa.status }, ...conta };
}

/**
 * PRÉ-CONTA (garçom): muda a mesa para AGUARDANDO_PAGAMENTO e imprime a
 * conferência. NÃO toca em dinheiro — pagamento é outro endpoint, outro papel.
 */
async function solicitarPreConta(id, usuario) {
  const mesa = await prisma.mesa.findUnique({ where: { id } });
  if (!mesa) throw new AppError('Mesa não encontrada', 404);

  const conta = await calcularConta(prisma, mesa);
  if (conta.comandas.length === 0) {
    throw new AppError('Mesa sem consumo — nada para fechar', 409);
  }

  await prisma.mesa.update({
    where: { id },
    data: { status: STATUS_MESA.AGUARDANDO_PAGAMENTO },
  });

  printerService.dispararImpressaoPreConta({ mesa, ...conta });
  auditoriaService.registrar(
    usuario,
    'pre_conta',
    `Mesa ${mesa.numero}: pré-conta solicitada — total R$ ${(conta.totalDevido / 100).toFixed(2)}`
  );
  publicar('mesa_status', { mesaId: id });
  return { mesaId: id, status: STATUS_MESA.AGUARDANDO_PAGAMENTO, totalDevido: conta.totalDevido };
}

/**
 * PAGAMENTO PARCIAL (exclusivo GERENTE): registra um lançamento contra o
 * saldo da mesa. A mesa só libera quando o saldo devedor chega a zero —
 * aí as comandas viram "pago", os parciais liquidam e a mesa volta a LIVRE.
 * Tudo numa transação com guard de status (imune a dois caixas simultâneos).
 */
async function registrarPagamento(mesaId, { forma, valor }, usuario) {
  if (!FORMAS_PAGAMENTO.includes(forma)) {
    throw new AppError(`Forma de pagamento inválida. Use: ${FORMAS_PAGAMENTO.join(', ')}`);
  }
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new AppError('Valor deve ser um inteiro em centavos maior que zero');
  }

  const mesa = await prisma.mesa.findUnique({ where: { id: mesaId } });
  if (!mesa) throw new AppError('Mesa não encontrada', 404);

  const resultado = await prisma.$transaction(async (tx) => {
    const conta = await calcularConta(tx, mesa);
    if (conta.comandas.length === 0) {
      throw new AppError('Mesa não possui comandas abertas', 409);
    }

    // Troco só existe sobre dinheiro; a gaveta registra o valor líquido
    let troco = 0;
    let valorLiquido = valor;
    if (valor > conta.saldoDevedor) {
      troco = valor - conta.saldoDevedor;
      if (forma !== 'dinheiro') {
        throw new AppError('Troco só pode ser dado sobre pagamento em dinheiro');
      }
      valorLiquido = conta.saldoDevedor;
    }

    await tx.pagamento.create({
      data: { mesaId, forma, valor: valorLiquido, liquidado: false },
    });

    const saldoDevedor = conta.saldoDevedor - valorLiquido;
    let liberada = false;

    if (saldoDevedor <= 0) {
      // Conta zerou: quita as comandas (guard atômico), liquida os parciais
      // e libera a mesa.
      const formas = new Set([
        ...conta.pagamentosParciais.map((p) => p.forma),
        forma,
      ]);
      const formaRegistrada = formas.size === 1 ? [...formas][0] : 'multiplo';

      for (const pedido of conta.comandas) {
        const taxaPedido = mesa.taxaAtiva
          ? Math.round(pedido.total * PERCENTUAL_TAXA_SERVICO)
          : 0;
        const { count } = await tx.pedido.updateMany({
          where: { id: pedido.id, status: { in: STATUS_PEDIDO_EM_ABERTO } },
          data: {
            status: STATUS_PEDIDO.PAGO,
            formaPagamento: formaRegistrada,
            taxaServico: taxaPedido,
          },
        });
        if (count === 0) {
          throw new AppError('Conta já está sendo fechada por outro operador', 409);
        }
      }

      await tx.pagamento.updateMany({
        where: { mesaId, liquidado: false },
        data: { liquidado: true },
      });
      await tx.mesa.update({
        where: { id: mesaId },
        data: { status: STATUS_MESA.LIVRE, taxaAtiva: false },
      });
      liberada = true;
    }

    return {
      totalDevido: conta.totalDevido,
      valorRecebido: valor,
      valorAplicado: valorLiquido,
      troco,
      saldoDevedor,
      liberada,
    };
  });

  auditoriaService.registrar(
    usuario,
    'pagamento_parcial',
    `Mesa ${mesa.numero}: ${forma} R$ ${(resultado.valorAplicado / 100).toFixed(2)}` +
      (resultado.troco > 0 ? ` (troco R$ ${(resultado.troco / 100).toFixed(2)})` : '') +
      (resultado.liberada
        ? ' — conta quitada, mesa liberada'
        : ` — saldo restante R$ ${(resultado.saldoDevedor / 100).toFixed(2)}`)
  );
  publicar('pagamento', { mesaId });
  return resultado;
}

/**
 * TRANSFERIR MESA (gerente): move toda a conta aberta (comandas + pagamentos
 * parciais) para outra mesa — cliente trocou de lugar ou juntou mesas.
 */
async function transferirMesa(origemId, destinoId, usuario) {
  if (origemId === destinoId) throw new AppError('Escolha uma mesa diferente da atual');
  const [origem, destino] = await Promise.all([
    prisma.mesa.findUnique({ where: { id: origemId } }),
    prisma.mesa.findUnique({ where: { id: destinoId } }),
  ]);
  if (!origem) throw new AppError('Mesa de origem não encontrada', 404);
  if (!destino) throw new AppError('Mesa de destino não encontrada', 404);
  if (destino.status === STATUS_MESA.AGUARDANDO_PAGAMENTO) {
    throw new AppError('Mesa de destino está fechando a conta — escolha outra', 409);
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.pedido.updateMany({
      where: { mesaId: origemId, status: { in: STATUS_PEDIDO_EM_ABERTO } },
      data: { mesaId: destinoId },
    });
    if (count === 0) throw new AppError('Mesa de origem sem consumo aberto', 409);

    // Parciais acompanham a conta (o saldo continua batendo no destino)
    await tx.pagamento.updateMany({
      where: { mesaId: origemId, liquidado: false },
      data: { mesaId: destinoId },
    });
    await tx.mesa.update({
      where: { id: destinoId },
      data: { status: STATUS_MESA.OCUPADA, taxaAtiva: destino.taxaAtiva || origem.taxaAtiva },
    });
    await tx.mesa.update({
      where: { id: origemId },
      data: { status: STATUS_MESA.LIVRE, taxaAtiva: false },
    });
  });

  auditoriaService.registrar(
    usuario,
    'mesa_transferida',
    `Conta da mesa ${origem.numero} transferida para a mesa ${destino.numero}`
  );
  publicar('mesa_status', { mesaId: origemId });
  publicar('mesa_status', { mesaId: destinoId });
  return { origem: origem.numero, destino: destino.numero };
}

/**
 * TRANSFERIR ITEM (gerente): move um item de uma comanda para outra mesa.
 * Totais dos pedidos são recalculados; item único move o pedido inteiro.
 */
async function transferirItem(itemId, mesaDestinoId, usuario) {
  const item = await prisma.itemPedido.findUnique({
    where: { id: itemId },
    include: { pedido: true, produto: { select: { nome: true } } },
  });
  if (!item) throw new AppError('Item não encontrado', 404);
  const pedido = item.pedido;
  if (pedido.tipo !== 'MESA' || !STATUS_PEDIDO_EM_ABERTO.includes(pedido.status)) {
    throw new AppError('Só é possível transferir itens de comandas abertas de mesa', 409);
  }
  if (pedido.mesaId === mesaDestinoId) throw new AppError('Escolha uma mesa diferente da atual');

  const [origem, destino, parciais] = await Promise.all([
    prisma.mesa.findUnique({ where: { id: pedido.mesaId } }),
    prisma.mesa.findUnique({ where: { id: mesaDestinoId } }),
    prisma.pagamento.count({ where: { mesaId: pedido.mesaId, liquidado: false } }),
  ]);
  if (!destino) throw new AppError('Mesa de destino não encontrada', 404);
  if (destino.status === STATUS_MESA.AGUARDANDO_PAGAMENTO) {
    throw new AppError('Mesa de destino está fechando a conta — escolha outra', 409);
  }
  // Com parcial lançado o saldo da origem ficaria menor que o já pago
  if (parciais > 0) {
    throw new AppError('Mesa tem pagamento parcial — quite a conta ou transfira a mesa inteira', 409);
  }

  const valorItem = item.precoUnitario * item.quantidade;
  const restantes = await prisma.itemPedido.count({
    where: { pedidoId: pedido.id, id: { not: itemId } },
  });

  await prisma.$transaction(async (tx) => {
    if (restantes === 0) {
      // Único item: move a comanda inteira
      await tx.pedido.update({ where: { id: pedido.id }, data: { mesaId: mesaDestinoId } });
    } else {
      await tx.pedido.update({
        where: { id: pedido.id },
        data: { total: pedido.total - valorItem },
      });
      const novo = await tx.pedido.create({
        data: {
          tipo: 'MESA',
          mesaId: mesaDestinoId,
          total: valorItem,
          status: pedido.status,
          criadoPor: pedido.criadoPor,
        },
      });
      await tx.itemPedido.update({ where: { id: itemId }, data: { pedidoId: novo.id } });
    }

    await tx.mesa.update({ where: { id: mesaDestinoId }, data: { status: STATUS_MESA.OCUPADA } });
    const aindaAberta = await tx.pedido.count({
      where: { mesaId: pedido.mesaId, status: { in: STATUS_PEDIDO_EM_ABERTO } },
    });
    if (aindaAberta === 0) {
      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { status: STATUS_MESA.LIVRE, taxaAtiva: false },
      });
    }
  });

  auditoriaService.registrar(
    usuario,
    'item_transferido',
    `${item.quantidade}x ${item.produto?.nome ?? 'item'} (R$ ${(valorItem / 100).toFixed(2)}) ` +
      `da mesa ${origem?.numero} para a mesa ${destino.numero}`
  );
  publicar('mesa_status', { mesaId: pedido.mesaId });
  publicar('mesa_status', { mesaId: mesaDestinoId });
  return { origem: origem?.numero, destino: destino.numero };
}

// Adiciona uma mesa. Sem número informado, usa o próximo disponível.
async function criar({ numero } = {}, usuario) {
  let numeroFinal = numero;
  if (numeroFinal == null) {
    const ultima = await prisma.mesa.findFirst({ orderBy: { numero: 'desc' } });
    numeroFinal = (ultima?.numero ?? 0) + 1;
  }
  if (!Number.isInteger(numeroFinal) || numeroFinal <= 0) {
    throw new AppError('Número da mesa deve ser um inteiro positivo');
  }
  const existe = await prisma.mesa.findUnique({ where: { numero: numeroFinal } });
  if (existe) throw new AppError(`Mesa ${numeroFinal} já existe`, 409);

  const mesa = await prisma.mesa.create({
    data: { numero: numeroFinal, status: STATUS_MESA.LIVRE },
  });
  auditoriaService.registrar(usuario, 'mesa_criada', `Mesa ${numeroFinal} adicionada`);
  publicar('mesa_status', { mesaId: mesa.id });
  return mesa;
}

// Remove uma mesa. Só se estiver LIVRE e sem nenhum pedido no histórico
// (apagar mesa com vendas passadas violaria a integridade dos relatórios).
async function remover(id, usuario) {
  const mesa = await prisma.mesa.findUnique({ where: { id } });
  if (!mesa) throw new AppError('Mesa não encontrada', 404);
  if (mesa.status !== STATUS_MESA.LIVRE) {
    throw new AppError('Só é possível remover uma mesa livre', 409);
  }
  const pedidos = await prisma.pedido.count({ where: { mesaId: id } });
  if (pedidos > 0) {
    throw new AppError('Mesa tem histórico de pedidos e não pode ser removida', 409);
  }
  await prisma.mesa.delete({ where: { id } });
  auditoriaService.registrar(usuario, 'mesa_removida', `Mesa ${mesa.numero} removida`);
  publicar('mesa_status', { mesaId: id });
}

module.exports = {
  listar,
  buscarPorId,
  atualizarStatus,
  definirTaxa,
  obterConta,
  solicitarPreConta,
  registrarPagamento,
  transferirMesa,
  transferirItem,
  criar,
  remover,
};
