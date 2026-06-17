/*
 * Mutex em processo: serializa seções críticas que fazem "checa-depois-grava"
 * sem guard transacional no banco (ex.: abertura de caixa, onde o event loop
 * intercala os await de requisições concorrentes e fura a checagem).
 *
 * Correto para a instância única do PDV (VPS / Electron / LAN). Para um cenário
 * multi-instância, a trava precisaria ser no banco (índice único parcial).
 */
function criarMutex() {
  let fila = Promise.resolve();
  return function exclusivo(fn) {
    const resultado = fila.then(fn);
    // mantém a cadeia viva mesmo se a seção crítica lançar
    fila = resultado.then(
      () => {},
      () => {}
    );
    return resultado;
  };
}

module.exports = { criarMutex };
