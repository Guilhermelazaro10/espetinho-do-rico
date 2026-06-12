const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const produtos = await prisma.produto.findMany({ orderBy: { id: 'asc' } });
  const mesas = await prisma.mesa.findMany({ orderBy: { numero: 'asc' } });
  const usuarios = await prisma.usuario.findMany({ orderBy: { id: 'asc' } });

  console.log('PRODUTOS (precos em centavos):');
  for (const p of produtos) {
    console.log(`  ${p.id} | ${p.nome} | ${p.preco} ctv (R$ ${(p.preco / 100).toFixed(2)}) | ${p.categoria}`);
  }
  console.log(`MESAS (${mesas.length}):`, mesas.map((m) => `#${m.numero}[${m.status}]`).join(' '));
  console.log(`USUÁRIOS:`, usuarios.map((u) => `${u.nome} (${u.papel})`).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
