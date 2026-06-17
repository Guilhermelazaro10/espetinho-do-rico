const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  caixa: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  movimentoCaixa: { create: jest.fn(), findMany: jest.fn() },
  pagamento: { groupBy: jest.fn() },
  auditoria: { create: jest.fn() },
}));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { tokenDe } = require('./helpers/token');

const gerente = tokenDe('GERENTE');
const garcom = tokenDe('GARCOM');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.auditoria.create.mockResolvedValue({});
});

describe('Caixa (turno) — exclusivo do gerente', () => {
  it('garçom não acessa o caixa: 403', async () => {
    const res = await request(app).get('/api/caixa/atual').set('Authorization', `Bearer ${garcom}`);
    expect(res.status).toBe(403);
  });

  it('abre caixa com fundo de troco', async () => {
    prisma.caixa.findFirst.mockResolvedValue(null);
    prisma.caixa.create.mockResolvedValue({ id: 1, status: 'aberto', fundoAbertura: 10000 });

    const res = await request(app)
      .post('/api/caixa/abrir')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ fundoAbertura: 10000 });

    expect(res.status).toBe(201);
    expect(prisma.caixa.create).toHaveBeenCalled();
  });

  it('não abre se já houver caixa aberto: 409', async () => {
    prisma.caixa.findFirst.mockResolvedValue({ id: 1, status: 'aberto' });

    const res = await request(app)
      .post('/api/caixa/abrir')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ fundoAbertura: 5000 });

    expect(res.status).toBe(409);
  });

  it('status calcula o esperado em dinheiro (fundo + dinheiro + suprimento − sangria)', async () => {
    prisma.caixa.findFirst.mockResolvedValue({
      id: 1, status: 'aberto', fundoAbertura: 10000, abertoEm: new Date('2026-06-15T10:00:00'),
      movimentos: [
        { tipo: 'suprimento', valor: 5000 },
        { tipo: 'sangria', valor: 3000 },
      ],
    });
    prisma.pagamento.groupBy.mockResolvedValue([
      { forma: 'dinheiro', _sum: { valor: 20000 }, _count: 4 },
      { forma: 'pix', _sum: { valor: 15000 }, _count: 2 },
    ]);

    const res = await request(app).get('/api/caixa/atual').set('Authorization', `Bearer ${gerente}`);

    expect(res.status).toBe(200);
    expect(res.body.resumo.esperadoDinheiro).toBe(32000); // 10000 + 20000 + 5000 - 3000
    expect(res.body.resumo.recebidoTotal).toBe(35000);
  });

  it('fecha com contagem cega e calcula a diferença (falta)', async () => {
    prisma.caixa.findFirst.mockResolvedValue({
      id: 1, status: 'aberto', fundoAbertura: 10000, abertoEm: new Date('2026-06-15T10:00:00'), movimentos: [],
    });
    prisma.pagamento.groupBy.mockResolvedValue([
      { forma: 'dinheiro', _sum: { valor: 20000 }, _count: 4 },
    ]);
    prisma.caixa.update.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }));

    const res = await request(app)
      .post('/api/caixa/fechar')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ valorContado: 29500 }); // esperado 30000 → falta 500

    expect(res.status).toBe(200);
    expect(res.body.resumo.esperadoDinheiro).toBe(30000);
    expect(res.body.resumo.diferenca).toBe(-500);
    expect(prisma.caixa.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'fechado', valorContado: 29500, diferenca: -500 }),
      })
    );
  });

  it('sangria registra com motivo; sem motivo → 400', async () => {
    prisma.caixa.findFirst.mockResolvedValue({ id: 1, status: 'aberto' });
    prisma.movimentoCaixa.create.mockResolvedValue({ id: 1 });

    const ok = await request(app)
      .post('/api/caixa/movimento')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ tipo: 'sangria', valor: 5000, motivo: 'pagar fornecedor' });
    expect(ok.status).toBe(201);

    const semMotivo = await request(app)
      .post('/api/caixa/movimento')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ tipo: 'sangria', valor: 5000, motivo: '' });
    expect(semMotivo.status).toBe(400);
  });
});
