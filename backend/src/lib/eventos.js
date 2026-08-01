const { EventEmitter } = require('events');

// Barramento de eventos em memória que alimenta o stream SSE (/api/eventos).
// Services publicam mudanças; clientes conectados recebem o sinal e refazem
// a busca — o evento carrega só o tipo, nunca dados sensíveis.

const barramento = new EventEmitter();
barramento.setMaxListeners(200); // muitos clientes SSE simultâneos

function publicar(tipo, detalhe = {}) {
  // `tipo` por último: um detalhe com campo homônimo (ex.: tipo do pedido)
  // não pode sobrescrever o NOME do evento que os clientes filtram.
  barramento.emit('mudanca', { ...detalhe, tipo, em: Date.now() });
}

module.exports = { barramento, publicar };
