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

module.exports = {
  listar,
  buscarPorId,
  atualizarStatus,
  definirTaxa,
  obterConta,
  solicitarPreConta,
  registrarPagamento,
};
