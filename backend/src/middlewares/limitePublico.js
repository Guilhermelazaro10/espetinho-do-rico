const AppError = require('../errors/AppError');

/*
 * Anti-spam dos pedidos públicos (cardápio online): limita a criação por IP,
 * em memória. O endpoint é aberto na internet, então sem isso um bot poderia
 * inundar a cozinha. O IP real vem do Cloudflare (CF-Connecting-IP).
 */
const MAX = 6; // pedidos
const JANELA_MS = 10 * 60 * 1000; // por 10 minutos

const registros = new Map(); // ip -> [timestamps]

function ipDe(req) {
  return req.headers['cf-connecting-ip'] || req.ip || req.socket?.remoteAddress || 'desconhecido';
}

function limitePedidoPublico(req, res, next) {
  const ip = ipDe(req);
  const agora = Date.now();
  const recentes = (registros.get(ip) || []).filter((t) => agora - t < JANELA_MS);
  if (recentes.length >= MAX) {
    throw new AppError('Muitos pedidos em sequência. Aguarde alguns minutos e tente de novo.', 429);
  }
  recentes.push(agora);
  registros.set(ip, recentes);
  next();
}

// Para os testes não vazarem estado entre suítes
function _resetar() {
  registros.clear();
}

module.exports = { limitePedidoPublico, _resetar };
