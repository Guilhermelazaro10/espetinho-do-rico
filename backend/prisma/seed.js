const { PrismaClient } = require('@prisma/client');
const { gerarHashPin } = require('../src/lib/pin');
const { PAPEIS, STATUS_MESA } = require('../src/constantes');

const prisma = new PrismaClient();

// Cardápio oficial do Espetinho do Rico — preços em CENTAVOS
const produtos = [
  // Bebidas
  { nome: 'Cerveja Buch Skol', preco: 500, categoria: 'Bebidas' },
  { nome: 'Bohemia Buch', preco: 500, categoria: 'Bebidas' },
  { nome: 'Cerveja Spaten 600ml', preco: 1300, categoria: 'Bebidas' },
  { nome: 'Heineken 600ml', preco: 1500, categoria: 'Bebidas' },
  { nome: 'Stella 600ml', preco: 1500, categoria: 'Bebidas' },
  { nome: 'Cerveja Skol 600ml', preco: 1000, categoria: 'Bebidas' },
  { nome: 'Brahma 600ml', preco: 1000, categoria: 'Bebidas' },
  { nome: 'Cajuína 1Lt', preco: 1000, categoria: 'Bebidas' },
  { nome: 'Cajuína 600ml', preco: 800, categoria: 'Bebidas' },
  { nome: 'Refrigerante 1Lt', preco: 1000, categoria: 'Bebidas' },
  { nome: 'Refrigerante Lata', preco: 600, categoria: 'Bebidas' },
  { nome: 'Coca-Cola Lata', preco: 600, categoria: 'Bebidas' },
  { nome: 'Suco', preco: 300, categoria: 'Bebidas' },
  { nome: 'Água', preco: 250, categoria: 'Bebidas' },
  { nome: 'Água com Gás', preco: 300, categoria: 'Bebidas' },
  { nome: 'Cachaça Tanque', preco: 700, categoria: 'Bebidas' },
  { nome: 'Cachaça Burrinho', preco: 1200, categoria: 'Bebidas' },
  // Guarnições
  { nome: 'Cuscuz G', preco: 1400, categoria: 'Guarnições' },
  { nome: 'Meio Cuscuz P', preco: 700, categoria: 'Guarnições' },
  { nome: 'Baião G', preco: 1000, categoria: 'Guarnições' },
  { nome: 'Meio Baião P', preco: 600, categoria: 'Guarnições' },
  { nome: 'Batata Doce Porção', preco: 200, categoria: 'Guarnições' },
  { nome: 'Macarronada G', preco: 1500, categoria: 'Guarnições' },
  { nome: 'Macarronada P', preco: 800, categoria: 'Guarnições' },
  { nome: 'Misto - Baião/Cuscuz P', preco: 700, categoria: 'Guarnições' },
  { nome: 'Misto - Baião/Cuscuz G', preco: 1200, categoria: 'Guarnições' },
  { nome: 'Escondidinho Carne de Sol P', preco: 800, categoria: 'Guarnições' },
  { nome: 'Escondidinho Carne de Sol G', preco: 1500, categoria: 'Guarnições' },
  { nome: 'Arroz de Leite P', preco: 600, categoria: 'Guarnições' },
  { nome: 'Arroz de Leite G', preco: 1100, categoria: 'Guarnições' },
  { nome: 'Sopa P', preco: 500, categoria: 'Guarnições' },
  { nome: 'Sopa G', preco: 1000, categoria: 'Guarnições' },
  // Espetinhos
  { nome: 'Calabresa', preco: 700, categoria: 'Espetinhos' },
  { nome: 'Carne', preco: 700, categoria: 'Espetinhos' },
  { nome: 'Carne Moída', preco: 700, categoria: 'Espetinhos' },
  { nome: 'Porco', preco: 700, categoria: 'Espetinhos' },
  { nome: 'Frango', preco: 700, categoria: 'Espetinhos' },
  { nome: 'Ovo de Codorna c/ Bacon', preco: 1000, categoria: 'Espetinhos' },
  { nome: 'Linguiça', preco: 400, categoria: 'Espetinhos' },
  { nome: 'Coração de Frango', preco: 500, categoria: 'Espetinhos' },
  { nome: 'Misto', preco: 700, categoria: 'Espetinhos' },
  { nome: 'Queijo Assado', preco: 1000, categoria: 'Espetinhos' },
  { nome: 'Maminha', preco: 1200, categoria: 'Espetinhos' },
  { nome: 'Picanha Suína', preco: 1000, categoria: 'Espetinhos' },
];

// PINs de desenvolvimento — trocar em produção
const usuarios = [
  { nome: 'João Garçom', pin: '1111', papel: PAPEIS.GARCOM },
  { nome: 'Rico Gerente', pin: '9999', papel: PAPEIS.GERENTE },
];

async function main() {
  // Seed idempotente: limpa na ordem inversa das dependências
  await prisma.printJob.deleteMany();
  await prisma.auditoria.deleteMany();
  await prisma.movimentoCaixa.deleteMany();
  await prisma.caixa.deleteMany();
  await prisma.pagamento.deleteMany();
  await prisma.itemPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.mesa.deleteMany();
  await prisma.usuario.deleteMany();

  // SQLite preserva a sequência do autoincrement após deleteMany;
  // zera para que os IDs voltem a começar do 1 a cada seed.
  await prisma.$executeRawUnsafe(
    "DELETE FROM sqlite_sequence WHERE name IN ('produtos', 'mesas', 'pedidos', 'itens_pedido', 'pagamentos', 'usuarios', 'auditoria', 'caixas', 'movimentos_caixa', 'print_jobs')"
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
