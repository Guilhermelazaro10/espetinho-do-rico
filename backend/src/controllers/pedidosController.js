const pedidosService = require('../services/pedidosService');
const parseId = require('../utils/parseId');

module.exports = {
  async listar(req, res) {
    const { status, abertos, tipo, limite, pagina } = req.query;
    res.json(
      await pedidosService.listar({
        status,
        abertos: abertos === 'true',
        tipo,
        limite,
        pagina,
      })
    );
  },

  async buscarPorId(req, res) {
    res.json(await pedidosService.buscarPorId(parseId(req.params.id)));
  },

  async criar(req, res) {
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
  },

  async atualizarStatus(req, res) {
    const { status } = req.body ?? {};
    res.json(await pedidosService.atualizarStatus(parseId(req.params.id), status));
  },

  async pagar(req, res) {
    const { formaPagamento } = req.body ?? {};
    res.json(await pedidosService.pagarPedido(parseId(req.params.id), formaPagamento, req.usuario));
  },

  async cancelar(req, res) {
    const { motivo } = req.body ?? {};
    res.json(await pedidosService.cancelar(parseId(req.params.id), motivo, req.usuario));
  },

  async removerItem(req, res) {
    res.json(
      await pedidosService.removerItem(
        parseId(req.params.id),
        parseId(req.params.itemId, 'ID do item'),
        req.usuario
      )
    );
  },

  async reimprimir(req, res) {
    res.json(await pedidosService.reimprimir(parseId(req.params.id)));
  },
};
