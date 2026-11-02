const crypto = require('crypto');
const { promisify } = require('util');

// Hash de PIN com scrypt + salt aleatório (formato "salt:hash" em hex).
// Assíncrono de propósito: scryptSync travava o event loop a cada tentativa
// de login, e uma rajada de PINs errados congelava o PDV inteiro. Os
// parâmetros são os padrões do Node (os mesmos da versão síncrona), então os
// hashes já gravados continuam valendo.
const scrypt = promisify(crypto.scrypt);

async function gerarHashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(String(pin), salt, 32)).toString('hex');
  return `${salt}:${hash}`;
}

async function verificarPin(pin, armazenado) {
  const [salt, hash] = String(armazenado).split(':');
  if (!salt || !hash) return false;
  const esperado = Buffer.from(hash, 'hex');
  if (esperado.length !== 32) return false;
  const candidato = await scrypt(String(pin), salt, 32);
  return crypto.timingSafeEqual(candidato, esperado);
}

module.exports = { gerarHashPin, verificarPin };
