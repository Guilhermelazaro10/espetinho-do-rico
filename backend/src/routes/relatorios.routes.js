const { Router } = require('express');
const relatoriosService = require('../services/relatoriosService');
const auditoriaService = require('../services/auditoriaService');
const { somenteGerente } = require('../middlewares/auth');

const router = Router();

// Financeiro e auditoria — exclusivo do gerente
router.use(somenteGerente);

// Faturamento diário/semanal/mensal agrupado por forma de pagamento
router.get('/faturamento', async (req, res) => {
  res.json(await relatoriosService.faturamento(req.query.periodo ?? 'dia'));
});

router.get('/auditoria', async (req, res) => {
  res.json(await auditoriaService.listar({ limite: req.query.limite }));
});

module.exports = router;
