const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  usuario: { findUnique: jest.fn(), update: jest.fn() },
  mesa: { findMany: jest.fn() },
  auditoria: { create: jest.fn() },
}));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { _limparCacheUsuarios } = require('../src/middlewares/auth');
const { tokenDe } = require('./helpers/token');
const jwt = require('jsonwebtoken');

/*
 * O token vale 12h (um turno). Sem conferir o banco, o funcionário desligado
 * de manhã seguia lançando pedido e mexendo no caixa até a noite.
 */

const garcom = tokenDe('GARCOM');
const gerenteDe = (id) => jwt.sign({ id, nome: 'Rico', papel: 'GERENTE' }, process.env.JWT_SECRET);

beforeEach(() => {
  jest.clearAllMocks();
  _limparCacheUsuarios();
  prisma.mesa.findMany.mockResolvedValue([]);
  prisma.auditoria.create.mockResolvedValue({});
});

describe('token de funcionário desligado', () => {
  it('usuário ativo passa', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 1, ativo: true });
    const res = await request(app).get('/api/mesas').set('Authorization', `Bearer ${garcom}`);
    expect(res.status).toBe(200);
  });

  it('usuário desligado recebe 401 mesmo com token válido', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 1, ativo: false });
    const res = await request(app).get('/api/mesas').set('Authorization', `Bearer ${garcom}`);
    expect(res.status).toBe(401);
  });

  it('usuário que não existe mais recebe 401', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/mesas').set('Authorization', `Bearer ${garcom}`);
    expect(res.status).toBe(401);
  });

  it('consulta o banco no máximo uma vez a cada 30s por usuário', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 1, ativo: true });
    const agora = Date.now();
    const relogio = jest.spyOn(Date, 'now').mockReturnValue(agora);
    try {
      await request(app).get('/api/mesas').set('Authorization', `Bearer ${garcom}`);
      await request(app).get('/api/mesas').set('Authorization', `Bearer ${garcom}`);
      expect(prisma.usuario.findUnique).toHaveBeenCalledTimes(1);

      relogio.mockReturnValue(agora + 31_000);
      await request(app).get('/api/mesas').set('Authorization', `Bearer ${garcom}`);
      expect(prisma.usuario.findUnique).toHaveBeenCalledTimes(2);
    } finally {
      relogio.mockRestore();
    }
  });

  it('desligar o funcionário corta o acesso na hora (sem esperar o cache)', async () => {
    const pedro = jwt.sign({ id: 5, nome: 'Pedro', papel: 'GARCOM' }, process.env.JWT_SECRET);
    const ativos = new Map([[1, true], [5, true]]);
    prisma.usuario.findUnique.mockImplementation(({ where }) =>
      Promise.resolve({ id: where.id, nome: 'Pedro', papel: 'GARCOM', ativo: ativos.get(where.id) })
    );
    prisma.usuario.update.mockImplementation(({ where, data }) => {
      ativos.set(where.id, data.ativo);
      return Promise.resolve({});
    });

    expect((await request(app).get('/api/mesas').set('Authorization', `Bearer ${pedro}`)).status).toBe(200);

    const desligou = await request(app)
      .delete('/api/usuarios/5')
      .set('Authorization', `Bearer ${gerenteDe(1)}`);
    expect(desligou.status).toBe(204);

    expect((await request(app).get('/api/mesas').set('Authorization', `Bearer ${pedro}`)).status).toBe(401);
  });
});
