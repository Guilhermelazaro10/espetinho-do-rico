const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  usuario: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  auditoria: { create: jest.fn() },
}));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { tokenDe } = require('./helpers/token');
const { verificarPin } = require('../src/lib/pin');

const gerente = tokenDe('GERENTE');
const garcom = tokenDe('GARCOM');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.auditoria.create.mockResolvedValue({});
});

describe('RH — /api/usuarios (exclusivo do gerente)', () => {
  it('garçom não acessa o RH: 403', async () => {
    const res = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${garcom}`);
    expect(res.status).toBe(403);
  });

  it('cadastra garçom e devolve PIN de 4 dígitos válido', async () => {
    prisma.usuario.findMany.mockResolvedValue([]);
    prisma.usuario.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 5, ativo: true, ...data })
    );

    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ nome: 'Pedro Garçom', papel: 'GARCOM' });

    expect(res.status).toBe(201);
    expect(res.body.pin).toMatch(/^\d{4}$/);
    // O PIN devolvido confere com o hash gravado no banco
    const { pinHash } = prisma.usuario.create.mock.calls[0][0].data;
    expect(verificarPin(res.body.pin, pinHash)).toBe(true);
    // Resposta nunca expõe o hash
    expect(res.body.pinHash).toBeUndefined();
  });

  it('papel inválido: 400', async () => {
    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ nome: 'Pedro', papel: 'ADMIN' });

    expect(res.status).toBe(400);
  });

  it('desligamento é soft delete (ativo=false)', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 5, nome: 'Pedro', papel: 'GARCOM', ativo: true });
    prisma.usuario.update.mockResolvedValue({});

    const res = await request(app)
      .delete('/api/usuarios/5')
      .set('Authorization', `Bearer ${gerente}`);

    expect(res.status).toBe(204);
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { ativo: false },
    });
  });

  it('gerente não desliga a si mesmo: 409', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 1, nome: 'Rico', papel: 'GERENTE', ativo: true });

    const res = await request(app)
      .delete('/api/usuarios/1')
      .set('Authorization', `Bearer ${gerente}`);

    expect(res.status).toBe(409);
  });
});

describe('Soft delete de produto — /api/produtos', () => {
  it('garçom não mexe no cardápio: 403', async () => {
    const res = await request(app)
      .delete('/api/produtos/1')
      .set('Authorization', `Bearer ${garcom}`);
    expect(res.status).toBe(403);
  });
});
