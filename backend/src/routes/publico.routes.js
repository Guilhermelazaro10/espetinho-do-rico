const { Router } = require('express');
const produtosService = require('../services/produtosService');
const pedidosService = require('../services/pedidosService');
const loja = require('../loja');
const { limitePedidoPublico } = require('../middlewares/limitePublico');
const AppError = require('../errors/AppError');
const parseId = require('../utils/parseId');

const router = Router();

// Cardápio online (sem login): identidade + horário + bairros + itens ativos.
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

  const { aberto, texto } = loja.statusHorario();
  res.json({
    loja: {
      nome: loja.nome,
      endereco: loja.endereco,
      whatsapp: loja.whatsapp,
      aberto,
      horario: texto,
      proximaAbertura: loja.proximaAbertura()?.texto ?? null,
      bairros: loja.bairros(),
    },
    categorias,
  });
});

// Pedido online (sem login, anti-spam). Cria DELIVERY/BALCAO no PDV.
router.post('/pedidos', limitePedidoPublico, async (req, res) => {
  const corpo = req.body ?? {};
  let agendadoPara;
  if (!loja.statusHorario().aberto) {
    const prox = loja.proximaAbertura();
    if (corpo.agendado && prox) {
      agendadoPara = prox.texto; // pedido agendado para a próxima abertura
    } else {
      throw new AppError('A loja está fechada no momento. Tente no horário de funcionamento.', 409);
    }
  }
  if (corpo.tipo !== 'DELIVERY' && corpo.tipo !== 'BALCAO') {
    throw new AppError('Tipo deve ser DELIVERY (entrega) ou BALCAO (retirada)');
  }
  if (Array.isArray(corpo.itens) && corpo.itens.length > 40) {
    throw new AppError('Pedido com itens demais');
  }
  const qtdTotal = Array.isArray(corpo.itens)
    ? corpo.itens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0)
    : 0;
  if (qtdTotal > 100) {
    throw new AppError('Pedido grande demais para o cardápio online');
  }

  // Taxa de entrega é SEMPRE resolvida no servidor pelo bairro (não confia no cliente).
  let taxaEntrega = 0;
  let clienteEndereco = corpo.clienteEndereco;
  if (corpo.tipo === 'DELIVERY') {
    const lista = loja.bairros();
    if (lista.length && corpo.bairro) {
      const b = lista.find((x) => x.nome === corpo.bairro);
      if (!b) throw new AppError('Bairro de entrega inválido');
      taxaEntrega = b.taxa;
      clienteEndereco = `${corpo.clienteEndereco} — ${corpo.bairro}`;
    }
  }

  const pedido = await pedidosService.criar({
    ...corpo,
    mesaId: null,
    origem: 'online',
    taxaEntrega,
    clienteEndereco,
    agendadoPara,
  });

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

// Acompanhamento público do pedido (só o status, sem dados pessoais).
router.get('/pedidos/:id/status', async (req, res) => {
  res.json(await pedidosService.statusPublico(parseId(req.params.id)));
});

module.exports = router;
