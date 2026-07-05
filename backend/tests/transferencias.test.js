const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  mesa: { findUnique: jest.fn(), update: jest.fn() },
  pedido: {
    findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn(),
    create: jest.fn(), count: jest.fn(),
  },
  itemPedido: { findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
  pagamento: { updateMany: jest.fn(), count: jest.fn(), findMany: jest.fn() },
  auditoria: { create: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../src/services/printerService', () => ({
  dispararImpressao: jest.fn(),
  dispararImpressaoPreConta: jest.fn(),
  dispararImpressaoFechamento: jest.fn(),
}));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { tokenDe } = require('./helpers/token');

const gerente = tokenDe('GERENTE');
const garcom = tokenDe('GARCOM');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  prisma.auditoria.create.mockResolvedValue({});
});

describe('Transferir mesa inteira', () => {
  it('garçom não transfere: 403', async () => {
    const res = await request(app)
      .post('/api/mesas/1/transferir')
      .set('Authorization', `Bearer ${garcom}`)
      .send({ destinoId: 2 });
    expect(res.status).toBe(403);
  });

  it('move comandas e parciais, libera a origem e ocupa o destino', async () => {
    prisma.mesa.findUnique
      .mockResolvedValueOnce({ id: 1, numero: 1, status: 'OCUPADA', taxaAtiva: true })
      .mockResolvedValueOnce({ id: 2, numero: 2, status: 'LIVRE', taxaAtiva: false });
    prisma.pedido.updateMany.mockResolvedValue({ count: 2 });
    prisma.pagamento.updateMany.mockResolvedValue({ count: 1 });
    prisma.mesa.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/mesas/1/transferir')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ destinoId: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ origem: 1, destino: 2 });
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { mesaId: 2 } })
    );
    // parciais acompanham a conta
    expect(prisma.pagamento.updateMany).toHaveBeenCalledWith({
      where: { mesaId: 1, liquidado: false },
      data: { mesaId: 2 },
    });
    // destino herda a taxa de serviço da origem
    expect(prisma.mesa.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { status: 'OCUPADA', taxaAtiva: true },
    });
    expect(prisma.mesa.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'LIVRE', taxaAtiva: false },
    });
  });

  it('recusa destino aguardando pagamento: 409', async () => {
    prisma.mesa.findUnique
      .mockResolvedValueOnce({ id: 1, numero: 1, status: 'OCUPADA' })
      .mockResolvedValueOnce({ id: 2, numero: 2, status: 'AGUARDANDO_PAGAMENTO' });

    const res = await request(app)
      .post('/api/mesas/1/transferir')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ destinoId: 2 });
    expect(res.status).toBe(409);
  });

  it('recusa origem sem consumo aberto: 409', async () => {
    prisma.mesa.findUnique
      .mockResolvedValueOnce({ id: 1, numero: 1, status: 'LIVRE' })
      .mockResolvedValueOnce({ id: 2, numero: 2, status: 'LIVRE' });
    prisma.pedido.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app)
      .post('/api/mesas/1/transferir')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ destinoId: 2 });
    expect(res.status).toBe(409);
  });

  it('recusa transferir para a mesma mesa: 400', async () => {
    const res = await request(app)
      .post('/api/mesas/1/transferir')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ destinoId: 1 });
    expect(res.status).toBe(400);
  });
});

describe('Transferir item entre mesas', () => {
  const item = {
    id: 10,
    quantidade: 2,
    precoUnitario: 700,
    produto: { nome: 'Espetinho de Carne' },
    pedido: { id: 5, tipo: 'MESA', mesaId: 1, status: 'aberto', total: 3400, criadoPor: 'Chico' },
  };

  it('item com irmãos: cria comanda no destino e recalcula totais', async () => {
    prisma.itemPedido.findUnique.mockResolvedValue(item);
    prisma.mesa.findUnique
      .mockResolvedValueOnce({ id: 1, numero: 1, status: 'OCUPADA' })
      .mockResolvedValueOnce({ id: 2, numero: 2, status: 'LIVRE' });
    prisma.pagamento.count.mockResolvedValue(0);
    prisma.itemPedido.count.mockResolvedValue(3); // tem outros itens
    prisma.pedido.update.mockResolvedValue({});
    prisma.pedido.create.mockResolvedValue({ id: 99 });
    prisma.itemPedido.update.mockResolvedValue({});
    prisma.mesa.update.mockResolvedValue({});
    prisma.pedido.count.mockResolvedValue(1); // origem segue com comanda

    const res = await request(app)
      .post('/api/mesas/itens/10/transferir')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ destinoId: 2 });

    expect(res.status).toBe(200);
    // origem: total - (2 x 700)
    expect(prisma.pedido.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { total: 3400 - 1400 },
    });
    // nova comanda no destino preserva quem lançou
    expect(prisma.pedido.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mesaId: 2, total: 1400, criadoPor: 'Chico' }),
    });
    expect(prisma.itemPedido.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { pedidoId: 99 },
    });
  });

  it('item único: move a comanda inteira e libera a origem', async () => {
    prisma.itemPedido.findUnique.mockResolvedValue(item);
    prisma.mesa.findUnique
      .mockResolvedValueOnce({ id: 1, numero: 1, status: 'OCUPADA' })
      .mockResolvedValueOnce({ id: 2, numero: 2, status: 'LIVRE' });
    prisma.pagamento.count.mockResolvedValue(0);
    prisma.itemPedido.count.mockResolvedValue(0); // era o único item
    prisma.pedido.update.mockResolvedValue({});
    prisma.mesa.update.mockResolvedValue({});
    prisma.pedido.count.mockResolvedValue(0); // origem ficou sem comandas

    const res = await request(app)
      .post('/api/mesas/itens/10/transferir')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ destinoId: 2 });

    expect(res.status).toBe(200);
    expect(prisma.pedido.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { mesaId: 2 },
    });
    expect(prisma.pedido.create).not.toHaveBeenCalled();
    expect(prisma.mesa.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'LIVRE', taxaAtiva: false },
    });
  });

  it('bloqueia quando a mesa tem pagamento parcial: 409', async () => {
    prisma.itemPedido.findUnique.mockResolvedValue(item);
    prisma.mesa.findUnique
      .mockResolvedValueOnce({ id: 1, numero: 1, status: 'OCUPADA' })
      .mockResolvedValueOnce({ id: 2, numero: 2, status: 'LIVRE' });
    prisma.pagamento.count.mockResolvedValue(1);

    const res = await request(app)
      .post('/api/mesas/itens/10/transferir')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ destinoId: 2 });
    expect(res.status).toBe(409);
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('recusa item de pedido que não é de mesa aberta: 409', async () => {
    prisma.itemPedido.findUnique.mockResolvedValue({
      ...item,
      pedido: { ...item.pedido, status: 'pago' },
    });

    const res = await request(app)
      .post('/api/mesas/itens/10/transferir')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ destinoId: 2 });
    expect(res.status).toBe(409);
  });
});
