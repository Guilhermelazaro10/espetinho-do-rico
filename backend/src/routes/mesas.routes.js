const { Router } = require('express');
const controller = require('../controllers/mesasController');
const { somenteGerente } = require('../middlewares/auth');

const router = Router();

// Salão: qualquer usuário autenticado (garçom incluso)
router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.get('/:id/conta', controller.obterConta);

// Garçom "Fecha Conta" = pré-conta: muda status e imprime conferência.
// NUNCA processa pagamento.
router.post('/:id/pre-conta', controller.solicitarPreConta);
router.patch('/:id/status', controller.atualizarStatus);

// Dinheiro: EXCLUSIVO do gerente (pagamentos parciais até zerar o saldo)
router.post('/:id/pagamentos', somenteGerente, controller.registrarPagamento);
router.patch('/:id/taxa', somenteGerente, controller.definirTaxa);

module.exports = router;
