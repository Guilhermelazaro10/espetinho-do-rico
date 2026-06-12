const { Router } = require('express');
const controller = require('../controllers/produtosController');
const { somenteGerente } = require('../middlewares/auth');

const router = Router();

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);

// Gestão de cardápio: somente gerente. DELETE = soft delete (ativo=false).
router.post('/', somenteGerente, controller.criar);
router.put('/:id', somenteGerente, controller.atualizar);
router.delete('/:id', somenteGerente, controller.desativar);
router.post('/:id/reativar', somenteGerente, controller.reativar);

module.exports = router;
