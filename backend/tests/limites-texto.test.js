const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  // Auth confere se o usuário do token segue ativo (middlewares/auth)
  usuario: { findUnique: jest.fn().mockResolvedValue({ ativo: true }) },
  produto: { findMany: jest.fn() },
  pedido: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
  auditoria: { create: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../src/services/printerService', () => ({ dispararImpressao: jest.fn() }));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { tokenDe } = require('./helpers/token');

/*
 * Texto livre sem limite vai inteiro para o banco, para o cupom térmico e para
 * cada tela que lista pedidos: um nome de 50.000 caracteres trava a impressora
 * e incha o SQLite. Acima do limite é 400 — truncar em silêncio esconderia o
 * problema de quem digitou.
 */

const gerente = tokenDe('GERENTE');
const longo = (n) => 'a'.repeat(n);

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  prisma.auditoria.create.mockResolvedValue({});
  prisma.produto.findMany.mockResolvedValue([{ id: 1, preco: 1000, ativo: true }]);
  prisma.pedido.create.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data, itens: [] }));
});

const delivery = (extra) => ({
  tipo: 'DELIVERY',
  clienteNome: 'Ana',
  clienteTelefone: '88999990000',
  clienteEndereco: 'Rua das Brasas, 10',
  taxaEntrega: 500,
  itens: [{ produtoId: 1, quantidade: 1 }],
  ...extra,
});

const criar = (corpo) =>
  request(app).post('/api/pedidos').set('Authorization', `Bearer ${gerente}`).send(corpo);

describe('limites de texto no pedido (validarCabecalho)', () => {
  it.each([
    ['clienteNome', 61],
    ['clienteTelefone', 21],
    ['clienteEndereco', 201],
  ])('%s acima do limite: 400', async (campo, tamanho) => {
    const valor = campo === 'clienteTelefone' ? '8'.repeat(tamanho) : longo(tamanho);
    const res = await criar(delivery({ [campo]: valor }));
    expect(res.status).toBe(400);
    expect(prisma.pedido.create).not.toHaveBeenCalled();
  });

  it('no limite exato passa', async () => {
    const res = await criar(
      delivery({ clienteNome: longo(60), clienteTelefone: '8'.repeat(20), clienteEndereco: longo(200) })
    );
    expect(res.status).toBe(201);
  });

  it('campo que não é texto: 400 (e não 500)', async () => {
    const res = await criar(delivery({ clienteNome: { $gt: '' } }));
    expect(res.status).toBe(400);
  });
});

describe('limite do motivo de cancelamento/recusa', () => {
  it('cancelar com motivo de 201 caracteres: 400', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ id: 5, status: 'aberto', itens: [] });
    const res = await request(app)
      .post('/api/pedidos/5/cancelar')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ motivo: longo(201) });
    expect(res.status).toBe(400);
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('recusar pedido online com motivo de 201 caracteres: 400', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ id: 5, status: 'pendente', itens: [] });
    const res = await request(app)
      .post('/api/pedidos/5/recusar')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ motivo: longo(201) });
    expect(res.status).toBe(400);
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });
});
