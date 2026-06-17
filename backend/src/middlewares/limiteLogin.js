const AppError = require('../errors/AppError');

/*
 * Limite de tentativas de login por IP (anti força-bruta de PIN), em memória.
 * Sem dependência externa. Após MAX falhas, bloqueia com backoff crescente.
 * Sucesso zera o contador.
 */
const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000; // falhas expiram após 15 min de inatividade
const BLOQUEIO_BASE_MS = 30 * 1000; // 30s no 1º bloqueio, dobrando
const BLOQUEIO_MAX_MS = 15 * 60 * 1000;

const registros = new Map(); // ip -> { falhas, ultimaEm, bloqueadoAte }

function chave(req) {
  return req.ip || req.socket?.remoteAddress || 'desconhecido';
}

function verificar(req) {
  const reg = registros.get(chave(req));
  if (!reg) return;
  const agora = Date.now();
  if (agora - reg.ultimaEm > JANELA_MS) {
    registros.delete(chave(req));
    return;
  }
  if (reg.bloqueadoAte && agora < reg.bloqueadoAte) {
    const seg = Math.ceil((reg.bloqueadoAte - agora) / 1000);
    throw new AppError(`Muitas tentativas. Aguarde ${seg}s e tente novamente.`, 429);
  }
}

function falhou(req) {
  const k = chave(req);
  const agora = Date.now();
  const reg = registros.get(k) ?? { falhas: 0, ultimaEm: agora, bloqueadoAte: 0 };
  reg.falhas += 1;
  reg.ultimaEm = agora;
  if (reg.falhas >= MAX_FALHAS) {
    const excedente = reg.falhas - MAX_FALHAS;
    const duracao = Math.min(BLOQUEIO_BASE_MS * 2 ** excedente, BLOQUEIO_MAX_MS);
    reg.bloqueadoAte = agora + duracao;
  }
  registros.set(k, reg);
}

function ok(req) {
  registros.delete(chave(req));
}

// Para os testes não vazarem estado entre suítes
function _resetar() {
  registros.clear();
}

module.exports = { verificar, falhou, ok, _resetar, MAX_FALHAS };
