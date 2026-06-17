const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  usuario: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  auditoria: { create: jest.fn() },
}));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { tokenDe } = require('./helpers/token');
const { gerarHashPin } = require('../src/lib/pin');

const gerente = tokenDe('GERENTE');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.auditoria.create.mockResolvedValue({});
});

describe('POST /api/perfil/trocar-pin', () => {
  function usuarioComPin(pin) {
    return { id: 1, nome: 'Rico', papel: 'GERENTE', ativo: true, pinHash: gerarHashPin(pin) };
  }

  it('troca o PIN validando o atual', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuarioComPin('9999'));
    prisma.usuario.findMany.mockResolvedValue([]);
    prisma.usuario.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/perfil/trocar-pin')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ pinAtual: '9999', pinNovo: '4242' });

    expect(res.status).toBe(200);
    expect(prisma.usuario.update).toHaveBeenCalled();
  });

  it('PIN atual incorreto: 401', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuarioComPin('9999'));

    const res = await request(app)
      .post('/api/perfil/trocar-pin')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ pinAtual: '0000', pinNovo: '4242' });

    expect(res.status).toBe(401);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('novo PIN já usado por outro funcionário: 400', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuarioComPin('9999'));
    prisma.usuario.findMany.mockResolvedValue([{ id: 2, ativo: true, pinHash: gerarHashPin('4242') }]);

    const res = await request(app)
      .post('/api/perfil/trocar-pin')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ pinAtual: '9999', pinNovo: '4242' });

    expect(res.status).toBe(400);
  });

  it('exige autenticação: 401 sem token', async () => {
    const res = await request(app)
      .post('/api/perfil/trocar-pin')
      .send({ pinAtual: '9999', pinNovo: '4242' });

    expect(res.status).toBe(401);
  });
});
