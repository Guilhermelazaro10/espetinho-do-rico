const request = require('supertest');

process.env.PRINT_AGENT_TOKEN = 'token-agente-teste';

jest.mock('../src/lib/prisma', () => ({
  printJob: {
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  produto: { count: jest.fn() },
  mesa: { count: jest.fn() },
}));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');

const auth = { Authorization: 'Bearer token-agente-teste' };

beforeEach(() => jest.clearAllMocks());

describe('Fila de impressão — API do agente', () => {
  it('sem token: 401', async () => {
    const res = await request(app).get('/api/impressao/proximos');
    expect(res.status).toBe(401);
  });

  it('token errado: 401', async () => {
    const res = await request(app)
      .get('/api/impressao/proximos')
      .set('Authorization', 'Bearer token-errado');
    expect(res.status).toBe(401);
  });

  it('lista os cupons pendentes para o agente', async () => {
    prisma.printJob.findMany.mockResolvedValue([
      { id: 1, tipo: 'cupom', conteudo: 'linha', status: 'pendente' },
    ]);

    const res = await request(app).get('/api/impressao/proximos').set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(prisma.printJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'pendente' } })
    );
  });

  it('conclui um cupom que estava em processamento', async () => {
    prisma.printJob.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app).post('/api/impressao/5/concluir').set(auth);

    expect(res.status).toBe(200);
    expect(prisma.printJob.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: 'processando' },
      data: { status: 'impresso' },
    });
  });

  it('reivindica os jobs ao servir (marca processando)', async () => {
    prisma.printJob.updateMany.mockResolvedValue({ count: 0 });
    prisma.printJob.findMany.mockResolvedValue([{ id: 7, tipo: 'cupom', conteudo: 'x' }]);

    const res = await request(app).get('/api/impressao/proximos').set(auth);

    expect(res.status).toBe(200);
    // último updateMany = reivindicação dos ids retornados → processando
    expect(prisma.printJob.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [7] } },
      data: { status: 'processando' },
    });
  });

  it('falha transitória volta o cupom para a fila', async () => {
    prisma.printJob.findUnique.mockResolvedValue({ id: 5, tentativas: 0 });
    prisma.printJob.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/impressao/5/falhar')
      .set(auth)
      .send({ erro: 'sem papel' });

    expect(res.status).toBe(200);
    expect(prisma.printJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pendente', tentativas: 1 }) })
    );
  });

  it('falha na última tentativa marca como erro (sai da fila)', async () => {
    prisma.printJob.findUnique.mockResolvedValue({ id: 5, tentativas: 4 });
    prisma.printJob.update.mockResolvedValue({});

    await request(app).post('/api/impressao/5/falhar').set(auth).send({ erro: 'x' });

    expect(prisma.printJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'erro', tentativas: 5 }) })
    );
  });
});
