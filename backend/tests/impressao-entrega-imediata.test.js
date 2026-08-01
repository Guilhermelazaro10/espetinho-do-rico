const request = require('supertest');

process.env.PRINT_AGENT_TOKEN = 'token-agente-teste';
// Teto baixo só no teste: prova que o servidor limita a espera sem deixar a
// suíte parada 25 segundos. Precisa vir antes de carregar o app. Os prazos
// pedidos abaixo ficam ABAIXO deste teto, para cada teste passar pelo motivo
// que ele afirma testar (evento/sinal) e não porque o teto estourou.
process.env.ESPERA_MAX_IMPRESSAO_MS = '3000';

jest.mock('../src/lib/prisma', () => ({
  printJob: {
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const impressaoService = require('../src/services/impressaoService');
const { barramento } = require('../src/lib/eventos');

const auth = { Authorization: 'Bearer token-agente-teste' };

/*
 * O agente perguntava de 2 em 2 segundos se havia cupom novo — medido, o
 * cupom levava ~1,6s para sair mesmo em rede local. Agora ele fica pendurado
 * e o servidor responde no instante em que o cupom entra na fila (~46ms).
 */

const cupom = { id: 7, tipo: 'cupom', conteudo: 'linha', abrirGaveta: false };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.printJob.updateMany.mockResolvedValue({ count: 0 });
  prisma.printJob.create.mockResolvedValue(cupom);
});

afterEach(() => {
  barramento.removeAllListeners('cupom-na-fila');
  barramento.removeAllListeners('desligando');
});

describe('entrega imediata do cupom (long-poll)', () => {
  it('com cupom na fila, responde na hora (não segura à toa)', async () => {
    prisma.printJob.findMany.mockResolvedValue([cupom]);

    const t0 = Date.now();
    const res = await request(app).get('/api/impressao/proximos?espera=3000').set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('fila vazia: fica pendurado e responde quando o cupom entra', async () => {
    prisma.printJob.findMany.mockResolvedValue([]); // vazia na primeira olhada

    const resposta = request(app).get('/api/impressao/proximos?espera=2500').set(auth);

    // 300ms depois, alguém clica em imprimir na loja
    setTimeout(() => {
      prisma.printJob.findMany.mockResolvedValue([cupom]);
      impressaoService.enfileirar({ tipo: 'cupom', conteudo: 'linha' });
    }, 300);

    const t0 = Date.now();
    const res = await resposta;
    const levou = Date.now() - t0;

    expect(res.body).toHaveLength(1);
    // Só passa se acordou pelo cupom: esperar o prazo levaria os 2500ms.
    expect(levou).toBeLessThan(1500);
  });

  it('sem cupom até o prazo, devolve vazio (agente pergunta de novo)', async () => {
    prisma.printJob.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/impressao/proximos?espera=400').set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('agente antigo (sem ?espera) continua respondido na hora', async () => {
    prisma.printJob.findMany.mockResolvedValue([]);

    const t0 = Date.now();
    const res = await request(app).get('/api/impressao/proximos').set(auth);

    expect(res.body).toEqual([]);
    expect(Date.now() - t0).toBeLessThan(500); // não pendurou
  });

  it('desligamento libera a espera na hora (deploy não fica travado)', async () => {
    prisma.printJob.findMany.mockResolvedValue([]);

    const resposta = request(app).get('/api/impressao/proximos?espera=2500').set(auth);
    setTimeout(() => barramento.emit('desligando'), 200);

    const t0 = Date.now();
    const res = await resposta;

    expect(res.body).toEqual([]);
    // Só passa se o sinal liberou: o prazo sozinho levaria os 2500ms.
    expect(Date.now() - t0).toBeLessThan(1200);
  });

  it('espera é limitada no servidor (agente não segura conexão eterna)', async () => {
    prisma.printJob.findMany.mockResolvedValue([]);

    // Pede 10 minutos; o servidor corta no teto dele (3s neste teste).
    const t0 = Date.now();
    const res = await request(app).get('/api/impressao/proximos?espera=600000').set(auth);

    expect(res.status).toBe(200);
    expect(Date.now() - t0).toBeLessThan(6000); // respeitou o teto, não os 10min
  });
});
