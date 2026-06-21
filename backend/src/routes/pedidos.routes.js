const { Router } = require('express');
const pedidosService = require('../services/pedidosService');
const { somenteGerente } = require('../middlewares/auth');
const parseId = require('../utils/parseId');

const router = Router();

// Leitura, lançamento e fluxo de produção: qualquer usuário autenticado
router.get('/', async (req, res) => {
  const { status, abertos, tipo, limite, pagina } = req.query;
  res.json(
    await pedidosService.listar({ status, abertos: abertos === 'true', tipo, limite, pagina })
  );
});

router.get('/:id', async (req, res) => {
  res.json(await pedidosService.buscarPorId(parseId(req.params.id)));
});

router.post('/', async (req, res) => {
  const {
    tipo, mesaId, itens,
    clienteNome, clienteTelefone, clienteEndereco, taxaEntrega,
    telefone, endereco, taxa,
  } = req.body ?? {};
  res.status(201).json(
    await pedidosService.criar({
      tipo, mesaId, itens,
      clienteNome, clienteTelefone, clienteEndereco, taxaEntrega,
      telefone, endereco, taxa,
    })
  );
});

router.patch('/:id/status', async (req, res) => {
  res.json(await pedidosService.atualizarStatus(parseId(req.params.id), req.body?.status));
});

router.post('/:id/imprimir', async (req, res) => {
  res.json(await pedidosService.reimprimir(parseId(req.params.id))); // comanda de entrega/retirada
});

// Dinheiro e correções: EXCLUSIVO do gerente
router.patch('/:id/pagamento', somenteGerente, async (req, res) => {
  res.json(
    await pedidosService.pagarPedido(parseId(req.params.id), req.body?.formaPagamento, req.usuario)
  );
});

router.post('/:id/cancelar', somenteGerente, async (req, res) => {
  res.json(await pedidosService.cancelar(parseId(req.params.id), req.body?.motivo, req.usuario));
});

router.delete('/:id/itens/:itemId', somenteGerente, async (req, res) => {
  res.json(
    await pedidosService.removerItem(
      parseId(req.params.id),
      parseId(req.params.itemId, 'ID do item'),
      req.usuario
    )
  );
});

module.exports = router;
