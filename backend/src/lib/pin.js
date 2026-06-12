const crypto = require('crypto');

// Hash de PIN com scrypt + salt aleatório (formato "salt:hash" em hex)

function gerarHashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verificarPin(pin, armazenado) {
  const [salt, hash] = String(armazenado).split(':');
  if (!salt || !hash) return false;
  const candidato = crypto.scryptSync(String(pin), salt, 32);
  return crypto.timingSafeEqual(candidato, Buffer.from(hash, 'hex'));
}

module.exports = { gerarHashPin, verificarPin };
