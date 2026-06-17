const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  mesa: { findUnique: jest.fn(), update: jest.fn() },
  produto: { findMany: jest.fn() },
  pedido: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  itemPedido: { delete: jest.fn(), findMany: jest.fn() },
  pagamento: { create: jest.fn() },
  auditoria: { create: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../src/services/printerService', () => ({
  dispararImpressao: jest.fn(),
  dispararImpressaoPreConta: jest.fn(),
}));

const prisma = require('../src/lib/prisma');
const printerService = require('../src/services/printerService');
const app = require('../src/app');
const { tokenDe } = require('./helpers/token');

const garcom = tokenDe('GARCOM');
const gerente = tokenDe('GERENTE');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  prisma.auditoria.create.mockResolvedValue({});
});

function prepararProdutos() {
  const catalogo = [
    { id: 1, nome: 'Espeto de Carne', preco: 1200, ativo: true },
    { id: 4, nome: 'Cerveja', preco: 800, ativo: true },
  ];
  // Respeita o filtro id IN (...) como o banco faria
  prisma.produto.findMany.mockImplementation(({ where }) =>
    Promise.resolve(catalogo.filter((p) => where.id.in.includes(p.id)))
  );
  prisma.pedido.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: 10, status: 'aberto', ...data })
  );
}

describe('POST /api/pedidos — tipo MESA', () => {
  const payload = {
    mesaId: 1,
    itens: [
      { produtoId: 1, quantidade: 2 },
      { produtoId: 4, quantidade: 3, observacao: 'bem gelada' },
    ],
  };

  it('cria pedido com total em centavos e preço congelado', async () => {
    prisma.mesa.findUnique.mockResolvedValue({ id: 1, numero: 1, status: 'LIVRE' });
    prepararProdutos();
    prisma.mesa.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${garcom}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(4800);
    const criacao = prisma.pedido.create.mock.calls[0][0].data;
    expect(criacao.itens.create[0]).toMatchObject({ produtoId: 1, precoUnitario: 1200 });
    expect(prisma.mesa.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'OCUPADA' },
    });
    expect(printerService.dispararImpressao).toHaveBeenCalledTimes(1);
  });

  it('rejeita quantidade acima do limite (anti-overflow): 400', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${garcom}`)
      .send({ mesaId: 1, itens: [{ produtoId: 1, quantidade: 1000000 }] });

    expect(res.status).toBe(400);
    expect(res.body.erro).toContain('Quantidade máxima');
  });

  it('rejeita observação longa demais: 400', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${garcom}`)
      .send({ mesaId: 1, itens: [{ produtoId: 1, quantidade: 1, observacao: 'x'.repeat(500) }] });

    expect(res.status).toBe(400);
  });

  it('rejeita pedido sem itens: 400', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${garcom}`)
      .send({ mesaId: 1, itens: [] });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('Pedido deve conter ao menos um item');
  });

  it('mesa AGUARDANDO_PAGAMENTO recusa pedido novo: 409', async () => {
    prisma.mesa.findUnique.mockResolvedValue({ id: 1, numero: 1, status: 'AGUARDANDO_PAGAMENTO' });

    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${garcom}`)
      .send(payload);

    expect(res.status).toBe(409);
    expect(res.body.erro).toContain('aguardando pagamento');
  });

  it('produto inativo (soft delete) não vende: 404', async () => {
    prisma.mesa.findUnique.mockResolvedValue({ id: 1, numero: 1, status: 'LIVRE' });
    prisma.produto.findMany.mockResolvedValue([]); // filtro ativo:true não achou

    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${garcom}`)
      .send({ mesaId: 1, itens: [{ produtoId: 1, quantidade: 1 }] });

    expect(res.status).toBe(404);
    expect(res.body.erro).toContain('indisponível');
  });
});

describe('POST /api/pedidos — DELIVERY e BALCÃO', () => {
  it('DELIVERY exige nome, telefone e endereço', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${garcom}`)
      .send({ tipo: 'DELIVERY', clienteNome: 'Ana', itens: [{ produtoId: 1, quantidade: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.erro).toContain('Telefone');
  });

  it('DELIVERY soma a taxa de entrega no total', async () => {
    prepararProdutos();

    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${garcom}`)
      .send({
        tipo: 'DELIVERY',
        clienteNome: 'Ana Souza',
        clienteTelefone: '11 99999-0000',
        clienteEndereco: 'Rua das Brasas, 123',
        taxaEntrega: 500,
        itens: [{ produtoId: 1, quantidade: 2 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(2900); // 2x1200 + 500 de entrega
    expect(res.body.mesaId).toBeNull();
    expect(prisma.mesa.update).not.toHaveBeenCalled();
  });

  it('BALCÃO exige apenas o nome', async () => {
    prepararProdutos();

    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${garcom}`)
      .send({
        tipo: 'BALCAO',
        clienteNome: 'Carlos',
        itens: [{ produtoId: 4, quantidade: 1 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(800);
  });

  it('BALCÃO sem nome: 400', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${garcom}`)
      .send({ tipo: 'BALCAO', itens: [{ produtoId: 4, quantidade: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.erro).toContain('Nome');
  });
});

describe('PATCH /api/pedidos/:id/pagamento — delivery/balcão (só GERENTE)', () => {
  const pedidoBalcao = {
    id: 7, tipo: 'BALCAO', mesaId: null, clienteNome: 'Carlos',
    total: 800, taxaEntrega: 0, status: 'entregue', mesa: null, itens: [],
  };

  it('garçom não paga: 403', async () => {
    const res = await request(app)
      .patch('/api/pedidos/7/pagamento')
      .set('Authorization', `Bearer ${garcom}`)
      .send({ formaPagamento: 'pix' });

    expect(res.status).toBe(403);
  });

  it('gerente paga e registra na gaveta vinculado ao pedido', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedidoBalcao);
    prisma.pedido.updateMany.mockResolvedValue({ count: 1 });
    prisma.pagamento.create.mockResolvedValue({});

    const res = await request(app)
      .patch('/api/pedidos/7/pagamento')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ formaPagamento: 'pix' });

    expect(res.status).toBe(200);
    expect(prisma.pagamento.create).toHaveBeenCalledWith({
      data: { pedidoId: 7, forma: 'pix', valor: 800 },
    });
  });

  it('pedido de MESA não paga por aqui: 409', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ ...pedidoBalcao, tipo: 'MESA', mesaId: 2 });

    const res = await request(app)
      .patch('/api/pedidos/7/pagamento')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ formaPagamento: 'pix' });

    expect(res.status).toBe(409);
    expect(res.body.erro).toContain('fechamento da mesa');
  });
});
