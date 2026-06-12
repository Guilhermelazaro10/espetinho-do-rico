const jwt = require('jsonwebtoken');

const SEGREDO = process.env.JWT_SECRET || 'espetinho-dev-secret-trocar-em-producao';

function tokenDe(papel = 'GERENTE', nome = 'Operador Teste') {
  return jwt.sign({ id: 1, nome, papel }, SEGREDO, { expiresIn: '1h' });
}

module.exports = { tokenDe };
