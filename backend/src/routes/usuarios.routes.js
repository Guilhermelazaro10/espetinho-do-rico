const { Router } = require('express');
const usuariosService = require('../services/usuariosService');
const parseId = require('../utils/parseId');
const { somenteGerente } = require('../middlewares/auth');

const router = Router();

// RH — exclusivo do gerente
router.use(somenteGerente);

router.get('/', async (req, res) => {
  res.json(await usuariosService.listar());
});

// Cria funcionário e devolve o PIN gerado (exibido uma única vez)
router.post('/', async (req, res) => {
  const { nome, papel, tamanhoPin } = req.body ?? {};
  res.status(201).json(await usuariosService.criar({ nome, papel, tamanhoPin }, req.usuario));
});

router.post('/:id/novo-pin', async (req, res) => {
  res.json(await usuariosService.regerarPin(parseId(req.params.id), req.usuario));
});

// Desligamento = soft delete (PIN revogado, histórico preservado)
router.delete('/:id', async (req, res) => {
  await usuariosService.desativar(parseId(req.params.id), req.usuario);
  res.status(204).end();
});

module.exports = router;
