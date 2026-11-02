/*
 * Service Worker — Espetinho do Rico PDV (v3)
 * Estratégia:
 *   - Navegações (HTML): network-first — deploy novo chega na hora;
 *     offline cai no shell em cache.
 *   - /api/publico/cardapio: network-first com fallback ao último cardápio.
 *     É o ÚNICO dado da API que vai para o cache: o resto (caixa, pedidos,
 *     relatórios) é privado e ficaria legível no aparelho depois do logout.
 *   - Demais /api: só rede; sem rede, 503 JSON para a UI degradar com elegância.
 *   - Assets estáticos (JS/CSS com hash, ícones): cache-first.
 */
// Subir a versão faz o activate apagar os caches antigos (o v2 guardava a API toda)
const CACHE = 'espetinho-pdv-v3';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return; // mutações nunca são servidas do cache

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // SSE nunca passa pelo cache
  if (url.pathname.startsWith('/api/eventos')) return;

  if (url.pathname === '/api/publico/cardapio') {
    evento.respondWith(redePrimeiro(request));
  } else if (url.pathname.startsWith('/api')) {
    evento.respondWith(soRede(request));
  } else if (request.mode === 'navigate') {
    evento.respondWith(navegacaoRedePrimeiro(request));
  } else {
    evento.respondWith(cachePrimeiro(request));
  }
});

function semConexao() {
  return new Response(JSON.stringify({ erro: 'Sem conexão com o servidor' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function soRede(request) {
  try {
    return await fetch(request);
  } catch {
    return semConexao();
  }
}

async function redePrimeiro(request) {
  const cache = await caches.open(CACHE);
  try {
    const resposta = await fetch(request);
    if (resposta.ok) cache.put(request, resposta.clone());
    return resposta;
  } catch {
    return (await cache.match(request)) ?? semConexao();
  }
}

// HTML sempre fresco quando há rede; shell do cache quando não há
async function navegacaoRedePrimeiro(request) {
  const cache = await caches.open(CACHE);
  try {
    const resposta = await fetch(request);
    if (resposta.ok) cache.put('/index.html', resposta.clone());
    return resposta;
  } catch {
    return (await cache.match(request)) ?? (await cache.match('/index.html'));
  }
}

async function cachePrimeiro(request) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(request);
  if (guardada) return guardada;
  const resposta = await fetch(request);
  if (resposta.ok) cache.put(request, resposta.clone());
  return resposta;
}
