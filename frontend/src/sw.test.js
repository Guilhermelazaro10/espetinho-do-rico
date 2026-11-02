import { describe, it, expect, vi, beforeEach } from 'vitest';
import CODIGO_SW from '../public/sw.js?raw';
import { limparSessao } from './lib/sessao';

/*
 * O service worker NÃO pode guardar resposta privada da API: caixa, relatório
 * e lista de pedidos ficavam no Cache Storage do aparelho depois do logout, e
 * qualquer um com o tablet na mão lia offline. Só o cardápio público é cacheado.
 */

// Cache Storage em memória: { nome -> Map(url -> Response) }
function criarCaches(inicial = {}) {
  const lojas = new Map(Object.entries(inicial).map(([k, v]) => [k, new Map(Object.entries(v))]));
  const chaveDe = (r) => (typeof r === 'string' ? new URL(r, 'https://loja.test').href : r.url);
  const abrir = (nome) => {
    if (!lojas.has(nome)) lojas.set(nome, new Map());
    const m = lojas.get(nome);
    return {
      put: vi.fn(async (req, res) => m.set(chaveDe(req), res)),
      match: async (req) => m.get(chaveDe(req))?.clone(),
      addAll: async () => {},
    };
  };
  return {
    lojas,
    open: async (nome) => abrir(nome),
    keys: async () => [...lojas.keys()],
    delete: async (nome) => lojas.delete(nome),
  };
}

function carregarSw({ caches, fetch }) {
  const ouvintes = {};
  const self = {
    location: { origin: 'https://loja.test' },
    addEventListener: (tipo, fn) => (ouvintes[tipo] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  new Function('self', 'caches', 'fetch', 'Response', CODIGO_SW)(self, caches, fetch, Response);

  async function buscar(caminho) {
    let resposta;
    ouvintes.fetch({
      request: { method: 'GET', url: `https://loja.test${caminho}`, mode: 'cors' },
      respondWith: (p) => (resposta = p),
    });
    return resposta;
  }
  async function ativar() {
    let p;
    ouvintes.activate({ waitUntil: (x) => (p = x) });
    await p;
  }
  return { buscar, ativar };
}

const ok = (corpo) => new Response(JSON.stringify(corpo), { status: 200 });
const semRede = () => Promise.reject(new TypeError('offline'));

describe('service worker — cache da API', () => {
  it('rota privada da API nunca vai para o cache', async () => {
    const caches = criarCaches();
    const sw = carregarSw({ caches, fetch: () => Promise.resolve(ok({ caixa: 123 })) });

    const res = await sw.buscar('/api/caixa/atual');
    expect(res.status).toBe(200);
    const tudo = [...caches.lojas.values()].flatMap((m) => [...m.keys()]);
    expect(tudo.some((u) => u.includes('/api/caixa'))).toBe(false);
  });

  it('sem rede, rota privada devolve 503 JSON mesmo havendo resposta antiga guardada', async () => {
    const caches = criarCaches({
      'espetinho-pdv-v3': { 'https://loja.test/api/pedidos': ok({ segredo: true }) },
    });
    const sw = carregarSw({ caches, fetch: semRede });

    const res = await sw.buscar('/api/pedidos');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ erro: 'Sem conexão com o servidor' });
  });

  it('cardápio público é cacheado e servido offline', async () => {
    const caches = criarCaches();
    const online = carregarSw({ caches, fetch: () => Promise.resolve(ok({ categorias: [] })) });
    await online.buscar('/api/publico/cardapio');

    const offline = carregarSw({ caches, fetch: semRede });
    const res = await offline.buscar('/api/publico/cardapio');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ categorias: [] });
  });

  it('versão nova apaga os caches antigos (que podem ter dado financeiro)', async () => {
    const caches = criarCaches({ 'espetinho-pdv-v2': { 'https://loja.test/api/caixa/atual': ok({}) } });
    const sw = carregarSw({ caches, fetch: semRede });
    await sw.ativar();
    expect(await caches.keys()).not.toContain('espetinho-pdv-v2');
    expect(CODIGO_SW).toMatch(/const CACHE = 'espetinho-pdv-v3'/);
  });
});

describe('logout limpa o Cache Storage', () => {
  beforeEach(() => {
    delete window.caches;
  });

  it('apaga os caches do PDV e preserva os de outros apps', async () => {
    const caches = criarCaches({ 'espetinho-pdv-v2': {}, 'espetinho-pdv-v3': {}, 'outro-app': {} });
    window.caches = caches;
    await limparSessao();
    expect(await caches.keys()).toEqual(['outro-app']);
  });

  it('navegador sem Cache Storage não quebra o logout', async () => {
    localStorage.setItem('pdv.sessao', '{"token":"x"}');
    await limparSessao();
    expect(localStorage.getItem('pdv.sessao')).toBeNull();
  });
});
