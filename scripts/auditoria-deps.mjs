// Auditoria das dependências de PRODUÇÃO para a CI (substitui o
// `npm audit --omit=dev --audit-level=high`, que não aceita exceção por ID).
//
// Regra: qualquer advisory high/critical reprova — menos os listados em
// EXCECOES, e só até a data-limite de cada um. Vencida a data, a exceção
// some sozinha e a CI volta a bloquear. A exceção é por ID do advisory, nunca
// pelo pacote: outra falha no mesmo pacote continua reprovando.
//
// Uso: node scripts/auditoria-deps.mjs
//   AUDITORIA_HOJE=2027-01-01  simula outra data (para testar o vencimento)
//   AUDITORIA_SEM_EXCECOES=1   ignora as exceções (para ver o relatório cru)
import { execSync } from 'node:child_process';

const EXCECOES = {
  // deepmerge-ts < 8 (stack exhaustion ao mesclar objetos recursivos).
  // Só chega aqui por prisma (CLI) -> @prisma/config -> deepmerge-ts. O
  // servidor em execução usa só o @prisma/client, que não carrega essa
  // cadeia (verificado em 04/11/2026: nem a consulta nem o app importam
  // deepmerge-ts/@prisma/config). O CLI roda apenas no deploy (generate e
  // migrate deploy) com o schema do próprio repositório como entrada.
  // A correção exige o Prisma 7 (mudança grande): migrar até 31/12/2026.
  'GHSA-ggr8-5vv4-36mx': { ate: '2026-12-31', motivo: 'deepmerge-ts só no CLI do Prisma; migrar ao Prisma 7' },
};

const NIVEIS_QUE_BLOQUEIAM = new Set(['high', 'critical']);
const hoje = process.env.AUDITORIA_HOJE ?? new Date().toISOString().slice(0, 10);
const semExcecoes = process.env.AUDITORIA_SEM_EXCECOES === '1';

let saida;
try {
  saida = execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  // npm audit sai com código != 0 quando acha vulnerabilidade; o JSON vem igual
  saida = e.stdout;
}

let relatorio;
try {
  relatorio = JSON.parse(saida);
} catch {
  console.error('Não foi possível ler o resultado do npm audit:\n', saida?.slice(0, 500));
  process.exit(1);
}

// Só os advisories de verdade (objetos em `via`); pacotes que aparecem só por
// depender de outro pacote vulnerável herdam o advisory de lá.
const advisories = new Map();
for (const [pacote, v] of Object.entries(relatorio.vulnerabilities ?? {})) {
  for (const via of v.via) {
    if (typeof via !== 'object') continue;
    const id = String(via.url ?? '').split('/').pop() || `advisory-${via.source}`;
    if (!advisories.has(id)) advisories.set(id, { id, pacote, severidade: via.severity, titulo: via.title, url: via.url });
  }
}

const bloqueiam = [];
const liberados = [];
for (const a of advisories.values()) {
  if (!NIVEIS_QUE_BLOQUEIAM.has(a.severidade)) continue;
  const excecao = !semExcecoes && EXCECOES[a.id];
  if (excecao && hoje <= excecao.ate) liberados.push({ ...a, ...excecao });
  else bloqueiam.push({ ...a, vencida: excecao ? `exceção venceu em ${excecao.ate}` : null });
}

for (const a of liberados) {
  console.log(`LIBERADO até ${a.ate}: ${a.id} (${a.severidade}) ${a.pacote} — ${a.motivo}`);
}
if (bloqueiam.length) {
  console.error(`\n${bloqueiam.length} vulnerabilidade(s) high/critical em dependências de produção:`);
  for (const a of bloqueiam) {
    console.error(`  ${a.severidade.toUpperCase()} ${a.pacote}: ${a.titulo} ${a.url}${a.vencida ? ` [${a.vencida}]` : ''}`);
  }
  process.exit(1);
}
console.log(`OK: nenhuma vulnerabilidade high/critical bloqueando (data de referência ${hoje}).`);
