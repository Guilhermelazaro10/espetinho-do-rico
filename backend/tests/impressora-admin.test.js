const request = require('supertest');
const { tokenDe } = require('./helpers/token');

jest.mock('../src/lib/prisma', () => ({
  printJob: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    groupBy: jest.fn(),
  },
  produto: { count: jest.fn() },
  mesa: { count: jest.fn() },
}));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');

const gerente = { Authorization: `Bearer ${tokenDe('GERENTE')}` };
const garcom = { Authorization: `Bearer ${tokenDe('GARCOM')}` };

beforeEach(() => jest.clearAllMocks());

describe('Painel de impressão — API do gerente', () => {
  it('garçom não acessa (403)', async () => {
    const res = await request(app).get('/api/impressora').set(garcom);
    expect(res.status).toBe(403);
  });

  it('resumo traz presença do agente, contadores da fila e recentes', async () => {
    prisma.printJob.groupBy.mockResolvedValue([
      { status: 'pendente', _count: { _all: 2 } },
      { status: 'impresso', _count: { _all: 5 } },
    ]);
    prisma.printJob.findMany.mockResolvedValue([{ id: 9, tipo: 'cupom', status: 'impresso' }]);

    const res = await request(app).get('/api/impressora').set(gerente);

    expect(res.status).toBe(200);
    expect(res.body.fila).toEqual({ pendente: 2, processando: 0, impresso: 5, erro: 0 });
    expect(res.body.recentes).toHaveLength(1);
    expect(res.body.agente).toHaveProperty('online');
  });

  it('dispara um cupom de teste (enfileira tipo "teste")', async () => {
    prisma.printJob.create.mockResolvedValue({ id: 42 });

    const res = await request(app).post('/api/impressora/teste').set(gerente);

    expect(res.status).toBe(201);
    expect(prisma.printJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'teste' }) })
    );
  });

  it('reimprime re-enfileirando o mesmo conteúdo', async () => {
    prisma.printJob.findUnique.mockResolvedValue({
      id: 7, tipo: 'cupom', conteudo: 'linha A\nlinha B', refId: 3, abrirGaveta: false,
    });
    prisma.printJob.create.mockResolvedValue({ id: 99 });

    const res = await request(app).post('/api/impressora/7/reimprimir').set(gerente);

    expect(res.status).toBe(201);
    expect(prisma.printJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'cupom', conteudo: 'linha A\nlinha B' }) })
    );
  });

  it('reimprimir cupom inexistente → 404', async () => {
    prisma.printJob.findUnique.mockResolvedValue(null);
    const res = await request(app).post('/api/impressora/123/reimprimir').set(gerente);
    expect(res.status).toBe(404);
  });
});
