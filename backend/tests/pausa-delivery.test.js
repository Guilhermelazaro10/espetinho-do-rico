const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  // Auth confere se o usuário do token segue ativo (middlewares/auth)
  usuario: { findUnique: jest.fn().mockResolvedValue({ ativo: true }) },
  configuracao: { findUnique: jest.fn(), upsert: jest.fn() },
  auditoria: { create: jest.fn() },
}));
jest.mock('../src/services/produtosService', () => ({ listar: jest.fn() }));
jest.mock('../src/services/pedidosService', () => ({ criar: jest.fn(), statusPublico: jest.fn() }));

const prisma = require('../src/lib/prisma');
const produtosService = require('../src/services/produtosService');
const pedidosService = require('../src/services/pedidosService');
const app = require('../src/app');
const { _limparCache } = require('../src/services/configService');
const { _resetar } = require('../src/middlewares/limitePublico');
const { tokenDe } = require('./helpers/token');

const garcom = tokenDe('GARCOM');
const gerente = tokenDe('GERENTE');

const pedidoBase = {
  clienteNome: 'Ana', clienteTelefone: '88999990000', clienteEndereco: 'Rua das Brasas, 10',
  itens: [{ produtoId: 1, quantidade: 1 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  _limparCache();
  _resetar();
  prisma.auditoria.create.mockResolvedValue({});
  prisma.configuracao.upsert.mockResolvedValue({});
  produtosService.listar.mockResolvedValue([]);
  pedidosService.criar.mockResolvedValue({ id: 1, tipo: 'BALCAO', total: 0, itens: [] });
});

function deliveryNoBanco(valor) {
  prisma.configuracao.findUnique.mockResolvedValue(valor == null ? null : { chave: 'delivery_ativo', valor });
}

describe('Pausar delivery', () => {
  it('instalação nova (sem configuração salva) segue com delivery ativo', async () => {
    deliveryNoBanco(null);
    const res = await request(app).get('/api/publico/cardapio');
    expect(res.body.loja.delivery).toBe(true);
  });

  it('pausado: cardápio informa e a API recusa DELIVERY', async () => {
    deliveryNoBanco('false');

    const cardapio = await request(app).get('/api/publico/cardapio');
    expect(cardapio.body.loja.delivery).toBe(false);

    const res = await request(app).post('/api/publico/pedidos').send({ ...pedidoBase, tipo: 'DELIVERY' });
    expect(res.status).toBe(409);
    expect(pedidosService.criar).not.toHaveBeenCalled();
  });

  it('pausado: retirada continua funcionando', async () => {
    deliveryNoBanco('false');
    const res = await request(app).post('/api/publico/pedidos').send({ ...pedidoBase, tipo: 'BALCAO' });
    expect(res.status).toBe(201);
  });

  it('gerente pausa: grava, audita e o cardápio passa a refletir na hora', async () => {
    deliveryNoBanco('true');
    const res = await request(app)
      .patch('/api/loja/delivery')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ ativo: false });

    expect(res.status).toBe(200);
    expect(prisma.configuracao.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { valor: 'false' } })
    );
    expect(prisma.auditoria.create).toHaveBeenCalled();

    const cardapio = await request(app).get('/api/publico/cardapio');
    expect(cardapio.body.loja.delivery).toBe(false);
  });

  it('garçom não pode pausar', async () => {
    const res = await request(app)
      .patch('/api/loja/delivery')
      .set('Authorization', `Bearer ${garcom}`)
      .send({ ativo: false });
    expect(res.status).toBe(403);
    expect(prisma.configuracao.upsert).not.toHaveBeenCalled();
  });

  it('valida o corpo (booleano)', async () => {
    const res = await request(app)
      .patch('/api/loja/delivery')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ ativo: 'nao' });
    expect(res.status).toBe(400);
  });
});
