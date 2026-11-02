const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  // Auth confere se o usuário do token segue ativo (middlewares/auth)
  usuario: { findUnique: jest.fn().mockResolvedValue({ ativo: true }) },
  mesa: { update: jest.fn() },
  pedido: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
  itemPedido: { delete: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  auditoria: { create: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../src/services/printerService', () => ({ dispararImpressao: jest.fn() }));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { tokenDe } = require('./helpers/token');

/*
 * Corrida: o gerente abre "remover item" com a comanda aberta, e no meio
 * alguém fecha a conta. A checagem de status era feita ANTES da transação,
 * então a remoção passava e mexia no total de um pedido já pago — o caixa
 * recebia um valor e o pedido passava a dizer outro.
 */

const gerente = tokenDe('GERENTE');
const pedidoLido = {
  id: 5, status: 'aberto', mesaId: null, taxaEntrega: 0, total: 3600, pagoAntecipado: false,
  itens: [
    { id: 10, quantidade: 3, precoUnitario: 1200, produto: { nome: 'Espeto de Carne' } },
    { id: 11, quantidade: 1, precoUnitario: 800, produto: { nome: 'Cerveja' } },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  prisma.auditoria.create.mockResolvedValue({});
  prisma.pedido.findUnique.mockResolvedValue(pedidoLido); // leitura de ANTES do pagamento
  prisma.itemPedido.findMany.mockResolvedValue([{ id: 10, quantidade: 3, precoUnitario: 1200 }]);
  // dentro da transação o pedido já não está mais em aberto
  prisma.pedido.updateMany.mockResolvedValue({ count: 0 });
});

describe('removerItem: pedido pago no meio da operação', () => {
  it.each([
    ['remoção parcial', '/api/pedidos/5/itens/10?quantidade=1'],
    ['remoção do item inteiro', '/api/pedidos/5/itens/11'],
  ])('%s: 409, a checagem é atômica dentro da transação', async (_, url) => {
    const res = await request(app).delete(url).set('Authorization', `Bearer ${gerente}`);

    expect(res.status).toBe(409);
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 5, status: { in: expect.arrayContaining(['aberto']) } }),
      })
    );
    expect(prisma.pedido.update).not.toHaveBeenCalled(); // total não foi reescrito sem guard
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
  });
});
