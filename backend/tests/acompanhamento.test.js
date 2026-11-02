const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  produto: { findMany: jest.fn() },
  pedido: { create: jest.fn(), findUnique: jest.fn() },
  auditoria: { create: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../src/services/printerService', () => ({ dispararImpressao: jest.fn() }));
jest.mock('../src/services/configService', () => ({ deliveryAtivo: jest.fn().mockResolvedValue(true) }));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { _resetar } = require('../src/middlewares/limitePublico');

/*
 * O acompanhamento era por ID sequencial (/pedidos/7/status): qualquer um
 * varria 1..N e somava o `total` de cada pedido — o faturamento online da
 * loja, dia a dia. Agora o link usa um código aleatório que só quem fez o
 * pedido conhece.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const corpo = { tipo: 'BALCAO', clienteNome: 'Ana', itens: [{ produtoId: 1, quantidade: 1 }] };

beforeEach(() => {
  jest.clearAllMocks();
  _resetar();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  prisma.produto.findMany.mockResolvedValue([{ id: 1, preco: 1000, ativo: true }]);
  prisma.pedido.create.mockImplementation(({ data }) => Promise.resolve({ id: 42, ...data, itens: [] }));
});

describe('acompanhamento público por código', () => {
  it('pedido online nasce com código aleatório e a resposta devolve o código', async () => {
    const res = await request(app).post('/api/publico/pedidos').send(corpo);
    expect(res.status).toBe(201);
    const { codigoAcompanhamento } = prisma.pedido.create.mock.calls[0][0].data;
    expect(codigoAcompanhamento).toMatch(UUID);
    expect(res.body.codigo).toBe(codigoAcompanhamento);
  });

  it('dois pedidos não compartilham código', async () => {
    await request(app).post('/api/publico/pedidos').send(corpo);
    await request(app).post('/api/publico/pedidos').send(corpo);
    const [a, b] = prisma.pedido.create.mock.calls.map((c) => c[0].data.codigoAcompanhamento);
    expect(a).not.toBe(b);
  });

  it('GET /acompanhar/:codigo devolve só id, status, tipo e total', async () => {
    const codigo = '3f2b8c1e-9d4a-4b6f-8e2a-1c5d7f9a0b3e';
    prisma.pedido.findUnique.mockResolvedValue({
      id: 42, status: 'em_preparo', tipo: 'DELIVERY', total: 2500, origem: 'online',
    });
    const res = await request(app).get(`/api/publico/pedidos/acompanhar/${codigo}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 42, status: 'em_preparo', tipo: 'DELIVERY', total: 2500 });
    expect(prisma.pedido.findUnique.mock.calls[0][0].where).toEqual({ codigoAcompanhamento: codigo });
  });

  it('código desconhecido: 404', async () => {
    prisma.pedido.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/publico/pedidos/acompanhar/3f2b8c1e-9d4a-4b6f-8e2a-1c5d7f9a0b3e');
    expect(res.status).toBe(404);
  });

  it('código em formato inválido: 404 sem ir ao banco', async () => {
    const res = await request(app).get('/api/publico/pedidos/acompanhar/7');
    expect(res.status).toBe(404);
    expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
  });

  it('a rota antiga por ID sequencial não existe mais', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ id: 7, status: 'pago', tipo: 'DELIVERY', total: 9999, origem: 'online' });
    const res = await request(app).get('/api/publico/pedidos/7/status');
    expect(res.status).not.toBe(200); // cai fora do router público (exige login)
    expect(res.body.total).toBeUndefined();
  });
});
