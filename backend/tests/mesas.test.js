const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  mesa: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  produto: { count: jest.fn(), findMany: jest.fn() },
  pedido: { create: jest.fn(), count: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  pagamento: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
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

const gerente = tokenDe('GERENTE');
const garcom = tokenDe('GARCOM');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  prisma.auditoria.create.mockResolvedValue({});
});

describe('GET /api/mesas', () => {
  it('exige autenticação: 401 sem token', async () => {
    const res = await request(app).get('/api/mesas');
    expect(res.status).toBe(401);
  });

  it('garçom autenticado vê o mapa de mesas', async () => {
    const mesas = [{ id: 1, numero: 1, status: 'LIVRE', taxaAtiva: false }];
    prisma.mesa.findMany.mockResolvedValue(mesas);

    const res = await request(app).get('/api/mesas').set('Authorization', `Bearer ${garcom}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mesas);
  });
});

describe('POST /api/mesas/:id/pre-conta — fechar conta pelo garçom', () => {
  it('muda a mesa para AGUARDANDO_PAGAMENTO e imprime a conferência', async () => {
    prisma.mesa.findUnique.mockResolvedValue({ id: 1, numero: 1, status: 'OCUPADA', taxaAtiva: false });
    prisma.pedido.findMany.mockResolvedValue([
      { id: 1, total: 4800, itens: [] },
    ]);
    prisma.pagamento.findMany.mockResolvedValue([]);
    prisma.mesa.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/mesas/1/pre-conta')
      .set('Authorization', `Bearer ${garcom}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'AGUARDANDO_PAGAMENTO', totalDevido: 4800 });
    expect(prisma.mesa.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'AGUARDANDO_PAGAMENTO' },
    });
    expect(printerService.dispararImpressaoPreConta).toHaveBeenCalledTimes(1);
  });

  it('mesa sem consumo: 409', async () => {
    prisma.mesa.findUnique.mockResolvedValue({ id: 1, numero: 1, status: 'LIVRE', taxaAtiva: false });
    prisma.pedido.findMany.mockResolvedValue([]);
    prisma.pagamento.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/mesas/1/pre-conta')
      .set('Authorization', `Bearer ${garcom}`);

    expect(res.status).toBe(409);
  });
});

describe('POST /api/mesas/:id/pagamentos — pagamento parcial (só GERENTE)', () => {
  function prepararMesaCom100Reais({ pagosAntes = [] } = {}) {
    prisma.mesa.findUnique.mockResolvedValue({
      id: 1, numero: 1, status: 'AGUARDANDO_PAGAMENTO', taxaAtiva: false,
    });
    prisma.pedido.findMany.mockResolvedValue([
      { id: 1, total: 10000, status: 'entregue', itens: [] },
    ]);
    prisma.pagamento.findMany.mockResolvedValue(pagosAntes);
    prisma.pagamento.create.mockResolvedValue({});
    prisma.pagamento.updateMany.mockResolvedValue({});
    prisma.pedido.updateMany.mockResolvedValue({ count: 1 });
    prisma.mesa.update.mockResolvedValue({});
  }

  it('GARÇOM NÃO ACESSA rota de pagamento: 403', async () => {
    const res = await request(app)
      .post('/api/mesas/1/pagamentos')
      .set('Authorization', `Bearer ${garcom}`)
      .send({ forma: 'pix', valor: 5000 });

    expect(res.status).toBe(403);
    expect(prisma.pagamento.create).not.toHaveBeenCalled();
  });

  it('mesa de R$100: parcial de R$50 em pix NÃO libera a mesa', async () => {
    prepararMesaCom100Reais();

    const res = await request(app)
      .post('/api/mesas/1/pagamentos')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ forma: 'pix', valor: 5000 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ saldoDevedor: 5000, liberada: false, troco: 0 });
    expect(prisma.pagamento.create).toHaveBeenCalledWith({
      data: { mesaId: 1, forma: 'pix', valor: 5000, liquidado: false },
    });
    // Mesa NÃO foi liberada
    expect(prisma.mesa.update).not.toHaveBeenCalled();
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('segundo parcial de R$50 em dinheiro zera o saldo e LIBERA a mesa', async () => {
    prepararMesaCom100Reais({
      pagosAntes: [{ id: 1, forma: 'pix', valor: 5000, liquidado: false }],
    });

    const res = await request(app)
      .post('/api/mesas/1/pagamentos')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ forma: 'dinheiro', valor: 5000 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ saldoDevedor: 0, liberada: true });
    // Comandas pagas com forma "multiplo" (pix + dinheiro)
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pago', formaPagamento: 'multiplo' }),
      })
    );
    // Parciais liquidados e mesa LIVRE
    expect(prisma.pagamento.updateMany).toHaveBeenCalledWith({
      where: { mesaId: 1, liquidado: false },
      data: { liquidado: true },
    });
    expect(prisma.mesa.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'LIVRE', taxaAtiva: false },
    });
  });

  it('troco só sobre dinheiro: pix acima do saldo é rejeitado', async () => {
    prepararMesaCom100Reais();

    const res = await request(app)
      .post('/api/mesas/1/pagamentos')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ forma: 'pix', valor: 12000 });

    expect(res.status).toBe(400);
    expect(res.body.erro).toContain('dinheiro');
  });

  it('dinheiro acima do saldo gera troco e registra o líquido', async () => {
    prepararMesaCom100Reais();

    const res = await request(app)
      .post('/api/mesas/1/pagamentos')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ forma: 'dinheiro', valor: 12000 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ troco: 2000, saldoDevedor: 0, liberada: true });
    expect(prisma.pagamento.create).toHaveBeenCalledWith({
      data: { mesaId: 1, forma: 'dinheiro', valor: 10000, liquidado: false },
    });
  });

  it('corrida com outro operador (guard de status): 409', async () => {
    prepararMesaCom100Reais();
    prisma.pedido.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app)
      .post('/api/mesas/1/pagamentos')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ forma: 'pix', valor: 10000 });

    expect(res.status).toBe(409);
    expect(res.body.erro).toContain('outro operador');
  });
});
