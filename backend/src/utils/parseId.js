const AppError = require('../errors/AppError');

// Converte parâmetro de rota em ID inteiro positivo (compartilhado pelos controllers)
function parseId(bruto, nome = 'ID') {
  const id = Number(bruto);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(`${nome} inválido`);
  return id;
}

module.exports = parseId;
