// Logger estruturado mínimo: JSON com timestamp e nível, sem dependências.
// Em produção pode ser trocado por pino/winston mantendo a mesma interface.

function registrar(nivel, mensagem, extra) {
  const linha = JSON.stringify({
    ts: new Date().toISOString(),
    nivel,
    msg: mensagem,
    ...(extra ?? {}),
  });
  if (nivel === 'erro') console.error(linha);
  else console.log(linha);
}

module.exports = {
  info: (msg, extra) => registrar('info', msg, extra),
  aviso: (msg, extra) => registrar('aviso', msg, extra),
  erro: (msg, extra) => registrar('erro', msg, extra),
};
