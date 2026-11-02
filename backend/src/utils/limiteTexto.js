const AppError = require('../errors/AppError');

// Tamanho máximo dos textos livres que vão para o banco e para o cupom.
// Acima disso é 400: truncar em silêncio esconderia o erro de quem digitou.
const LIMITES_TEXTO = Object.freeze({
  clienteNome: 60,
  clienteTelefone: 20,
  clienteEndereco: 200,
  motivo: 200,
});

// Ausente passa (a obrigatoriedade é checada por quem chama); presente precisa
// ser texto dentro do limite. Objeto/número no lugar de texto também é 400.
function exigirTextoAte(valor, max, rotulo) {
  if (valor == null) return valor;
  if (typeof valor !== 'string') throw new AppError(`${rotulo} deve ser texto`);
  if (valor.trim().length > max) {
    throw new AppError(`${rotulo} muito longo (máximo ${max} caracteres)`);
  }
  return valor;
}

module.exports = { LIMITES_TEXTO, exigirTextoAte };
