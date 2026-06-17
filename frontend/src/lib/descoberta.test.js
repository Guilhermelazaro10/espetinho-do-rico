import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { varrerRede, localizarPDV, buscarEmTodaRede } from './descoberta';

const respostaPDV = (nome = 'PC-RICO') => ({
  ok: true,
  json: async () => ({ status: 'ok', app: 'espetinho-pdv', nome }),
});
const respostaOutroServico = () => ({
  ok: true,
  json: async () => ({ status: 'ok', app: 'outra-coisa' }),
});
const semRota = () => {
  throw new Error('sem rota');
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('varrerRede', () => {
  it('acha o PDV pela assinatura e ignora outros serviços na porta', async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === 'http://192.168.0.50:3001/health') return respostaPDV();
      if (url === 'http://192.168.0.30:3001/health') return respostaOutroServico();
      return semRota();
    });

    const achado = await varrerRede({ subredes: ['192.168.0'] });
    expect(achado).toEqual({ base: 'http://192.168.0.50:3001', nome: 'PC-RICO' });
  });

  it('retorna null quando ninguém responde com a assinatura', async () => {
    global.fetch = vi.fn(async () => semRota());
    const achado = await varrerRede({ subredes: ['192.168.0'], timeoutPorHost: 50 });
    expect(achado).toBeNull();
  });

  it('reporta progresso até o fim', async () => {
    global.fetch = vi.fn(async () => semRota());
    const eventos = [];
    await varrerRede({
      subredes: ['192.168.0'],
      timeoutPorHost: 20,
      aoProgresso: (feitos, total) => eventos.push([feitos, total]),
    });
    expect(eventos.at(-1)).toEqual([254, 254]);
  });
});

describe('localizarPDV', () => {
  it('usa o endereço salvo quando ainda responde (sem varrer)', async () => {
    localStorage.setItem('pdv.servidor', 'http://192.168.0.50:3001');
    global.fetch = vi.fn(async (url) =>
      url === 'http://192.168.0.50:3001/health' ? respostaPDV() : semRota()
    );

    const achado = await localizarPDV();
    expect(achado.base).toBe('http://192.168.0.50:3001');
    expect(global.fetch).toHaveBeenCalledTimes(1); // achou direto, não varreu
  });

  it('varre a sub-rede do endereço salvo quando o IP mudou', async () => {
    localStorage.setItem('pdv.servidor', 'http://192.168.0.10:3001'); // IP antigo, fora do ar
    global.fetch = vi.fn(async (url) =>
      url === 'http://192.168.0.77:3001/health' ? respostaPDV('PC-NOVO') : semRota()
    );

    const achado = await localizarPDV();
    expect(achado).toEqual({ base: 'http://192.168.0.77:3001', nome: 'PC-NOVO' });
  });

  it('sem endereço salvo, retorna null (config manual assume)', async () => {
    global.fetch = vi.fn();
    expect(await localizarPDV()).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('buscarEmTodaRede', () => {
  it('encontra o PDV em uma das sub-redes comuns', async () => {
    global.fetch = vi.fn(async (url) =>
      url === 'http://192.168.1.20:3001/health' ? respostaPDV('PC-CASA') : semRota()
    );

    const achado = await buscarEmTodaRede();
    expect(achado).toEqual({ base: 'http://192.168.1.20:3001', nome: 'PC-CASA' });
  });
});
