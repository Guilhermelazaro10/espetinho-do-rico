const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  mesa: { findUnique: jest.fn(), update: jest.fn() },
  pedido: {
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  itemPedido: { delete: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  auditoria: { create: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../src/services/printerService', () => ({
  dispararImpressao: jest.fn(),
  dispararImpressaoPreConta: jest.fn(),
}));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { tokenDe } = require('./helpers/token');

const gerente = tokenDe('GERENTE');

/*
 * "3x carne, o cliente desistiu de 1": o gerente tira só 1 unidade em vez de
 * ser obrigado a remover o item inteiro e relançar.
 */
const pedidoCom3Carnes = {
  id: 5,
  status: 'aberto',
  mesaId: 1,
  taxaEntrega: 0,
  total: 3600,
  itens: [
    { id: 10, quantidade: 3, precoUnitario: 1200, produto: { nome: 'Espeto de Carne' } },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  prisma.auditoria.create.mockResolvedValue({});
  prisma.pedido.findUnique.mockResolvedValue(pedidoCom3Carnes);
});

describe('DELETE /pedidos/:id/itens/:itemId?quantidade=N — remoção parcial', () => {
  it('remove 1 de 3: decrementa a quantidade e abate do total', async () => {
    prisma.itemPedido.update.mockResolvedValue({});
    prisma.pedido.update.mockResolvedValue({});

    const res = await request(app)
      .delete('/api/pedidos/5/itens/10?quantidade=1')
      .set('Authorization', `Bearer ${gerente}`);

    expect(res.status).toBe(200);
    // vira 2x
    expect(prisma.itemPedido.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { quantidade: 2 },
    });
    // total: 3600 - 1200
    expect(prisma.pedido.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { total: 2400 },
    });
    // NÃO apagou o item
    expect(prisma.itemPedido.delete).not.toHaveBeenCalled();
  });

  it('quantidade igual ao item inteiro cai na remoção total', async () => {
    prisma.itemPedido.delete.mockResolvedValue({});
    prisma.itemPedido.findMany.mockResolvedValue([]); // comanda ficou vazia
    prisma.pedido.update.mockResolvedValue({});
    prisma.pedido.count.mockResolvedValue(0);
    prisma.mesa.update.mockResolvedValue({});

    const res = await request(app)
      .delete('/api/pedidos/5/itens/10?quantidade=3')
      .set('Authorization', `Bearer ${gerente}`);

    expect(res.status).toBe(200);
    expect(prisma.itemPedido.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  it('sem quantidade continua removendo o item inteiro (compatível)', async () => {
    prisma.itemPedido.delete.mockResolvedValue({});
    prisma.itemPedido.findMany.mockResolvedValue([]);
    prisma.pedido.update.mockResolvedValue({});
    prisma.pedido.count.mockResolvedValue(0);
    prisma.mesa.update.mockResolvedValue({});

    const res = await request(app)
      .delete('/api/pedidos/5/itens/10')
      .set('Authorization', `Bearer ${gerente}`);

    expect(res.status).toBe(200);
    expect(prisma.itemPedido.delete).toHaveBeenCalled();
  });

  it('quantidade maior que o item: 400 (não inventa remoção)', async () => {
    const res = await request(app)
      .delete('/api/pedidos/5/itens/10?quantidade=4')
      .set('Authorization', `Bearer ${gerente}`);

    expect(res.status).toBe(400);
    expect(prisma.itemPedido.update).not.toHaveBeenCalled();
    expect(prisma.itemPedido.delete).not.toHaveBeenCalled();
  });

  it('quantidade zero ou negativa: 400', async () => {
    for (const q of [0, -1]) {
      const res = await request(app)
        .delete(`/api/pedidos/5/itens/10?quantidade=${q}`)
        .set('Authorization', `Bearer ${gerente}`);
      expect(res.status).toBe(400);
    }
  });
});
