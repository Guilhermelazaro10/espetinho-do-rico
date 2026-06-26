const AppError = require('../errors/AppError');

/*
 * Anti-spam dos pedidos públicos (cardápio online): limita a criação por IP,
 * em memória. O endpoint é aberto na internet, então sem isso um bot poderia
 * inundar a cozinha. O IP real vem do Cloudflare (CF-Connecting-IP).
 */
const MAX = 6; // pedidos
const JANELA_MS = 10 * 60 * 1000; // por 10 minutos

const registros = new Map(); // ip -> [timestamps]
let ultimaLimpeza = 0;

function ipDe(req) {
  return req.headers['cf-connecting-ip'] || req.ip || req.socket?.remoteAddress || 'desconhecido';
}

// Remove IPs sem registros recentes (impede o Map crescer pra sempre). Roda no
// máximo 1x por janela, dentro da própria requisição (sem timer).
function limpar(agora) {
  if (agora - ultimaLimpeza < JANELA_MS) return;
  ultimaLimpeza = agora;
  for (const [ip, ts] of registros) {
    const vivos = ts.filter((t) => agora - t < JANELA_MS);
    if (vivos.length) registros.set(ip, vivos);
    else registros.delete(ip);
  }
}

function limitePedidoPublico(req, res, next) {
  const ip = ipDe(req);
  const agora = Date.now();
  limpar(agora);
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
