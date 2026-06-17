const mesasService = require('../services/mesasService');
const parseId = require('../utils/parseId');

module.exports = {
  async listar(req, res) {
    res.json(await mesasService.listar());
  },

  async buscarPorId(req, res) {
    res.json(await mesasService.buscarPorId(parseId(req.params.id)));
  },

  async atualizarStatus(req, res) {
    const { status } = req.body ?? {};
    res.json(await mesasService.atualizarStatus(parseId(req.params.id), status));
  },

  async definirTaxa(req, res) {
    const { ativa } = req.body ?? {};
    res.json(await mesasService.definirTaxa(parseId(req.params.id), ativa));
  },

  async obterConta(req, res) {
    res.json(await mesasService.obterConta(parseId(req.params.id)));
  },

  async solicitarPreConta(req, res) {
    res.json(await mesasService.solicitarPreConta(parseId(req.params.id), req.usuario));
  },

  async registrarPagamento(req, res) {
    const { forma, valor } = req.body ?? {};
    res.json(
      await mesasService.registrarPagamento(parseId(req.params.id), { forma, valor }, req.usuario)
    );
  },

  async criar(req, res) {
    const { numero } = req.body ?? {};
    res.status(201).json(await mesasService.criar({ numero }, req.usuario));
  },

  async remover(req, res) {
    await mesasService.remover(parseId(req.params.id), req.usuario);
    res.status(204).end();
  },
};
