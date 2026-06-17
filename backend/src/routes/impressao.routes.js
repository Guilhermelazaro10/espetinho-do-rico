const { Router } = require('express');
const impressaoService = require('../services/impressaoService');
const { autenticarAgente } = require('../middlewares/auth');
const parseId = require('../utils/parseId');

const router = Router();

// Rotas do AGENTE de impressão (autenticadas por token de dispositivo)
router.use(autenticarAgente);

// Próximos cupons pendentes para o agente imprimir
router.get('/proximos', async (req, res) => {
  res.json(await impressaoService.proximos(req.query.limite));
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
