const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  usuario: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  auditoria: { create: jest.fn() },
}));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { gerarHashPin, verificarPin } = require('../src/lib/pin');
const limiteLogin = require('../src/middlewares/limiteLogin');
const { tokenDe } = require('./helpers/token');

/*
 * Login é só por PIN. O hash era feito com scryptSync, que trava o event loop
 * (~50ms por usuário a cada tentativa): uma rajada de logins congelava o PDV
 * inteiro. E 4 dígitos para o gerente são 10.000 combinações contra a conta
 * que mexe em dinheiro.
 */

// Hash gerado pela versão antiga (scryptSync) para o PIN "1234".
const HASH_LEGADO_1234 =
  '0123456789abcdef0123456789abcdef:d0caf5e9d4e56daa5b37a77f8f8379c934032d6f50cacd5fd8ad8d32f6aff2c8';

const TRUST_PROXY_ORIGINAL = process.env.TRUST_PROXY;
const gerente = tokenDe('GERENTE');

beforeEach(() => {
  jest.clearAllMocks();
  // Auth confere se o usuário do token segue ativo; cada teste pode sobrescrever
  prisma.usuario.findUnique.mockResolvedValue({ id: 1, ativo: true });
  limiteLogin._resetar();
  prisma.auditoria.create.mockResolvedValue({});
});

