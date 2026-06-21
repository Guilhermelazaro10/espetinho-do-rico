const { Router } = require('express');
const produtosService = require('../services/produtosService');
const pedidosService = require('../services/pedidosService');
const loja = require('../loja');
const { limitePedidoPublico } = require('../middlewares/limitePublico');
const AppError = require('../errors/AppError');

const router = Router();

// Cardápio online (sem login): identidade da loja + itens ativos por categoria.
router.get('/cardapio', async (req, res) => {
  const produtos = await produtosService.listar({ incluirInativos: false });

  const categorias = [];
  const porNome = new Map();
  for (const p of produtos) {
    if (!porNome.has(p.categoria)) {
      const grupo = { nome: p.categoria, itens: [] };
      porNome.set(p.categoria, grupo);
      categorias.push(grupo);
    }
    porNome.get(p.categoria).itens.push({ id: p.id, nome: p.nome, preco: p.preco });
  }

  res.json({
    loja: { nome: loja.nome, endereco: loja.endereco, whatsapp: loja.whatsapp },
    categorias,
  });
});

// Pedido online (sem login, anti-spam). Cria DELIVERY (entrega) ou BALCAO
// (retirada) no PDV — aparece na aba Delivery e imprime na cozinha.
router.post('/pedidos', limitePedidoPublico, async (req, res) => {
  const corpo = req.body ?? {};
  if (corpo.tipo !== 'DELIVERY' && corpo.tipo !== 'BALCAO') {
    throw new AppError('Tipo deve ser DELIVERY (entrega) ou BALCAO (retirada)');
  }
  if (Array.isArray(corpo.itens) && corpo.itens.length > 40) {
    throw new AppError('Pedido com itens demais');
  }

  // criar() valida itens/cabeçalho, congela preços no servidor e enfileira o cupom
  const pedido = await pedidosService.criar({ ...corpo, mesaId: null });

  res.status(201).json({
    id: pedido.id,
    tipo: pedido.tipo,
    total: pedido.total,
    taxaEntrega: pedido.taxaEntrega,
    clienteNome: pedido.clienteNome,
    itens: (pedido.itens ?? []).map((i) => ({
      nome: i.produto?.nome,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
      observacao: i.observacao,
    })),
  });
});

module.exports = router;
