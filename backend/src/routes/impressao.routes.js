const { Router } = require('express');
const impressaoService = require('../services/impressaoService');
const { autenticarAgente } = require('../middlewares/auth');
const parseId = require('../utils/parseId');

const router = Router();

// Rotas do AGENTE de impressão (autenticadas por token de dispositivo)
router.use(autenticarAgente);

// Teto do long-poll. Menor que o timeout de proxies (Cloudflare/Caddy) para a
// conexão não ser cortada do outro lado. Ajustável por ambiente — se algum
// proxy no caminho cortar antes, baixe aqui.
const ESPERA_MAXIMA_MS = Number(process.env.ESPERA_MAX_IMPRESSAO_MS || 25000);

// Próximos cupons pendentes para o agente imprimir.
// Com ?espera=<ms> a resposta fica pendurada até entrar cupom na fila — assim
// o cupom sai no instante do clique em vez de esperar a próxima pergunta do
// agente. Sem o parâmetro, responde na hora (agente antigo segue funcionando).
router.get('/proximos', async (req, res) => {
  const jobs = await impressaoService.proximos(req.query.limite);
  if (jobs.length > 0) return res.json(jobs);

  const espera = Math.min(Number(req.query.espera) || 0, ESPERA_MAXIMA_MS);
  if (espera <= 0) return res.json([]);

  res.json(await impressaoService.aguardarNovos(req.query.limite, espera, req));
});

// Agente confirma que imprimiu
router.post('/:id/concluir', async (req, res) => {
  await impressaoService.concluir(parseId(req.params.id));
  res.json({ ok: true });
});

// Agente reporta falha (volta para a fila até esgotar as tentativas)
router.post('/:id/falhar', async (req, res) => {
  await impressaoService.falhar(parseId(req.params.id), req.body?.erro);
  res.json({ ok: true });
});

module.exports = router;
