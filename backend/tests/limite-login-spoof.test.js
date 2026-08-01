const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  usuario: { findMany: jest.fn() },
}));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { gerarHashPin } = require('../src/lib/pin');
const limiteLogin = require('../src/middlewares/limiteLogin');

/*
 * O PIN tem 4 dígitos: 10.000 combinações. O bloqueio por IP é a única coisa
 * entre um atacante e a conta do gerente — por isso ele não pode depender de
 * um header que o próprio atacante escreve.
 */

const TRUST_PROXY_ORIGINAL = process.env.TRUST_PROXY;

beforeEach(() => {
  jest.clearAllMocks();
  limiteLogin._resetar();
  prisma.usuario.findMany.mockResolvedValue([
    { id: 1, nome: 'Rico Gerente', papel: 'GERENTE', pinHash: gerarHashPin('9999') },
  ]);
});

afterEach(() => {
  if (TRUST_PROXY_ORIGINAL === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = TRUST_PROXY_ORIGINAL;
});

// Uma tentativa de PIN errado, opcionalmente forjando o IP de origem.
const tentar = (ipForjado) => {
  const req = request(app).post('/api/auth/login');
  if (ipForjado) req.set('CF-Connecting-IP', ipForjado);
  return req.send({ pin: '0000' });
};

describe('força-bruta de PIN: header de IP não pode furar o bloqueio', () => {
  it('sem proxy declarado, trocar CF-Connecting-IP NÃO escapa do bloqueio', async () => {
    delete process.env.TRUST_PROXY; // LAN / desktop / dev: sem proxy na frente

    // Atacante finge um IP diferente a cada tentativa.
    for (let i = 0; i < limiteLogin.MAX_FALHAS; i++) {
      const res = await tentar(`203.0.113.${i}`);
      expect(res.status).toBe(401); // ainda dentro da cota: erro de PIN
    }

    // A próxima cai no bloqueio mesmo com um IP "novo" — todas foram para o
    // mesmo balde, porque o header foi ignorado.
    const bloqueada = await tentar('203.0.113.250');
    expect(bloqueada.status).toBe(429);
  });

  it('sem proxy declarado, o PIN correto também é barrado depois do bloqueio', async () => {
    delete process.env.TRUST_PROXY;

    for (let i = 0; i < limiteLogin.MAX_FALHAS; i++) await tentar(`198.51.100.${i}`);

    const res = await request(app)
      .post('/api/auth/login')
      .set('CF-Connecting-IP', '198.51.100.99')
      .send({ pin: '9999' }); // PIN certo, mas o IP está de castigo
    expect(res.status).toBe(429);
  });

  it('com TRUST_PROXY=true, o IP do Cloudflare separa os baldes por cliente', async () => {
    process.env.TRUST_PROXY = 'true'; // VPS: Cloudflare sobrescreve o header

    // Cliente A queima toda a cota...
    for (let i = 0; i < limiteLogin.MAX_FALHAS; i++) await tentar('203.0.113.10');
    expect((await tentar('203.0.113.10')).status).toBe(429);

    // ...e o cliente B (garçom legítimo em outro IP) continua livre.
    expect((await tentar('203.0.113.20')).status).toBe(401);
  });

  it('login correto zera o contador do próprio IP', async () => {
    delete process.env.TRUST_PROXY;

    await tentar();
    await tentar();
    const ok = await request(app).post('/api/auth/login').send({ pin: '9999' });
    expect(ok.status).toBe(200);

    // Cota renovada: erra de novo sem cair direto no 429.
    expect((await tentar()).status).toBe(401);
  });
});
