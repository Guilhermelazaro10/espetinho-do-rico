const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  produto: { findMany: jest.fn() },
  pedido: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
  pagamento: { create: jest.fn() },
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

const garcom = tokenDe('GARCOM');
const gerente = tokenDe('GERENTE');

const catalogo = [
  { id: 1, nome: 'Espeto de Carne', preco: 1200, ativo: true },
  { id: 4, nome: 'Cerveja', preco: 800, ativo: true },
];

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  prisma.auditoria.create.mockResolvedValue({});
  prisma.produto.findMany.mockImplementation(({ where }) =>
    Promise.resolve(catalogo.filter((p) => where.id.in.includes(p.id)))
  );
  prisma.pedido.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: 50, ...data, itens: [] })
  );
  prisma.pagamento.create.mockResolvedValue({});
});

const itens = [
  { produtoId: 1, quantidade: 2 },
  { produtoId: 4, quantidade: 1 },
];

describe('POST /api/pedidos/venda-rapida', () => {
  it('cria BALCAO sem cliente, já pago, com pagamento no caixa e comanda pra chapa', async () => {
    const res = await request(app)
      .post('/api/pedidos/venda-rapida')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ itens, formaPagamento: 'pix' });

    expect(res.status).toBe(201);
    const { data } = prisma.pedido.create.mock.calls[0][0];
    expect(data).toMatchObject({
      tipo: 'BALCAO',
      clienteNome: null,
      total: 3200, // 2x1200 + 800, calculado no servidor
      status: 'aberto', // vai pra chapa
      formaPagamento: 'pix',
      pagoAntecipado: true,
    });
    expect(prisma.pagamento.create).toHaveBeenCalledWith({
      data: { pedidoId: 50, forma: 'pix', valor: 3200 },
    });
    expect(printerService.dispararImpressao).toHaveBeenCalled();
  });

  it('ignora preço enviado pelo cliente', async () => {
    await request(app)
      .post('/api/pedidos/venda-rapida')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ itens: [{ produtoId: 4, quantidade: 1, precoUnitario: 1 }], formaPagamento: 'pix', total: 1 });
    expect(prisma.pedido.create.mock.calls[0][0].data.total).toBe(800);
  });

  it('dinheiro: calcula o troco e grava o pagamento LÍQUIDO', async () => {
    const res = await request(app)
      .post('/api/pedidos/venda-rapida')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ itens, formaPagamento: 'dinheiro', valorRecebido: 5000 });

    expect(res.status).toBe(201);
    expect(res.body.troco).toBe(1800);
    expect(prisma.pagamento.create.mock.calls[0][0].data.valor).toBe(3200);
    expect(prisma.pedido.create.mock.calls[0][0].data.trocoPara).toBe(5000);
  });

  it('dinheiro: recusa valor recebido menor que o total', async () => {
    const res = await request(app)
      .post('/api/pedidos/venda-rapida')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ itens, formaPagamento: 'dinheiro', valorRecebido: 1000 });

    expect(res.status).toBe(400);
    expect(prisma.pedido.create).not.toHaveBeenCalled();
    expect(prisma.pagamento.create).not.toHaveBeenCalled();
  });

  it('entregue na hora: nasce PAGO e não imprime comanda', async () => {
    await request(app)
      .post('/api/pedidos/venda-rapida')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ itens: [{ produtoId: 4, quantidade: 2 }], formaPagamento: 'cartao', entregueNaHora: true });

    expect(prisma.pedido.create.mock.calls[0][0].data.status).toBe('pago');
    expect(printerService.dispararImpressao).not.toHaveBeenCalled();
  });

  it('exige forma de pagamento', async () => {
    const res = await request(app)
      .post('/api/pedidos/venda-rapida')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ itens });
    expect(res.status).toBe(400);
  });

  it('é exclusiva do gerente (envolve dinheiro)', async () => {
    const res = await request(app)
      .post('/api/pedidos/venda-rapida')
      .set('Authorization', `Bearer ${garcom}`)
      .send({ itens, formaPagamento: 'pix' });
    expect(res.status).toBe(403);
    expect(prisma.pedido.create).not.toHaveBeenCalled();
  });
});

describe('ciclo da venda rápida depois de criada', () => {
  const vendaAberta = {
    id: 50, tipo: 'BALCAO', status: 'aberto', total: 3200, taxaEntrega: 0,
    formaPagamento: 'dinheiro', pagoAntecipado: true, mesaId: null, itens: [],
  };

  it('marcar "entregue" encerra direto como PAGO', async () => {
    prisma.pedido.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.pedido.findUnique.mockResolvedValue({ ...vendaAberta, status: 'pago' });

    const res = await request(app)
      .patch('/api/pedidos/50/status')
      .set('Authorization', `Bearer ${garcom}`)
      .send({ status: 'entregue' });

    expect(res.status).toBe(200);
    expect(prisma.pedido.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 50, pagoAntecipado: true },
      data: { status: 'pago' },
    });
  });

  it('não deixa cobrar de novo', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ ...vendaAberta, status: 'entregue' });
    const res = await request(app)
      .patch('/api/pedidos/50/pagamento')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ formaPagamento: 'pix' });
    expect(res.status).toBe(409);
    expect(prisma.pagamento.create).not.toHaveBeenCalled();
  });

  it('cancelar gera estorno NEGATIVO na mesma forma (não apaga o pagamento)', async () => {
    prisma.pedido.findUnique.mockResolvedValue(vendaAberta);
    prisma.pedido.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post('/api/pedidos/50/cancelar')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ motivo: 'cliente desistiu' });

    expect(res.status).toBe(200);
    expect(prisma.pagamento.create).toHaveBeenCalledWith({
      data: { pedidoId: 50, forma: 'dinheiro', valor: -3200 },
    });
  });

  it('não deixa remover item de venda já paga', async () => {
    prisma.pedido.findUnique.mockResolvedValue({
      ...vendaAberta,
      itens: [{ id: 9, quantidade: 1, precoUnitario: 800, produto: { nome: 'Cerveja' } }],
    });
    const res = await request(app)
      .delete('/api/pedidos/50/itens/9')
      .set('Authorization', `Bearer ${gerente}`);
    expect(res.status).toBe(409);
  });
});
