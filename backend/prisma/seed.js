const { PrismaClient } = require('@prisma/client');
const { gerarHashPin } = require('../src/lib/pin');
const { PAPEIS, STATUS_MESA } = require('../src/constantes');

const prisma = new PrismaClient();

// Preços em CENTAVOS
const produtos = [
  { nome: 'Espeto de Carne', preco: 1200, categoria: 'Espetos' },
  { nome: 'Espeto de Frango', preco: 1000, categoria: 'Espetos' },
  { nome: 'Medalhão', preco: 1500, categoria: 'Espetos' },
  { nome: 'Cerveja', preco: 800, categoria: 'Bebidas' },
  { nome: 'Refrigerante Lata', preco: 600, categoria: 'Bebidas' },
];

// PINs de desenvolvimento — trocar em produção
const usuarios = [
  { nome: 'João Garçom', pin: '1111', papel: PAPEIS.GARCOM },
  { nome: 'Rico Gerente', pin: '9999', papel: PAPEIS.GERENTE },
];

async function main() {
  // Seed idempotente: limpa na ordem inversa das dependências
  await prisma.auditoria.deleteMany();
  await prisma.pagamento.deleteMany();
  await prisma.itemPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.mesa.deleteMany();
  await prisma.usuario.deleteMany();

  // SQLite preserva a sequência do autoincrement após deleteMany;
  // zera para que os IDs voltem a começar do 1 a cada seed.
  await prisma.$executeRawUnsafe(
    "DELETE FROM sqlite_sequence WHERE name IN ('produtos', 'mesas', 'pedidos', 'itens_pedido', 'pagamentos', 'usuarios', 'auditoria')"
  );

  await prisma.produto.createMany({ data: produtos });

  await prisma.mesa.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({
      numero: i + 1,
      status: STATUS_MESA.LIVRE,
    })),
  });

  await prisma.usuario.createMany({
    data: usuarios.map((u) => ({ nome: u.nome, papel: u.papel, pinHash: gerarHashPin(u.pin) })),
  });

  const totais = {
    produtos: await prisma.produto.count(),
    mesas: await prisma.mesa.count(),
    usuarios: await prisma.usuario.count(),
  };
  console.log(
    `Seed concluído: ${totais.produtos} produtos, ${totais.mesas} mesas, ${totais.usuarios} usuários.`
  );
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
