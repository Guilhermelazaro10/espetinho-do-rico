const { Router } = require('express');
const impressaoService = require('../services/impressaoService');
const printerService = require('../services/printerService');
const { somenteGerente } = require('../middlewares/auth');
const parseId = require('../utils/parseId');

const router = Router();

// Painel de impressão — monitoramento da fila e do agente. Exclusivo do gerente.
// (As rotas que o AGENTE usa ficam em /api/impressao, autenticadas por token.)
router.use(somenteGerente);

// Resumo: presença do agente + contadores da fila + últimos cupons
router.get('/', async (req, res) => {
  res.json(await impressaoService.resumo());
});

// Dispara um cupom de teste (com logo) para a fila
router.post('/teste', async (req, res) => {
  const job = await printerService.enfileirarTeste();
  res.status(201).json({ ok: true, id: job.id });
});

// Reimprime um cupom existente (re-enfileira o mesmo conteúdo)
router.post('/:id/reimprimir', async (req, res) => {
  const job = await impressaoService.reimprimir(parseId(req.params.id));
  res.status(201).json({ ok: true, id: job.id });
});

module.exports = router;
