/*
 * "Enums" do domínio — SQLite não suporta enums nativos no Prisma,
 * então os valores canônicos vivem aqui e TODA escrita passa por validação.
 */

const PAPEIS = Object.freeze({
  GERENTE: 'GERENTE',
  GARCOM: 'GARCOM',
});

const STATUS_MESA = Object.freeze({
  LIVRE: 'LIVRE',
  OCUPADA: 'OCUPADA',
  AGUARDANDO_PAGAMENTO: 'AGUARDANDO_PAGAMENTO',
});

const TIPOS_PEDIDO = Object.freeze({
  MESA: 'MESA',
  DELIVERY: 'DELIVERY',
  BALCAO: 'BALCAO',
});

const STATUS_PEDIDO = Object.freeze({
  ABERTO: 'aberto',
  EM_PREPARO: 'em_preparo',
  ENTREGUE: 'entregue',
  PAGO: 'pago',
  CANCELADO: 'cancelado',
});

const STATUS_PEDIDO_EM_ABERTO = Object.freeze([
  STATUS_PEDIDO.ABERTO,
  STATUS_PEDIDO.EM_PREPARO,
  STATUS_PEDIDO.ENTREGUE,
]);

const FORMAS_PAGAMENTO = Object.freeze(['dinheiro', 'cartao', 'pix']);

const PERCENTUAL_TAXA_SERVICO = 0.1;

module.exports = {
  PAPEIS,
  STATUS_MESA,
  TIPOS_PEDIDO,
  STATUS_PEDIDO,
  STATUS_PEDIDO_EM_ABERTO,
  FORMAS_PAGAMENTO,
  PERCENTUAL_TAXA_SERVICO,
};
