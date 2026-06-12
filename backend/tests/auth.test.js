const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  usuario: { findMany: jest.fn() },
  produto: { count: jest.fn() },
  mesa: { count: jest.fn() },
}));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { gerarHashPin } = require('../src/lib/pin');

beforeEach(() => jest.clearAllMocks());

describe('POST /api/auth/login', () => {
  it('autentica com PIN correto e devolve token + papel', async () => {
    prisma.usuario.findMany.mockResolvedValue([
      { id: 1, nome: 'Maria Caixa', papel: 'caixa', pinHash: gerarHashPin('2222') },
    ]);

    const res = await request(app).post('/api/auth/login').send({ pin: '2222' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.usuario).toMatchObject({ nome: 'Maria Caixa', papel: 'caixa' });
  });

  it('PIN errado: 401 sem vazar detalhes', async () => {
    prisma.usuario.findMany.mockResolvedValue([
      { id: 1, nome: 'Maria Caixa', papel: 'caixa', pinHash: gerarHashPin('2222') },
    ]);

    const res = await request(app).post('/api/auth/login').send({ pin: '0000' });

    expect(res.status).toBe(401);
    expect(res.body.erro).toBe('PIN não reconhecido');
  });

  it('PIN com formato inválido: 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ pin: 'abc' });

    expect(res.status).toBe(400);
    expect(prisma.usuario.findMany).not.toHaveBeenCalled();
  });

  it('token adulterado é rejeitado com 401', async () => {
    const res = await request(app)
      .get('/api/mesas')
      .set('Authorization', 'Bearer token-falso-qualquer');

    expect(res.status).toBe(401);
    expect(res.body.erro).toContain('Sessão inválida');
  });
});
