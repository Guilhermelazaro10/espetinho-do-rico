const { Router } = require('express');
const produtosService = require('../services/produtosService');
const { somenteGerente } = require('../middlewares/auth');
const parseId = require('../utils/parseId');

const router = Router();

router.get('/', async (req, res) => {
  res.json(await produtosService.listar({ incluirInativos: req.query.incluirInativos === 'true' }));
});

router.get('/:id', async (req, res) => {
  res.json(await produtosService.buscarPorId(parseId(req.params.id)));
});

// Gestão de cardápio: somente gerente. DELETE = soft delete (ativo=false).
router.post('/', somenteGerente, async (req, res) => {
  res.status(201).json(await produtosService.criar(req.body ?? {}));
});

router.put('/:id', somenteGerente, async (req, res) => {
  res.json(await produtosService.atualizar(parseId(req.params.id), req.body ?? {}));
});

router.delete('/:id', somenteGerente, async (req, res) => {
  res.json(await produtosService.desativar(parseId(req.params.id)));
});

router.post('/:id/reativar', somenteGerente, async (req, res) => {
  res.json(await produtosService.reativar(parseId(req.params.id)));
});

module.exports = router;
