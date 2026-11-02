const { Router } = require('express');
const configService = require('../services/configService');
const { somenteGerente } = require('../middlewares/auth');

const router = Router();

// Estado operacional da loja (qualquer usuário autenticado pode ver)
router.get('/', async (req, res) => {
  res.json({ deliveryAtivo: await configService.deliveryAtivo() });
});

// Pausar/retomar o delivery do cardápio online: decisão do gerente
router.patch('/delivery', somenteGerente, async (req, res) => {
  res.json(await configService.definirDelivery(req.body?.ativo, req.usuario));
});

module.exports = router;
