const { Router } = require('express');
const usuariosService = require('../services/usuariosService');

const router = Router();

// Perfil do próprio usuário autenticado (qualquer papel)
router.post('/trocar-pin', async (req, res) => {
  const { pinAtual, pinNovo } = req.body ?? {};
  await usuariosService.trocarPin(req.usuario, pinAtual, pinNovo);
  res.json({ ok: true });
});

module.exports = router;
