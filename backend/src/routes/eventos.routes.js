const { Router } = require('express');
const { barramento } = require('../lib/eventos');

const router = Router();

// Stream SSE de sinalização: avisa "algo mudou" para os clientes refazerem
// a busca. Não carrega dados de negócio, por isso dispensa autenticação
// (EventSource não envia headers customizados).
router.get('/', (req, res) => {
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
  });
});

module.exports = router;
