const request = require('supertest');

jest.mock('../src/services/produtosService', () => ({ listar: jest.fn() }));
jest.mock('../src/services/pedidosService', () => ({ criar: jest.fn(), statusPublico: jest.fn() }));

const produtosService = require('../src/services/produtosService');
const pedidosService = require('../src/services/pedidosService');
const app = require('../src/app');
const { _resetar } = require('../src/middlewares/limitePublico');

beforeEach(() => {
  jest.clearAllMocks();
  _resetar();
});

describe('Cardápio online — rotas públicas', () => {
  it('GET /api/publico/cardapio agrupa itens ativos por categoria (sem login)', async () => {
    produtosService.listar.mockResolvedValue([
      { id: 1, nome: 'Cerveja', preco: 500, categoria: 'Bebidas', ativo: true },
      { id: 2, nome: 'Suco', preco: 300, categoria: 'Bebidas', ativo: true },
      { id: 3, nome: 'Carne', preco: 700, categoria: 'Espetinhos', ativo: true },
    ]);

    const res = await request(app).get('/api/publico/cardapio');

    expect(res.status).toBe(200);
    expect(res.body.loja).toHaveProperty('nome');
    expect(res.body.categorias).toHaveLength(2);
    const bebidas = res.body.categorias.find((c) => c.nome === 'Bebidas');
    expect(bebidas.itens).toHaveLength(2);
    expect(produtosService.listar).toHaveBeenCalledWith({ incluirInativos: false });
  });

  it('POST /api/publico/pedidos rejeita tipo MESA (só DELIVERY/BALCAO)', async () => {
    const res = await request(app)
      .post('/api/publico/pedidos')
      .send({ tipo: 'MESA', mesaId: 1, itens: [{ produtoId: 1, quantidade: 1 }] });

    expect(res.status).toBe(400);
    expect(pedidosService.criar).not.toHaveBeenCalled();
  });

  it('POST /api/publico/pedidos cria DELIVERY e devolve o resumo', async () => {
    pedidosService.criar.mockResolvedValue({
      id: 7, tipo: 'DELIVERY', total: 1200, taxaEntrega: 0, clienteNome: 'Ana',
      itens: [{ quantidade: 1, precoUnitario: 1200, observacao: null, produto: { nome: 'Combo' } }],
    });

    const res = await request(app).post('/api/publico/pedidos').send({
      tipo: 'DELIVERY', clienteNome: 'Ana', clienteTelefone: '88999990000',
      clienteEndereco: 'Rua das Brasas, 10', itens: [{ produtoId: 1, quantidade: 1 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(7);
    expect(res.body.itens[0].nome).toBe('Combo');
    expect(pedidosService.criar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'DELIVERY', mesaId: null })
    );
  });

  it('GET /pedidos/:id/status devolve só o status (acompanhamento público)', async () => {
    pedidosService.statusPublico.mockResolvedValue({ status: 'pendente', tipo: 'DELIVERY', total: 2500 });
    const res = await request(app).get('/api/publico/pedidos/7/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'pendente', tipo: 'DELIVERY', total: 2500 });
    expect(pedidosService.statusPublico).toHaveBeenCalledWith(7);
  });

  it('bloqueia após exceder o limite de pedidos por IP (anti-spam)', async () => {
    pedidosService.criar.mockResolvedValue({ id: 1, tipo: 'BALCAO', total: 100, itens: [] });
    const corpo = { tipo: 'BALCAO', clienteNome: 'Ze', itens: [{ produtoId: 1, quantidade: 1 }] };

    for (let i = 0; i < 6; i++) {
      await request(app).post('/api/publico/pedidos').send(corpo);
    }
    const res = await request(app).post('/api/publico/pedidos').send(corpo);
    expect(res.status).toBe(429);
  });
});
