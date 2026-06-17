const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const auditoriaService = require('./auditoriaService');
const { criarMutex } = require('../lib/mutex');

// Serializa a abertura de caixa (checa-depois-cria não é atômico no banco)
const exclusivoAbertura = criarMutex();

/*
 * Turno de caixa (gaveta física). Apenas pagamentos em DINHEIRO entram na
 * gaveta; pix/cartão são informativos. Esperado em dinheiro =
 *   fundo de abertura + dinheiro recebido no turno + suprimentos - sangrias.
 * No fechamento o gerente conta a gaveta (contagem cega) e o sistema mostra a
 * diferença (sobra/falta).
 */
const TIPOS_MOVIMENTO = ['sangria', 'suprimento'];

function quem(usuario) {
  return usuario ? `${usuario.nome} (${usuario.papel})` : 'sistema';
}

function caixaAberto() {
  return prisma.caixa.findFirst({
    where: { status: 'aberto' },
    include: { movimentos: { orderBy: { criadoEm: 'asc' } } },
  });
}

async function abrir({ fundoAbertura }, usuario) {
  if (!Number.isInteger(fundoAbertura) || fundoAbertura < 0) {
    throw new AppError('Fundo de troco deve ser um inteiro em centavos (zero ou mais)');
  }

  // Mutex: garante que a checagem "já existe aberto?" + criação rodem sem
  // intercalação entre requisições concorrentes (corrida que abria N caixas).
  const caixa = await exclusivoAbertura(async () => {
    if (await prisma.caixa.findFirst({ where: { status: 'aberto' } })) {
      throw new AppError('Já existe um caixa aberto', 409);
    }
    return prisma.caixa.create({
      data: { fundoAbertura, abertoPor: quem(usuario), status: 'aberto' },
    });
  });

  auditoriaService.registrar(
    usuario,
    'caixa_abertura',
    `Caixa #${caixa.id} aberto com fundo R$ ${(fundoAbertura / 100).toFixed(2)}`
  );
  return caixa;
}

async function registrarMovimento({ tipo, valor, motivo }, usuario) {
  if (!TIPOS_MOVIMENTO.includes(tipo)) {
    throw new AppError(`Tipo inválido. Use: ${TIPOS_MOVIMENTO.join(', ')}`);
  }
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new AppError('Valor deve ser inteiro em centavos maior que zero');
  }
  if (typeof motivo !== 'string' || motivo.trim().length < 3) {
    throw new AppError('Informe o motivo (mínimo 3 caracteres)');
  }
  const caixa = await prisma.caixa.findFirst({ where: { status: 'aberto' } });
  if (!caixa) throw new AppError('Nenhum caixa aberto', 409);

  const movimento = await prisma.movimentoCaixa.create({
    data: { caixaId: caixa.id, tipo, valor, motivo: motivo.trim(), por: quem(usuario) },
  });
  auditoriaService.registrar(
    usuario,
    `caixa_${tipo}`,
    `${tipo} de R$ ${(valor / 100).toFixed(2)} — ${motivo.trim()}`
  );
  return movimento;
}

// Esperado em dinheiro + recebido por forma no período do turno
async function calcularResumo(caixa) {
  const periodo = { gte: caixa.abertoEm, lte: caixa.fechadoEm ?? new Date() };

  const grupos = await prisma.pagamento.groupBy({
    by: ['forma'],
    where: { criadoEm: periodo },
    _sum: { valor: true },
    _count: true,
  });
  const porForma = Object.fromEntries(
    grupos.map((g) => [g.forma, { valor: g._sum.valor ?? 0, lancamentos: g._count }])
  );

  const movimentos =
    caixa.movimentos ?? (await prisma.movimentoCaixa.findMany({ where: { caixaId: caixa.id } }));
  const sangrias = movimentos.filter((m) => m.tipo === 'sangria').reduce((s, m) => s + m.valor, 0);
  const suprimentos = movimentos
    .filter((m) => m.tipo === 'suprimento')
    .reduce((s, m) => s + m.valor, 0);

  const recebidoDinheiro = porForma.dinheiro?.valor ?? 0;
  const recebidoTotal = grupos.reduce((s, g) => s + (g._sum.valor ?? 0), 0);

  return {
    porForma,
    recebidoTotal,
    recebidoDinheiro,
    sangrias,
    suprimentos,
    esperadoDinheiro: caixa.fundoAbertura + recebidoDinheiro + suprimentos - sangrias,
  };
}

async function statusAtual() {
  const caixa = await caixaAberto();
  if (!caixa) return { caixa: null };
  return { caixa, resumo: await calcularResumo(caixa) };
}

async function fechar({ valorContado, observacao }, usuario) {
  if (!Number.isInteger(valorContado) || valorContado < 0) {
    throw new AppError('Valor contado deve ser um inteiro em centavos (zero ou mais)');
  }
  const caixa = await caixaAberto();
  if (!caixa) throw new AppError('Nenhum caixa aberto', 409);

  const resumo = await calcularResumo(caixa);
  const diferenca = valorContado - resumo.esperadoDinheiro;

  const fechado = await prisma.caixa.update({
    where: { id: caixa.id },
    data: {
      status: 'fechado',
      fechadoPor: quem(usuario),
      fechadoEm: new Date(),
      valorContado,
      diferenca,
      observacao: observacao?.trim() || null,
    },
    include: { movimentos: true },
  });

  auditoriaService.registrar(
    usuario,
    'caixa_fechamento',
    `Caixa #${caixa.id} fechado: esperado R$ ${(resumo.esperadoDinheiro / 100).toFixed(2)}, ` +
      `contado R$ ${(valorContado / 100).toFixed(2)}, diferença R$ ${(diferenca / 100).toFixed(2)}`
  );

  return { caixa: fechado, resumo: { ...resumo, valorContado, diferenca } };
}

module.exports = { statusAtual, abrir, registrarMovimento, fechar };