afterEach(() => {
  if (TRUST_PROXY_ORIGINAL === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = TRUST_PROXY_ORIGINAL;
});

describe('lib/pin assíncrono', () => {
  it('verificarPin devolve Promise (não bloqueia o servidor)', async () => {
    const resultado = verificarPin('1234', HASH_LEGADO_1234);
    expect(resultado).toBeInstanceOf(Promise);
    await resultado;
  });

  it('PIN salvo pela versão antiga continua entrando', async () => {
    expect(await verificarPin('1234', HASH_LEGADO_1234)).toBe(true);
    expect(await verificarPin('4321', HASH_LEGADO_1234)).toBe(false);
  });

  it('hash novo mantém o formato salt:hash e confere', async () => {
    const hash = await gerarHashPin('987654');
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(await verificarPin('987654', hash)).toBe(true);
  });

  it('hash corrompido não derruba: só não confere', async () => {
    expect(await verificarPin('1234', 'lixo')).toBe(false);
  });
});

describe('limite global de falhas de login (ataque distribuído)', () => {
  /*
   * Estes testes eram intermitentes. Cada um faz até ~37 logins com scrypt de
   * verdade; numa máquina carregada o 1º passava dos 5s padrão do Jest, levava
   * timeout e o laço dele SEGUIA rodando em segundo plano — registrando falhas
   * depois do _resetar() do teste seguinte, que então tomava 429.
   *
   * Agora: (1) o estado do limite é zerado no início de cada teste; (2) o
   * relógio é falso e parado (só o Date — setTimeout, I/O e nextTick seguem
   * reais, senão o supertest e o scrypt travam), então a janela de 60s não
   * depende da velocidade da máquina; (3) o prazo cobre o pior caso, para
   * nenhum teste largar um laço vivo.
   */
  const INICIO = new Date('2026-11-04T20:00:00-03:00').getTime();
  const PRAZO_MS = 60_000;

  beforeEach(() => {
    jest.useFakeTimers({
      now: INICIO,
      doNotFake: [
        'nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout',
        'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance',
      ],
    });
    limiteLogin._resetar();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function prepararGerente() {
    prisma.usuario.findMany.mockResolvedValue([
      { id: 1, nome: 'Rico', papel: 'GERENTE', ativo: true, pinHash: await gerarHashPin('987654') },
    ]);
  }
  const tentarDe = (ip, pin = '000000') =>
    request(app).post('/api/auth/login').set('CF-Connecting-IP', ip).send({ pin });

  it('mais de 30 falhas/min somando IPs bloqueia novos logins com 429', async () => {
    process.env.TRUST_PROXY = 'true'; // cada IP num balde próprio
    await prepararGerente();

    for (let i = 0; i < 31; i++) {
      expect((await tentarDe(`203.0.113.${i}`)).status).toBe(401);
    }
    // IP novo, PIN certo: barrado pelo limite global
    const res = await tentarDe('198.51.100.1', '987654');
    expect(res.status).toBe(429);
  }, PRAZO_MS);

  it('até 30 falhas no minuto o login legítimo segue', async () => {
    process.env.TRUST_PROXY = 'true';
    await prepararGerente();

    for (let i = 0; i < 30; i++) await tentarDe(`203.0.113.${i}`);
    expect((await tentarDe('198.51.100.1', '987654')).status).toBe(200);
  }, PRAZO_MS);

  it('durante o bloqueio global, IP que já logou antes entra; IP novo recebe 429', async () => {
    process.env.TRUST_PROXY = 'true';
    await prepararGerente();

    expect((await tentarDe('198.51.100.7', '987654')).status).toBe(200); // aparelho da loja
    for (let i = 0; i < 31; i++) await tentarDe(`203.0.113.${i}`);

    expect((await tentarDe('198.51.100.7', '987654')).status).toBe(200);
    expect((await tentarDe('198.51.100.8', '987654')).status).toBe(429);
  }, PRAZO_MS);

  it('IP conhecido continua sujeito ao limite por IP durante o bloqueio global', async () => {
    process.env.TRUST_PROXY = 'true';
    await prepararGerente();

    await tentarDe('198.51.100.7', '987654');
    for (let i = 0; i < 31; i++) await tentarDe(`203.0.113.${i}`);
    for (let i = 0; i < limiteLogin.MAX_FALHAS; i++) await tentarDe('198.51.100.7');

    expect((await tentarDe('198.51.100.7', '987654')).status).toBe(429);
  }, PRAZO_MS);

  it('IP que não loga há mais de 7 dias deixa de ser conhecido', async () => {
    process.env.TRUST_PROXY = 'true';
    await prepararGerente();
    await tentarDe('198.51.100.7', '987654');
    jest.setSystemTime(INICIO + 7 * 24 * 60 * 60 * 1000 + 1000);
    for (let i = 0; i < 31; i++) await tentarDe(`203.0.113.${i}`);
    expect((await tentarDe('198.51.100.7', '987654')).status).toBe(429);
  }, PRAZO_MS);

  it('lista de IPs conhecidos guarda no máximo 500 (sai o mais antigo)', async () => {
    process.env.TRUST_PROXY = 'true';
    await prepararGerente();

    await tentarDe('198.51.100.7', '987654'); // o mais antigo
    for (let i = 0; i < 500; i++) limiteLogin.ok({ headers: { 'cf-connecting-ip': `10.0.${i >> 8}.${i & 255}` } });
    for (let i = 0; i < 31; i++) await tentarDe(`203.0.113.${i}`);

    expect((await tentarDe('198.51.100.7', '987654')).status).toBe(429);
    expect((await tentarDe('10.0.1.243', '987654')).status).toBe(200); // o 500º, mais recente
  }, PRAZO_MS);

  it('o bloqueio global dura 60s', async () => {
    process.env.TRUST_PROXY = 'true';
    await prepararGerente();
    for (let i = 0; i < 31; i++) await tentarDe(`203.0.113.${i}`);
    jest.setSystemTime(INICIO + 59_000);
    expect((await tentarDe('198.51.100.1', '987654')).status).toBe(429);
    jest.setSystemTime(INICIO + 61_000);
    expect((await tentarDe('198.51.100.1', '987654')).status).toBe(200);
  }, PRAZO_MS);
});

describe('gerente com PIN de 6 dígitos', () => {
  it('login de gerente com PIN de 4 dígitos entra, mas com avisoPinCurto', async () => {
    prisma.usuario.findMany.mockResolvedValue([
      { id: 1, nome: 'Rico', papel: 'GERENTE', ativo: true, pinHash: HASH_LEGADO_1234 },
    ]);
    const res = await request(app).post('/api/auth/login').send({ pin: '1234' });
    expect(res.status).toBe(200);
    expect(res.body.avisoPinCurto).toBe(true);
  });

  it('gerente com 6 dígitos e garçom com 4 não recebem aviso', async () => {
    prisma.usuario.findMany.mockResolvedValue([
      { id: 1, nome: 'Rico', papel: 'GERENTE', ativo: true, pinHash: await gerarHashPin('987654') },
      { id: 2, nome: 'Zé', papel: 'GARCOM', ativo: true, pinHash: HASH_LEGADO_1234 },
    ]);
    const g = await request(app).post('/api/auth/login').send({ pin: '987654' });
    expect(g.status).toBe(200);
    expect(g.body.avisoPinCurto).toBeFalsy();
    const z = await request(app).post('/api/auth/login').send({ pin: '1234' });
    expect(z.status).toBe(200);
    expect(z.body.avisoPinCurto).toBeFalsy();
  });

  it('cadastrar gerente com PIN de 4 dígitos: 400', async () => {
    prisma.usuario.findMany.mockResolvedValue([]);
    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ nome: 'Novo Gerente', papel: 'GERENTE', tamanhoPin: 4 });
    expect(res.status).toBe(400);
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it('cadastrar gerente sem informar tamanho gera 6 dígitos', async () => {
    prisma.usuario.findMany.mockResolvedValue([]);
    prisma.usuario.create.mockImplementation(({ data }) => Promise.resolve({ id: 9, ativo: true, ...data }));
    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ nome: 'Novo Gerente', papel: 'GERENTE' });
    expect(res.status).toBe(201);
    expect(res.body.pin).toMatch(/^\d{6}$/);
  });

  it('novo PIN de gerente sai com 6 dígitos; de garçom continua 4', async () => {
    prisma.usuario.findMany.mockResolvedValue([]);
    prisma.usuario.update.mockResolvedValue({});

    prisma.usuario.findUnique.mockResolvedValue({ id: 3, nome: 'Gê', papel: 'GERENTE', ativo: true });
    const g = await request(app).post('/api/usuarios/3/novo-pin').set('Authorization', `Bearer ${gerente}`);
    expect(g.body.pin).toMatch(/^\d{6}$/);

    prisma.usuario.findUnique.mockResolvedValue({ id: 4, nome: 'Zé', papel: 'GARCOM', ativo: true });
    const z = await request(app).post('/api/usuarios/4/novo-pin').set('Authorization', `Bearer ${gerente}`);
    expect(z.body.pin).toMatch(/^\d{4}$/);
  });

  it('gerente não troca o próprio PIN para 4 dígitos', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 1, nome: 'Rico', papel: 'GERENTE', ativo: true, pinHash: HASH_LEGADO_1234,
    });
    prisma.usuario.findMany.mockResolvedValue([]);
    const res = await request(app)
      .post('/api/perfil/trocar-pin')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ pinAtual: '1234', pinNovo: '4242' });
    expect(res.status).toBe(400);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('gerente troca o PIN de 4 para 6 dígitos', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 1, nome: 'Rico', papel: 'GERENTE', ativo: true, pinHash: HASH_LEGADO_1234,
    });
    prisma.usuario.findMany.mockResolvedValue([]);
    prisma.usuario.update.mockResolvedValue({});
    const res = await request(app)
      .post('/api/perfil/trocar-pin')
      .set('Authorization', `Bearer ${gerente}`)
      .send({ pinAtual: '1234', pinNovo: '424242' });
    expect(res.status).toBe(200);
  });
});
