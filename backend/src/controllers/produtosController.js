const produtosService = require('../services/produtosService');
const parseId = require('../utils/parseId');

module.exports = {
  async listar(req, res) {
    res.json(
      await produtosService.listar({ incluirInativos: req.query.incluirInativos === 'true' })
    );
  },

  async buscarPorId(req, res) {
    res.json(await produtosService.buscarPorId(parseId(req.params.id)));
  },

  async criar(req, res) {
    res.status(201).json(await produtosService.criar(req.body ?? {}));
  },

  async atualizar(req, res) {
    res.json(await produtosService.atualizar(parseId(req.params.id), req.body ?? {}));
  },

  // "DELETE" é soft delete: ativo=false, integridade dos relatórios preservada
  async desativar(req, res) {
    res.json(await produtosService.desativar(parseId(req.params.id)));
  },

  async reativar(req, res) {
    res.json(await produtosService.reativar(parseId(req.params.id)));
  },
};
