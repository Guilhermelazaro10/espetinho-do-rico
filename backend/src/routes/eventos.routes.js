const { Router } = require('express');
const { barramento } = require('../lib/eventos');
const { ipDoCliente } = require('../lib/rede');
const AppError = require('../errors/AppError');

const router = Router();

// Teto de conexões abertas por IP: o stream é público e cada conexão segura
// um socket e um ouvinte. É folgado de propósito — na VPS a equipe inteira
// chega pelo IP do Wi-Fi da loja, e cada tela do PDV abre duas conexões.
const MAX_CONEXOES_POR_IP = 40;
const conexoesPorIp = new Map(); // ip -> abertas agora

// Stream SSE de sinalização: avisa "algo mudou" para os clientes refazerem
// a busca. Não carrega dados de negócio, por isso dispensa autenticação
// (EventSource não envia headers customizados).
router.get('/', (req, res) => {
  const ip = ipDoCliente(req);
  const abertas = conexoesPorIp.get(ip) ?? 0;
  if (abertas >= MAX_CONEXOES_POR_IP) {
    throw new AppError('Conexões de tempo real demais a partir deste endereço', 429);
  }
  conexoesPorIp.set(ip, abertas + 1);

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // pede a proxies (Cloudflare/Caddy/nginx) p/ não bufferizar
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  const ouvinte = (dados) => {
    res.write(`data: ${JSON.stringify(dados)}\n\n`);
    res.flush?.(); // empurra na hora caso algum middleware tente segurar
  };
  barramento.on('mudanca', ouvinte);

  const batimento = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    barramento.off('mudanca', ouvinte);
    clearInterval(batimento);
    const restantes = (conexoesPorIp.get(ip) ?? 1) - 1;
    if (restantes > 0) conexoesPorIp.set(ip, restantes);
    else conexoesPorIp.delete(ip);
  });
});

module.exports = router;
module.exports.MAX_CONEXOES_POR_IP = MAX_CONEXOES_POR_IP;
