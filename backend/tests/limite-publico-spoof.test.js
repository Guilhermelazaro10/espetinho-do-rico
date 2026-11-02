const request = require('supertest');

jest.mock('../src/services/produtosService', () => ({ listar: jest.fn() }));
jest.mock('../src/services/pedidosService', () => ({ criar: jest.fn() }));
jest.mock('../src/services/configService', () => ({ deliveryAtivo: jest.fn().mockResolvedValue(true) }));

const pedidosService = require('../src/services/pedidosService');
const app = require('../src/app');
const { _resetar } = require('../src/middlewares/limitePublico');

/*
 * Mesmo furo que o login tinha: sem proxy na frente, CF-Connecting-IP é texto
 * que o próprio bot escreve. Variando o header a cada pedido, ele caía num
 * balde novo e inundava a cozinha passando pelo anti-spam.
 */

const TRUST_PROXY_ORIGINAL = process.env.TRUST_PROXY;
const corpo = { tipo: 'BALCAO', clienteNome: 'Ze', itens: [{ produtoId: 1, quantidade: 1 }] };

beforeEach(() => {
  jest.clearAllMocks();
  _resetar();
  pedidosService.criar.mockResolvedValue({ id: 1, tipo: 'BALCAO', total: 100, itens: [] });
});

afterEach(() => {
  if (TRUST_PROXY_ORIGINAL === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = TRUST_PROXY_ORIGINAL;
});

const pedirComo = (ip) =>
  request(app).post('/api/publico/pedidos').set('CF-Connecting-IP', ip).send(corpo);

describe('anti-spam público: header de IP não fura o limite', () => {
  it('sem TRUST_PROXY, 20 pedidos com CF-Connecting-IP diferentes caem no mesmo limite de 6', async () => {
    delete process.env.TRUST_PROXY;
    const status = [];
    for (let i = 0; i < 20; i++) status.push((await pedirComo(`203.0.113.${i}`)).status);

    expect(status.filter((s) => s === 201)).toHaveLength(6);
    expect(status.slice(6).every((s) => s === 429)).toBe(true);
    expect(pedidosService.criar).toHaveBeenCalledTimes(6);
  });

  it('com TRUST_PROXY=true, clientes diferentes do Cloudflare têm limites separados', async () => {
    process.env.TRUST_PROXY = 'true';
    for (let i = 0; i < 6; i++) await pedirComo('203.0.113.10');
    expect((await pedirComo('203.0.113.10')).status).toBe(429);
    expect((await pedirComo('203.0.113.20')).status).toBe(201);
  });
});
