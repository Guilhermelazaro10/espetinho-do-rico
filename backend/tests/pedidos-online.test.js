const request = require('supertest');
const { tokenDe } = require('./helpers/token');

jest.mock('../src/services/pedidosService', () => ({ aceitar: jest.fn(), recusar: jest.fn() }));

const pedidosService = require('../src/services/pedidosService');
const app = require('../src/app');

const auth = { Authorization: `Bearer ${tokenDe('GARCOM')}` };

beforeEach(() => jest.clearAllMocks());

describe('Pedidos online — aceitar/recusar', () => {
  it('exige autenticação', async () => {
    const res = await request(app).post('/api/pedidos/5/aceitar');
    expect(res.status).toBe(401);
  });

  it('aceitar confirma o pedido (qualquer usuário autenticado)', async () => {
    pedidosService.aceitar.mockResolvedValue({ id: 5, status: 'aberto' });
    const res = await request(app).post('/api/pedidos/5/aceitar').set(auth);
    expect(res.status).toBe(200);
    expect(pedidosService.aceitar).toHaveBeenCalledWith(5, expect.objectContaining({ papel: 'GARCOM' }));
  });

  it('recusar repassa o motivo', async () => {
    pedidosService.recusar.mockResolvedValue({ ok: true });
    const res = await request(app)
      .post('/api/pedidos/5/recusar')
      .set(auth)
      .send({ motivo: 'fora da area de entrega' });
    expect(res.status).toBe(200);
    expect(pedidosService.recusar).toHaveBeenCalledWith(5, 'fora da area de entrega', expect.anything());
  });
});
