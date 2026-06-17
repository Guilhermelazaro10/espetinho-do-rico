const { Router } = require('express');
const caixaService = require('../services/caixaService');
const { somenteGerente } = require('../middlewares/auth');

const router = Router();

// Caixa (gaveta) — exclusivo do gerente
router.use(somenteGerente);

router.get('/atual', async (req, res) => {
  res.json(await caixaService.statusAtual());
});

router.post('/abrir', async (req, res) => {
  res.status(201).json(await caixaService.abrir({ fundoAbertura: req.body?.fundoAbertura }, req.usuario));
});

router.post('/movimento', async (req, res) => {
  const { tipo, valor, motivo } = req.body ?? {};
  res.status(201).json(await caixaService.registrarMovimento({ tipo, valor, motivo }, req.usuario));
});

router.post('/fechar', async (req, res) => {
  const { valorContado, observacao } = req.body ?? {};
  res.json(await caixaService.fechar({ valorContado, observacao }, req.usuario));
});

module.exports = router;
