const { Router } = require('express');
const mesasService = require('../services/mesasService');
const { somenteGerente } = require('../middlewares/auth');
const parseId = require('../utils/parseId');

const router = Router();

// Salão: qualquer usuário autenticado (garçom incluso)
router.get('/', async (req, res) => {
  res.json(await mesasService.listar());
});

router.get('/:id', async (req, res) => {
  res.json(await mesasService.buscarPorId(parseId(req.params.id)));
});

router.get('/:id/conta', async (req, res) => {
  res.json(await mesasService.obterConta(parseId(req.params.id)));
});

// Gestão de mesas: EXCLUSIVO do gerente
router.post('/', somenteGerente, async (req, res) => {
  res.status(201).json(await mesasService.criar({ numero: req.body?.numero }, req.usuario));
});

router.delete('/:id', somenteGerente, async (req, res) => {
  await mesasService.remover(parseId(req.params.id), req.usuario);
  res.status(204).end();
});

// Garçom "Fecha Conta" = pré-conta: muda status e imprime conferência.
// NUNCA processa pagamento.
router.post('/:id/pre-conta', async (req, res) => {
  res.json(await mesasService.solicitarPreConta(parseId(req.params.id), req.usuario));
});

router.patch('/:id/status', async (req, res) => {
  res.json(await mesasService.atualizarStatus(parseId(req.params.id), req.body?.status));
});

// Dinheiro: EXCLUSIVO do gerente (pagamentos parciais até zerar o saldo)
router.post('/:id/pagamentos', somenteGerente, async (req, res) => {
  const { forma, valor } = req.body ?? {};
  res.json(
    await mesasService.registrarPagamento(parseId(req.params.id), { forma, valor }, req.usuario)
  );
});

router.patch('/:id/taxa', somenteGerente, async (req, res) => {
  res.json(await mesasService.definirTaxa(parseId(req.params.id), req.body?.ativa));
});

module.exports = router;
