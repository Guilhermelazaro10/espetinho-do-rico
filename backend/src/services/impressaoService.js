const prisma = require('../lib/prisma');

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

async function enfileirar({ tipo, conteudo = '', refId = null, abrirGaveta = false }) {
  return prisma.printJob.create({ data: { tipo, conteudo, refId, abrirGaveta } });
}

async function proximos(limite) {
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

module.exports = { enfileirar, proximos, concluir, falhar, MAX_TENTATIVAS };
