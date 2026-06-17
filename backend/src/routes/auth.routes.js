const { Router } = require('express');
const authService = require('../services/authService');
const limiteLogin = require('../middlewares/limiteLogin');

const router = Router();

router.post('/login', async (req, res) => {
  limiteLogin.verificar(req); // lança 429 se o IP estiver bloqueado
  const { pin } = req.body ?? {};
  try {
    const resultado = await authService.loginComPin(pin);
    limiteLogin.ok(req); // sucesso zera o contador
    res.json(resultado);
  } catch (erro) {
    if (erro.statusCode === 401) limiteLogin.falhou(req); // só PIN errado conta
    throw erro;
  }
});

module.exports = router;
