const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');

/*
 * Fila de impressão (modo nuvem). O backend enfileira o cupom já formatado;
 * o agente da loja consome via /api/impressao, imprime na térmica de rede e
 * confirma.
 *
 * Para evitar impressão em duplicidade, `proximos` REIVINDICA os jobs
 * (status 'processando') ao servi-los; só voltam à fila se o agente reportar
 * falha ou se ficarem presos além de STALE_MS (agente caiu no meio).
 */
const MAX_TENTATIVAS = 5;
const STALE_MS = 60 * 1000;
const AGENTE_ONLINE_MS = 15 * 1000; // sem contato além disso = agente offline

// Quando o agente da loja bateu na fila pela última vez (memória; reseta no boot).
let ultimoContatoAgente = null;

async function enfileirar({ tipo, conteudo = '', refId = null, abrirGaveta = false }) {
  return prisma.printJob.create({ data: { tipo, conteudo, refId, abrirGaveta } });
}

async function proximos(limite) {
  ultimoContatoAgente = Date.now(); // marca presença do agente
  const take = Math.min(Math.max(Number(limite) || 10, 1), 50);

  // 1. devolve à fila os jobs presos em "processando" (agente morreu no meio)
  await prisma.printJob.updateMany({
    where: { status: 'processando', atualizadoEm: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: 'pendente' },
  });

  // 2. pega os próximos pendentes
  const pendentes = await prisma.printJob.findMany({
    where: { status: 'pendente' },
    orderBy: { criadoEm: 'asc' },
    take,
  });
  if (pendentes.length === 0) return [];

  // 3. reivindica (não serve de novo até concluir/falhar/expirar)
  await prisma.printJob.updateMany({
    where: { id: { in: pendentes.map((j) => j.id) } },
    data: { status: 'processando' },
  });
  return pendentes;
}

async function concluir(id) {
  await prisma.printJob.updateMany({
    where: { id, status: 'processando' },
    data: { status: 'impresso' },
  });
}

async function falhar(id, erro) {
  const job = await prisma.printJob.findUnique({ where: { id } });
  if (!job) return;
  const tentativas = job.tentativas + 1;
  await prisma.printJob.update({
    where: { id },
    data: {
      tentativas,
      erro: String(erro ?? '').slice(0, 300),
      // esgotou as tentativas → marca erro (sai da fila); senão volta para a fila
      status: tentativas >= MAX_TENTATIVAS ? 'erro' : 'pendente',
    },
  });
}

function statusAgente() {
  const online = ultimoContatoAgente != null && Date.now() - ultimoContatoAgente < AGENTE_ONLINE_MS;
  return { online, ultimoContato: ultimoContatoAgente };
}

// Visão para o painel do gerente: presença do agente + fila + últimos jobs.
async function resumo() {
  const grupos = await prisma.printJob.groupBy({ by: ['status'], _count: { _all: true } });
  const fila = { pendente: 0, processando: 0, impresso: 0, erro: 0 };
  for (const g of grupos) fila[g.status] = g._count._all;

  const recentes = await prisma.printJob.findMany({
    orderBy: { criadoEm: 'desc' },
    take: 20,
    select: {
      id: true, tipo: true, refId: true, status: true,
      tentativas: true, erro: true, criadoEm: true, atualizadoEm: true,
    },
  });

  return { agente: statusAgente(), fila, recentes };
}

// Reimprime: re-enfileira o MESMO conteúdo como um job novo (preserva histórico).
async function reimprimir(id) {
  const job = await prisma.printJob.findUnique({ where: { id } });
  if (!job) throw new AppError('Cupom não encontrado', 404);
  return prisma.printJob.create({
    data: { tipo: job.tipo, conteudo: job.conteudo, refId: job.refId, abrirGaveta: job.abrirGaveta },
  });
}

module.exports = {
  enfileirar,
  proximos,
  concluir,
  falhar,
  resumo,
  reimprimir,
  statusAgente,
  MAX_TENTATIVAS,
};
