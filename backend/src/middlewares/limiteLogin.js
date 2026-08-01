const AppError = require('../errors/AppError');
const { ipDoCliente } = require('../lib/rede');

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
let ultimaLimpeza = 0;

// Remove IPs inativos além da janela (impede o Map crescer pra sempre).
function limpar(agora) {
  if (agora - ultimaLimpeza < JANELA_MS) return;
  ultimaLimpeza = agora;
  for (const [ip, reg] of registros) {
    if (agora - reg.ultimaEm > JANELA_MS && (!reg.bloqueadoAte || agora >= reg.bloqueadoAte)) {
      registros.delete(ip);
    }
  }
}

// Balde por IP real do cliente. O header CF-Connecting-IP só entra quando há
// proxy declarado (TRUST_PROXY) — sem isso qualquer um trocaria o header a
// cada tentativa e cairia num balde novo, anulando o bloqueio. Ver lib/rede.
function chave(req) {
  return ipDoCliente(req);
}

function verificar(req) {
  const agora = Date.now();
  limpar(agora);
  const reg = registros.get(chave(req));
  if (!reg) return;
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
