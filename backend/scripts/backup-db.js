// Backup do banco SQLite com rotação (mantém os 14 mais recentes).
// Uso: node scripts/backup-db.js  (ou npm run backup)
const fs = require('fs/promises');
const path = require('path');

const ORIGEM = path.join(__dirname, '..', 'prisma', 'dev.db');
const PASTA = path.join(__dirname, '..', 'backups');
const MANTER = 14;

async function main() {
  await fs.mkdir(PASTA, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const destino = path.join(PASTA, `dev-${carimbo}.db`);
  await fs.copyFile(ORIGEM, destino);

  const arquivos = (await fs.readdir(PASTA))
    .filter((a) => a.startsWith('dev-') && a.endsWith('.db'))
    .sort()
    .reverse();
  for (const antigo of arquivos.slice(MANTER)) {
    await fs.unlink(path.join(PASTA, antigo));
  }
  console.log(`Backup criado: ${path.basename(destino)} (${arquivos.length} mantidos, máx ${MANTER})`);
}

main().catch((e) => {
  console.error('Falha no backup:', e.message);
  process.exit(1);
});
