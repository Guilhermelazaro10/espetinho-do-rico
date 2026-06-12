const { Router } = require('express');
const controller = require('../controllers/pedidosController');
const { somenteGerente } = require('../middlewares/auth');

const router = Router();

// Leitura, lançamento e fluxo de produção: qualquer usuário autenticado
router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar); // MESA | DELIVERY | BALCAO
router.patch('/:id/status', controller.atualizarStatus);
router.post('/:id/imprimir', controller.reimprimir); // comanda de entrega/retirada

// Dinheiro e correções: EXCLUSIVO do gerente
router.patch('/:id/pagamento', somenteGerente, controller.pagar); // delivery/balcão
router.post('/:id/cancelar', somenteGerente, controller.cancelar);
router.delete('/:id/itens/:itemId', somenteGerente, controller.removerItem);

module.exports = router;
