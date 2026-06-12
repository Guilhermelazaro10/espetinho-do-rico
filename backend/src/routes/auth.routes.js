const { Router } = require('express');
const authService = require('../services/authService');

const router = Router();

router.post('/login', async (req, res) => {
  const { pin } = req.body ?? {};
  res.json(await authService.loginComPin(pin));
});

module.exports = router;
